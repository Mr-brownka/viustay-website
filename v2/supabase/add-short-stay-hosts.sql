-- ============================================================
-- Viustay update 15: managers say what they have (monthly rentals / short stays) and list short stays.
-- Run once in Supabase -> SQL Editor -> New query -> Run, AFTER add-publish.sql and add-manager-dashboard.sql.
-- Safe to run again.
--
-- 1. Manager profile: company, what they have (monthly / short), role, rough number of units.
-- 2. short_stay_submissions: the 4-step "List a short stay" form from the manager dashboard.
-- 3. Admin -> Homes -> Short-stay hosts -> Publish puts it on the homes page (listings table, stay = short).
-- ============================================================

-- ---------- 1. Profile ----------
alter table public.manager_profiles add column if not exists company    text check (char_length(company) <= 120);
alter table public.manager_profiles add column if not exists kinds      text[] not null default '{}';
alter table public.manager_profiles add column if not exists role       text check (char_length(role) <= 40);
alter table public.manager_profiles add column if not exists unit_count text check (char_length(unit_count) <= 20);

create or replace function public.my_profile()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  pr public.manager_profiles;
  sub public.property_submissions;
begin
  if public.my_email() = '' then raise exception 'not_found'; end if;
  select * into pr from public.manager_profiles where email = public.my_email();
  select * into sub from public.property_submissions where lower(contact_email) = public.my_email() order by created_at desc limit 1;
  return jsonb_build_object(
    'email', public.my_email(),
    'name', coalesce(pr.name, sub.contact_name),
    'phone', coalesce(pr.phone, sub.contact_phone),
    'company', pr.company, 'kinds', coalesce(to_jsonb(pr.kinds), '[]'::jsonb), 'role', pr.role, 'unit_count', pr.unit_count,
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
declare v_name text; v_phone text; v_kinds text[];
begin
  if public.my_email() = '' then raise exception 'not_found'; end if;
  v_name := nullif(btrim(coalesce(p->>'name', '')), '');
  v_phone := nullif(btrim(coalesce(p->>'phone', '')), '');
  if v_name is not null and char_length(v_name) > 120 then raise exception 'bad_name'; end if;
  if v_phone is not null and length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 9 and 13 then raise exception 'bad_phone'; end if;
  if p ? 'kinds' then
    select coalesce(array_agg(k), '{}') into v_kinds from jsonb_array_elements_text(p->'kinds') k where k in ('monthly', 'short');
  end if;
  insert into public.manager_profiles as m (email, name, phone, company, kinds, role, unit_count, notify_booked, notify_agent, notify_weekly, updated_at)
  values (public.my_email(), v_name, v_phone, left(nullif(btrim(coalesce(p->>'company', '')), ''), 120), coalesce(v_kinds, '{}'),
          left(nullif(btrim(coalesce(p->>'role', '')), ''), 40), left(nullif(btrim(coalesce(p->>'unit_count', '')), ''), 20),
          coalesce((p->>'notify_booked')::boolean, true), coalesce((p->>'notify_agent')::boolean, true), coalesce((p->>'notify_weekly')::boolean, false), now())
  on conflict (email) do update set
    name = case when p ? 'name' then excluded.name else m.name end,
    phone = case when p ? 'phone' then excluded.phone else m.phone end,
    company = case when p ? 'company' then excluded.company else m.company end,
    kinds = case when p ? 'kinds' then excluded.kinds else m.kinds end,
    role = case when p ? 'role' then excluded.role else m.role end,
    unit_count = case when p ? 'unit_count' then excluded.unit_count else m.unit_count end,
    notify_booked = case when p ? 'notify_booked' then excluded.notify_booked else m.notify_booked end,
    notify_agent = case when p ? 'notify_agent' then excluded.notify_agent else m.notify_agent end,
    notify_weekly = case when p ? 'notify_weekly' then excluded.notify_weekly else m.notify_weekly end,
    updated_at = now();
  return public.my_profile();
end $$;
revoke all on function public.save_my_profile(jsonb) from public, anon;
grant execute on function public.save_my_profile(jsonb) to authenticated;

-- ---------- 2. Short stays listed by managers ----------
create table if not exists public.short_stay_submissions (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  status        text not null default 'new' check (status in ('new', 'visit booked', 'listed', 'declined')),
  manager_email text not null,
  name          text, phone text,
  building_id   bigint references public.buildings(id) on delete set null,
  building_name text, area text, road text,
  unit_label    text, floor text,
  type          text, bedrooms int, beds int, bathrooms int, max_guests int,
  title         text,
  night_rate    int not null, cleaning_fee int not null default 0, min_nights int not null default 1,
  check_in      text, check_out text, discounts text,
  included      text[] not null default '{}', rules jsonb not null default '{}'::jsonb,
  checkin_name  text, checkin_phone text, keys text,
  notes         text,
  listing_id    text, photos text
);
alter table public.short_stay_submissions enable row level security;
revoke all on public.short_stay_submissions from anon, authenticated;
grant select, update on public.short_stay_submissions to authenticated;
drop policy if exists "admins manage short stay submissions" on public.short_stay_submissions;
create policy "admins manage short stay submissions" on public.short_stay_submissions for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.manager_submit_short_stay(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b public.buildings; v_rate int; v_min int; v_guests int; v_id bigint; v_pr public.manager_profiles;
begin
  if public.my_email() = '' then raise exception 'not_found'; end if;
  v_rate := nullif(regexp_replace(coalesce(p->>'night_rate', ''), '[^0-9]', '', 'g'), '')::int;
  if v_rate is null or v_rate < 500 or v_rate > 500000 then raise exception 'bad_rate'; end if;
  v_min := greatest(1, least(60, coalesce(nullif(p->>'min_nights', '')::int, 1)));
  v_guests := greatest(1, least(30, coalesce(nullif(p->>'max_guests', '')::int, 2)));
  if coalesce(btrim(p->>'type'), '') = '' then raise exception 'bad_type'; end if;
  if nullif(p->>'building_id', '') is not null then
    select * into b from public.buildings where id = (p->>'building_id')::bigint;
    if not found or not public.owns_building(b.id) then raise exception 'not_yours'; end if;
  elsif coalesce(btrim(p->>'building_name'), '') = '' or coalesce(btrim(p->>'area'), '') = '' then raise exception 'bad_place';
  end if;
  if coalesce(btrim(p->>'checkin_phone'), '') <> '' and length(regexp_replace(p->>'checkin_phone', '[^0-9]', '', 'g')) not between 9 and 13 then raise exception 'bad_phone'; end if;
  select * into v_pr from public.manager_profiles where email = public.my_email();
  insert into public.short_stay_submissions (manager_email, name, phone, building_id, building_name, area, road, unit_label, floor, type, bedrooms, beds, bathrooms, max_guests, title,
    night_rate, cleaning_fee, min_nights, check_in, check_out, discounts, included, rules, checkin_name, checkin_phone, keys, notes)
  values (public.my_email(), v_pr.name, v_pr.phone, b.id, coalesce(b.name, left(btrim(p->>'building_name'), 120)), coalesce(b.location, left(btrim(p->>'area'), 60)), coalesce(b.road, left(nullif(btrim(coalesce(p->>'road', '')), ''), 120)),
    left(nullif(btrim(coalesce(p->>'unit_label', '')), ''), 30), left(nullif(btrim(coalesce(p->>'floor', '')), ''), 30),
    left(btrim(p->>'type'), 40), nullif(p->>'bedrooms', '')::int, greatest(1, coalesce(nullif(p->>'beds', '')::int, 1)), greatest(1, coalesce(nullif(p->>'bathrooms', '')::int, 1)), v_guests,
    left(nullif(btrim(coalesce(p->>'title', '')), ''), 120),
    v_rate, greatest(0, coalesce(nullif(regexp_replace(coalesce(p->>'cleaning_fee', ''), '[^0-9]', '', 'g'), '')::int, 0)), v_min,
    left(coalesce(nullif(p->>'check_in', ''), '2:00 PM'), 20), left(coalesce(nullif(p->>'check_out', ''), '11:00 AM'), 20), left(nullif(p->>'discounts', ''), 60),
    coalesce(array(select left(x, 40) from jsonb_array_elements_text(coalesce(p->'included', '[]'::jsonb)) x limit 30), '{}'),
    coalesce(p->'rules', '{}'::jsonb),
    left(nullif(btrim(coalesce(p->>'checkin_name', '')), ''), 80), left(nullif(btrim(coalesce(p->>'checkin_phone', '')), ''), 20), left(nullif(p->>'keys', ''), 40),
    left(nullif(btrim(coalesce(p->>'notes', '')), ''), 1000))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function public.manager_submit_short_stay(jsonb) from public, anon;
grant execute on function public.manager_submit_short_stay(jsonb) to authenticated;

create or replace function public.my_short_stays()
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'created_at', s.created_at, 'status', s.status, 'building_id', s.building_id, 'building_name', s.building_name, 'area', s.area,
    'unit_label', s.unit_label, 'type', s.type, 'title', s.title, 'night_rate', s.night_rate, 'min_nights', s.min_nights, 'max_guests', s.max_guests, 'listing_id', s.listing_id)
  from public.short_stay_submissions s where lower(s.manager_email) = public.my_email() and public.my_email() <> '' order by s.created_at desc;
$$;
revoke all on function public.my_short_stays() from public, anon;
grant execute on function public.my_short_stays() to authenticated;

-- ---------- 3. Publish a short stay (admin) ----------
alter table public.listings add column if not exists stay         text;
alter table public.listings add column if not exists night_rate   int;
alter table public.listings add column if not exists min_nights   int;
alter table public.listings add column if not exists cleaning_fee int;
alter table public.listings add column if not exists max_guests   int;
alter table public.listings add column if not exists check_in     text;
alter table public.listings add column if not exists check_out    text;
alter table public.listings add column if not exists included     text;
alter table public.listings add column if not exists house_rules  text;
alter table public.listings add column if not exists cancellation text;

create or replace function public.admin_publish_stay(p_sub bigint, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.short_stay_submissions; v_id text; n int; v_photos text; v_rules text;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into s from public.short_stay_submissions where id = p_sub for update;
  if not found then raise exception 'not_found'; end if;
  v_photos := btrim(coalesce(p->>'photos', s.photos, ''));
  if v_photos = '' then raise exception 'no_photos'; end if;
  perform pg_advisory_xact_lock(hashtext('listing-ids'));
  v_id := s.listing_id;
  if v_id is null then
    select greatest(1000, coalesce(max((substring(id from '^VS-(\d+)$'))::int), 1000)) + 1 into n from public.listings where id ~ '^VS-\d+$';
    v_id := 'VS-' || n;
  end if;
  select string_agg(r, '; ') into v_rules from (
    select case key when 'smoking' then 'No smoking inside' when 'parties' then 'No parties' when 'pets' then 'No pets' when 'visitors' then 'No visitors after 10 PM' end as r
    from jsonb_each_text(s.rules) where value = 'false' and key in ('smoking', 'parties', 'pets', 'visitors')) q;
  insert into public.listings as l (id, building_id, status, type, bedrooms, bathrooms, rent, area, road, building_code, floor, furnished, amenities, notes, photos,
      stay, night_rate, min_nights, cleaning_fee, max_guests, check_in, check_out, included, house_rules, cancellation)
  values (v_id, s.building_id, 'available', s.type, s.bedrooms, s.bathrooms, s.night_rate, s.area, coalesce(s.road, s.building_name), null, s.floor, 'Furnished',
      array_to_string(s.included, '; '), coalesce(nullif(p->>'notes', ''), s.notes), v_photos,
      'short', s.night_rate, s.min_nights, s.cleaning_fee, s.max_guests, s.check_in, s.check_out, array_to_string(s.included, '; '), v_rules, nullif(p->>'cancellation', ''))
  on conflict (id) do update set status = 'available', photos = excluded.photos, night_rate = excluded.night_rate, rent = excluded.rent, min_nights = excluded.min_nights,
      cleaning_fee = excluded.cleaning_fee, max_guests = excluded.max_guests, included = excluded.included, amenities = excluded.amenities, house_rules = excluded.house_rules, notes = excluded.notes;
  update public.short_stay_submissions set status = 'listed', listing_id = v_id, photos = v_photos where id = s.id;
  return jsonb_build_object('ok', true, 'listing_id', v_id);
end $$;
revoke all on function public.admin_publish_stay(bigint, jsonb) from public, anon;
grant execute on function public.admin_publish_stay(bigint, jsonb) to authenticated;
