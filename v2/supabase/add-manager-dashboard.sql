-- ============================================================
-- Viustay: the new manager dashboard.
-- Run once in Supabase -> SQL Editor -> New query -> Run, AFTER add-trip-changes.sql.
-- Safe to run again.
--
-- What it adds:
--   * Managers can mark a unit let / vacant, change the rent, pause it, and add a vacancy.
--   * Managers see which agent brings each viewing (name, car, plate, photo), never the tenant.
--   * Managers can say how a viewing went (liked it / thinking / not for them).
--   * A profile with name, phone and notification choices.
--   * Placement fees are no longer visible to managers (finance handles them).
-- ============================================================

-- ---------- Units: paused + who changed what ----------
alter table public.units add column if not exists paused boolean not null default false;
alter table public.units add column if not exists added_by_manager boolean not null default false;
alter table public.units add column if not exists updated_at timestamptz;

-- ---------- Viewings: the manager's note on how it went ----------
alter table public.viewings add column if not exists owner_outcome text;
do $$ begin
  alter table public.viewings add constraint viewings_owner_outcome_chk check (owner_outcome in ('liked', 'thinking', 'no'));
exception when duplicate_object then null; end $$;

-- ---------- Manager profiles (one per login email) ----------
create table if not exists public.manager_profiles (
  email          text primary key,
  name           text check (char_length(name) <= 120),
  phone          text check (char_length(phone) <= 20),
  notify_booked  boolean not null default true,
  notify_agent   boolean not null default true,
  notify_weekly  boolean not null default false,
  updated_at     timestamptz not null default now()
);
alter table public.manager_profiles enable row level security;
revoke all on public.manager_profiles from anon, authenticated;

-- ---------- Fees: managers no longer read placements ----------
drop policy if exists "managers read own placements" on public.placements;
revoke select on public.placements from anon, authenticated;

-- Helper: the logged-in manager's email
create or replace function public.my_email()
returns text language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')); $$;

-- Helper: does this manager own the building?
create or replace function public.owns_building(p_building bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.buildings b where b.id = p_building and lower(b.owner_email) = public.my_email() and public.my_email() <> '');
$$;

