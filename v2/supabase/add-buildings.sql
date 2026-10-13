-- ============================================================
-- Viustay: managers register whole buildings (Form A), then add vacancies (short Form B).
-- Run once in Supabase -> SQL Editor -> New query -> Run, AFTER add-manager-dashboard.sql.
-- Safe to run again.
--
-- A building a manager registers starts as "setting_up". After our agent's visit
-- (photos, checks), set its status to 'live' in Table Editor -> buildings.
-- Each registration also appears in property_submissions so the team sees it.
-- ============================================================

alter table public.buildings add column if not exists road         text;
alter table public.buildings add column if not exists landmark     text;
alter table public.buildings add column if not exists floors       int;
alter table public.buildings add column if not exists total_units  int;
alter table public.buildings add column if not exists lat          numeric(9,6);
alter table public.buildings add column if not exists lng          numeric(9,6);
alter table public.buildings add column if not exists status       text not null default 'live';
alter table public.buildings add column if not exists visit_date   date;
alter table public.buildings add column if not exists visit_time   text;
alter table public.buildings add column if not exists details      jsonb not null default '{}'::jsonb;
alter table public.buildings add column if not exists registered_by_manager boolean not null default false;
alter table public.buildings add column if not exists updated_at   timestamptz;
do $$ begin
  alter table public.buildings add constraint buildings_status_chk check (status in ('setting_up', 'live', 'paused'));
exception when duplicate_object then null; end $$;

-- Short Form B for a vacancy
alter table public.units add column if not exists floor          text;
alter table public.units add column if not exists deposit        text;
alter table public.units add column if not exists furnished      text;
alter table public.units add column if not exists available_from date;

-- Shared checks for the building form
create or replace function public.clean_building(p jsonb)
returns jsonb language plpgsql immutable as $$
declare
  d jsonb := coalesce(p->'details', '{}'::jsonb);
begin
  if char_length(btrim(coalesce(p->>'name', ''))) not between 2 and 160 then raise exception 'bad_name'; end if;
  if char_length(btrim(coalesce(p->>'road', ''))) not between 2 and 200 then raise exception 'bad_road'; end if;
  if char_length(btrim(coalesce(p->>'area', ''))) not between 2 and 80 then raise exception 'bad_area'; end if;
  if char_length(btrim(coalesce(d#>>'{contacts,person}', ''))) not between 2 and 120 then raise exception 'bad_contact'; end if;
  if length(regexp_replace(coalesce(d#>>'{contacts,phone}', ''), '[^0-9]', '', 'g')) not between 9 and 13 then raise exception 'bad_phone'; end if;
  if jsonb_typeof(d->'house_types') <> 'array' or jsonb_array_length(d->'house_types') = 0 then raise exception 'bad_types'; end if;
  if octet_length(d::text) > 20000 then raise exception 'too_big'; end if;
  if nullif(p->>'floors', '') is not null and (p->>'floors')::int not between 0 and 80 then raise exception 'bad_floors'; end if;
  if nullif(p->>'total_units', '') is not null and (p->>'total_units')::int not between 1 and 2000 then raise exception 'bad_units'; end if;
  if nullif(p->>'lat', '') is not null and ((p->>'lat')::numeric not between -1.75 and -0.95 or (p->>'lng')::numeric not between 36.45 and 37.25) then raise exception 'bad_pin'; end if;
  return d;
end $$;

-- ---------- Register a building ----------
create or replace function public.manager_register_building(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d jsonb;
  v_code text; v_id bigint; n int := 0;
  v_visit date := nullif(p->>'visit_date', '')::date;
begin
  if public.my_email() = '' then raise exception 'not_found'; end if;
  d := public.clean_building(p);
  if (select count(*) from public.buildings where lower(owner_email) = public.my_email() and status = 'setting_up') >= 10 then raise exception 'too_many'; end if;
  if v_visit is not null and (v_visit <= (public.nairobi_now())::date or v_visit > (public.nairobi_now())::date + 60) then raise exception 'bad_visit'; end if;
  loop
    n := n + 1;
    v_code := upper(left(regexp_replace(p->>'area', '[^A-Za-z]', '', 'g') || 'XXX', 3)) || '-' || lpad((floor(random() * 900) + 100)::int::text, 3, '0');
    exit when not exists (select 1 from public.buildings where code = v_code) or n > 20;
  end loop;
  insert into public.buildings (code, name, location, road, landmark, floors, total_units, lat, lng, owner_email, caretaker,
                                status, visit_date, visit_time, details, registered_by_manager, updated_at)
  values (v_code, btrim(p->>'name'), btrim(p->>'area'), btrim(p->>'road'), nullif(btrim(coalesce(p->>'landmark', '')), ''),
          nullif(p->>'floors', '')::int, nullif(p->>'total_units', '')::int,
          round(nullif(p->>'lat', '')::numeric, 6), round(nullif(p->>'lng', '')::numeric, 6),
          public.my_email(), nullif(btrim(coalesce(d#>>'{contacts,caretaker}', '')), ''),
          'setting_up', v_visit, nullif(p->>'visit_time', ''), d, true, now())
  returning id into v_id;

  -- So the team sees it with the other "List your property" requests
  insert into public.property_submissions (role, building_name, location, units, contact_name, contact_phone, contact_email, visit_date, status)
  values ('Manager dashboard', btrim(p->>'name'), btrim(p->>'area') || ', ' || btrim(p->>'road'), d->'house_types',
          btrim(d#>>'{contacts,person}'), btrim(d#>>'{contacts,phone}'), public.my_email(), v_visit, case when v_visit is null then 'new' else 'visit booked' end);
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;
revoke all on function public.manager_register_building(jsonb) from public, anon;
grant execute on function public.manager_register_building(jsonb) to authenticated;

-- ---------- Edit a building's details ----------
create or replace function public.manager_update_building(p_id bigint, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  if not public.owns_building(p_id) then raise exception 'not_found'; end if;
  d := public.clean_building(p);
  update public.buildings set
    name = btrim(p->>'name'), location = btrim(p->>'area'), road = btrim(p->>'road'),
    landmark = nullif(btrim(coalesce(p->>'landmark', '')), ''),
    floors = nullif(p->>'floors', '')::int, total_units = nullif(p->>'total_units', '')::int,
    lat = coalesce(round(nullif(p->>'lat', '')::numeric, 6), lat), lng = coalesce(round(nullif(p->>'lng', '')::numeric, 6), lng),
    caretaker = nullif(btrim(coalesce(d#>>'{contacts,caretaker}', '')), ''),
    visit_date = case when status = 'setting_up' and nullif(p->>'visit_date', '') is not null then (p->>'visit_date')::date else visit_date end,
    visit_time = case when status = 'setting_up' and nullif(p->>'visit_time', '') is not null then p->>'visit_time' else visit_time end,
    details = d, updated_at = now()
  where id = p_id;
  return jsonb_build_object('id', p_id);
end $$;
revoke all on function public.manager_update_building(bigint, jsonb) from public, anon;
grant execute on function public.manager_update_building(bigint, jsonb) to authenticated;

-- ---------- Add a vacancy (short Form B) ----------
create or replace function public.manager_add_vacancy(p_building bigint, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_label text := upper(btrim(coalesce(p->>'label', ''))); v_rent int := nullif(p->>'rent', '')::int; v_from date := nullif(p->>'available_from', '')::date;
begin
  if not public.owns_building(p_building) then raise exception 'not_found'; end if;
  if char_length(v_label) not between 1 and 20 then raise exception 'bad_label'; end if;
  if char_length(btrim(coalesce(p->>'type', ''))) not between 2 and 60 then raise exception 'bad_type'; end if;
  if v_rent is null or v_rent < 1000 or v_rent > 5000000 then raise exception 'bad_rent'; end if;
  if v_from is not null and (v_from < (public.nairobi_now())::date - 1 or v_from > (public.nairobi_now())::date + 180) then raise exception 'bad_date'; end if;
  if exists (select 1 from public.units where building_id = p_building and upper(label) = v_label) then raise exception 'label_taken'; end if;
  insert into public.units (building_id, label, type, rent, status, vacant_since, added_by_manager, updated_at, floor, deposit, furnished, available_from)
  values (p_building, v_label, btrim(p->>'type'), v_rent, 'vacant', (public.nairobi_now())::date, true, now(),
          nullif(left(btrim(coalesce(p->>'floor', '')), 20), ''), nullif(left(coalesce(p->>'deposit', ''), 40), ''),
          nullif(left(coalesce(p->>'furnished', ''), 20), ''), v_from)
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;
revoke all on function public.manager_add_vacancy(bigint, jsonb) from public, anon;
grant execute on function public.manager_add_vacancy(bigint, jsonb) to authenticated;