-- ---------- Edit a unit ----------
-- p: {"status":"let"|"vacant", "rent": 38000, "paused": true|false}
create or replace function public.manager_update_unit(p_id bigint, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u public.units;
  v_rent int;
begin
  select * into u from public.units where id = p_id for update;
  if not found or not public.owns_building(u.building_id) then raise exception 'not_found'; end if;

  if p ? 'status' then
    if p->>'status' not in ('let', 'vacant') then raise exception 'bad_status'; end if;
    if p->>'status' <> u.status then
      update public.units set status = p->>'status',
        vacant_since = case when p->>'status' = 'vacant' then (public.nairobi_now())::date else null end,
        paused = case when p->>'status' = 'let' then false else paused end
      where id = u.id;
    end if;
  end if;
  if p ? 'rent' then
    v_rent := nullif(p->>'rent', '')::int;
    if v_rent is null or v_rent < 1000 or v_rent > 5000000 then raise exception 'bad_rent'; end if;
    update public.units set rent = v_rent where id = u.id;
  end if;
  if p ? 'paused' then
    update public.units set paused = coalesce((p->>'paused')::boolean, false) where id = u.id;
  end if;
  update public.units set updated_at = now() where id = u.id returning * into u;
  return jsonb_build_object('id', u.id, 'status', u.status, 'rent', u.rent, 'paused', u.paused, 'vacant_since', u.vacant_since);
end $$;
revoke all on function public.manager_update_unit(bigint, jsonb) from public, anon;
grant execute on function public.manager_update_unit(bigint, jsonb) to authenticated;

-- ---------- Add a vacancy (we then visit, take photos and list it) ----------
create or replace function public.manager_add_unit(p_building bigint, p_label text, p_type text, p_rent int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.owns_building(p_building) then raise exception 'not_found'; end if;
  if char_length(btrim(coalesce(p_label, ''))) not between 1 and 20 then raise exception 'bad_label'; end if;
  if char_length(btrim(coalesce(p_type, ''))) not between 2 and 60 then raise exception 'bad_type'; end if;
  if p_rent is null or p_rent < 1000 or p_rent > 5000000 then raise exception 'bad_rent'; end if;
  if exists (select 1 from public.units where building_id = p_building and lower(label) = lower(btrim(p_label))) then raise exception 'label_taken'; end if;
  insert into public.units (building_id, label, type, rent, status, vacant_since, added_by_manager, updated_at)
  values (p_building, upper(btrim(p_label)), btrim(p_type), p_rent, 'vacant', (public.nairobi_now())::date, true, now())
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;
revoke all on function public.manager_add_unit(bigint, text, text, int) from public, anon;
grant execute on function public.manager_add_unit(bigint, text, text, int) to authenticated;

-- ---------- Viewings with the agent (no tenant names or phones) ----------
drop function if exists public.my_viewings_v2();
create or replace function public.my_viewings_v2()
returns table (id bigint, building_id bigint, viewing_date date, viewing_time text, listing_id text, listing_title text,
               status text, owner_outcome text, homes int,
               agent_name text, agent_phone text, agent_car text, agent_plate text, agent_photo text)
language sql security definer set search_path = public stable as $$
  select v.id, b.id, v.viewing_date, v.viewing_time, v.listing_id, v.listing_title,
         case when t.status = 'cancelled' then 'cancelled' else v.status end,
         v.owner_outcome, coalesce(jsonb_array_length(t.homes), 1),
         a.name, a.phone, a.car, a.plate, a.photo_url
  from public.viewings v
  join public.buildings b on b.code = v.building_code
  left join public.trips t on t.booking_ref = v.booking_ref
  left join public.agents a on a.id = t.agent_id and t.agent_response = 'accepted' and t.status in ('confirmed', 'completed')
  where lower(b.owner_email) = public.my_email() and public.my_email() <> ''
    and v.status <> 'cancelled' and coalesce(t.status, '') not in ('cancelled', 'expired')
  order by v.viewing_date desc, v.viewing_time
  limit 500;
$$;
revoke all on function public.my_viewings_v2() from public, anon;
grant execute on function public.my_viewings_v2() to authenticated;

-- ---------- How did the viewing go? ----------
create or replace function public.manager_viewing_outcome(p_id bigint, p_outcome text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_outcome is not null and p_outcome not in ('liked', 'thinking', 'no') then raise exception 'bad_outcome'; end if;
  update public.viewings v set owner_outcome = p_outcome
   where v.id = p_id
     and v.viewing_date <= (public.nairobi_now())::date
     and exists (select 1 from public.buildings b where b.code = v.building_code and lower(b.owner_email) = public.my_email() and public.my_email() <> '');
  if not found then raise exception 'not_found'; end if;
  return true;
end $$;
revoke all on function public.manager_viewing_outcome(bigint, text) from public, anon;
grant execute on function public.manager_viewing_outcome(bigint, text) to authenticated;

-- ---------- Profile ----------
create or replace function public.my_profile()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  pr public.manager_profiles;
  sub public.property_submissions;
begin
  if public.my_email() = '' then raise exception 'not_found'; end if;
  select * into pr from public.manager_profiles where email = public.my_email();
  -- Fill blanks from the "List your property" form they sent us
  select * into sub from public.property_submissions where lower(contact_email) = public.my_email() order by created_at desc limit 1;
  return jsonb_build_object(
    'email', public.my_email(),
    'name', coalesce(pr.name, sub.contact_name),
    'phone', coalesce(pr.phone, sub.contact_phone),
    'notify_booked', coalesce(pr.notify_booked, true),
    'notify_agent', coalesce(pr.notify_agent, true),
    'notify_weekly', coalesce(pr.notify_weekly, false),
    'visit_date', sub.visit_date,
    'submission_status', sub.status,
    'submitted_building', sub.building_name);
end $$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

create or replace function public.save_my_profile(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_name text; v_phone text;
begin
  if public.my_email() = '' then raise exception 'not_found'; end if;
  v_name := nullif(btrim(coalesce(p->>'name', '')), '');
  v_phone := nullif(btrim(coalesce(p->>'phone', '')), '');
  if v_name is not null and char_length(v_name) > 120 then raise exception 'bad_name'; end if;
  if v_phone is not null and length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 9 and 13 then raise exception 'bad_phone'; end if;
  insert into public.manager_profiles as m (email, name, phone, notify_booked, notify_agent, notify_weekly, updated_at)
  values (public.my_email(), v_name, v_phone,
          coalesce((p->>'notify_booked')::boolean, true), coalesce((p->>'notify_agent')::boolean, true), coalesce((p->>'notify_weekly')::boolean, false), now())
  on conflict (email) do update set
    name = case when p ? 'name' then excluded.name else m.name end,
    phone = case when p ? 'phone' then excluded.phone else m.phone end,
    notify_booked = case when p ? 'notify_booked' then excluded.notify_booked else m.notify_booked end,
    notify_agent = case when p ? 'notify_agent' then excluded.notify_agent else m.notify_agent end,
    notify_weekly = case when p ? 'notify_weekly' then excluded.notify_weekly else m.notify_weekly end,
    updated_at = now();
  return public.my_profile();
end $$;
revoke all on function public.save_my_profile(jsonb) from public, anon;
grant execute on function public.save_my_profile(jsonb) to authenticated;
