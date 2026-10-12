-- ============================================================
-- Viustay agent model: trips, agents, vouchers and fare settings.
-- Run once in Supabase -> SQL Editor -> New query -> Run.
-- Needs schema.sql and add-admin.sql to have been run first (they have).
-- Safe to run again: it only adds what is missing and replaces functions.
-- ============================================================

-- ---------- 1. Settings (fare rates, slots, fees) ----------
-- One row, key 'trip'. Edit from admin -> Fare settings.
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

insert into public.app_settings (key, value) values ('trip', '{
  "base": 150, "per_km": 40, "per_min": 4, "wait_per_hour": 300,
  "view_min": 20, "road_factor": 1.4, "speed_kmh": 22, "min_fare": 500, "round_to": 50,
  "return_trip": true, "viewing_fee": 950,
  "slots": ["9:00 AM", "11:30 AM", "2:00 PM"], "trips_per_agent_day": 2,
  "days_ahead": 6, "closed_days": [0], "cutoff": "18:00", "pay_window_min": 30,
  "callout_fee": 300, "placement_bonus_pct": 15,
  "till": "", "pay_name": "Viustay", "payout_day": "Friday",
  "rates_are_placeholders": true,
  "pickups": [
    {"name": "Buruburu", "lat": -1.2890, "lng": 36.8750},
    {"name": "CBD", "lat": -1.2860, "lng": 36.8230},
    {"name": "Dagoretti", "lat": -1.2960, "lng": 36.7550},
    {"name": "Donholm", "lat": -1.2980, "lng": 36.8850},
    {"name": "Eastleigh", "lat": -1.2730, "lng": 36.8480},
    {"name": "Embakasi", "lat": -1.3220, "lng": 36.8950},
    {"name": "Gigiri", "lat": -1.2340, "lng": 36.8030},
    {"name": "Hurlingham", "lat": -1.2960, "lng": 36.7940},
    {"name": "Imara Daima", "lat": -1.3290, "lng": 36.8800},
    {"name": "Kahawa", "lat": -1.1830, "lng": 36.9270},
    {"name": "Kangemi", "lat": -1.2650, "lng": 36.7470},
    {"name": "Karen", "lat": -1.3190, "lng": 36.7070},
    {"name": "Kasarani", "lat": -1.2220, "lng": 36.8960},
    {"name": "Kileleshwa", "lat": -1.2780, "lng": 36.7830},
    {"name": "Kilimani", "lat": -1.2900, "lng": 36.7840},
    {"name": "Kitengela", "lat": -1.4750, "lng": 36.9600},
    {"name": "Langata", "lat": -1.3400, "lng": 36.7600},
    {"name": "Lavington", "lat": -1.2780, "lng": 36.7680},
    {"name": "Loresho", "lat": -1.2520, "lng": 36.7550},
    {"name": "Madaraka", "lat": -1.3060, "lng": 36.8160},
    {"name": "Muthaiga", "lat": -1.2490, "lng": 36.8320},
    {"name": "Nairobi West", "lat": -1.3080, "lng": 36.8200},
    {"name": "Ngara", "lat": -1.2750, "lng": 36.8250},
    {"name": "Ngong Road", "lat": -1.3000, "lng": 36.7780},
    {"name": "Pangani", "lat": -1.2700, "lng": 36.8370},
    {"name": "Parklands", "lat": -1.2630, "lng": 36.8170},
    {"name": "Riverside", "lat": -1.2700, "lng": 36.7920},
    {"name": "Rongai", "lat": -1.3960, "lng": 36.7450},
    {"name": "Roysambu", "lat": -1.2180, "lng": 36.8870},
    {"name": "Ruaka", "lat": -1.2050, "lng": 36.7780},
    {"name": "Runda", "lat": -1.2180, "lng": 36.8100},
    {"name": "South B", "lat": -1.3110, "lng": 36.8360},
    {"name": "South C", "lat": -1.3200, "lng": 36.8270},
    {"name": "Spring Valley", "lat": -1.2560, "lng": 36.7950},
    {"name": "Syokimau", "lat": -1.3600, "lng": 36.9300},
    {"name": "Upper Hill", "lat": -1.2950, "lng": 36.8150},
    {"name": "Utawala", "lat": -1.2850, "lng": 36.9600},
    {"name": "Westlands", "lat": -1.2670, "lng": 36.8040}
  ]
}'::jsonb) on conflict (key) do nothing;

drop policy if exists "anyone reads trip settings" on public.app_settings;
create policy "anyone reads trip settings" on public.app_settings for select to anon, authenticated using (key = 'trip');
drop policy if exists "admins edit settings" on public.app_settings;
create policy "admins edit settings" on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.app_settings to anon, authenticated;
grant update on public.app_settings to authenticated;

-- ---------- 2. Agents ----------
-- email = the agent's login email for agent.html
create table if not exists public.agents (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name       text not null check (char_length(name) between 1 and 120),
  phone      text not null check (char_length(phone) between 9 and 20),
  email      text unique,
  car        text,
  plate      text,
  photo_url  text,
  active     boolean not null default true,
  notes      text
);
alter table public.agents enable row level security;
grant select, insert, update on public.agents to authenticated;

drop policy if exists "admins manage agents" on public.agents;
create policy "admins manage agents" on public.agents for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "agents read own profile" on public.agents;
create policy "agents read own profile" on public.agents for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

create or replace function public.my_agent_id()
returns bigint language sql security definer set search_path = public stable as $$
  select id from public.agents where active and lower(email) = lower(auth.jwt() ->> 'email') limit 1;
$$;
revoke all on function public.my_agent_id() from public, anon;
grant execute on function public.my_agent_id() to authenticated;

-- ---------- 3. Trips (one per booking) ----------
create table if not exists public.trips (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  booking_ref    text not null unique,
  client_name    text not null,
  client_phone   text not null,
  pickup_area    text not null,
  pickup_note    text,
  trip_date      date not null,
  slot           text not null,
  homes          jsonb not null,             -- [{id, title, area, rent, building_code}]
  distance_km    numeric(6,1),
  drive_min      integer,
  wait_min       integer,
  fare           integer not null,           -- goes to the agent as his voucher
  viewing_fee    integer not null,           -- Viustay keeps this
  total          integer not null,
  trip_code      text not null,              -- the client gives this to the agent at the end
  mpesa_code     text,
  paid_at        timestamptz,
  status         text not null default 'awaiting_payment'
                 check (status in ('awaiting_payment', 'paid', 'confirmed', 'completed', 'no_show', 'cancelled', 'expired')),
  agent_id       bigint references public.agents(id),
  agent_response text check (agent_response in ('pending', 'accepted', 'declined')),
  issue          text check (issue in ('no_code', 'no_show', 'other')),
  issue_note     text,
  issue_at       timestamptz,
  issue_lat      numeric(9,6),
  issue_lng      numeric(9,6),
  code_attempts  integer not null default 0,
  rating         integer check (rating between 1 and 5),
  rating_note    text,
  admin_notes    text
);
create index if not exists trips_date_slot on public.trips (trip_date, slot);
alter table public.trips enable row level security;
revoke all on public.trips from anon;
grant select, update on public.trips to authenticated;
-- Clients and agents never touch this table directly: they go through the functions below.
drop policy if exists "admins read trips" on public.trips;
create policy "admins read trips" on public.trips for select to authenticated using (public.is_admin());
drop policy if exists "admins update trips" on public.trips;
create policy "admins update trips" on public.trips for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 4. Vouchers (what agents are owed) ----------
create table if not exists public.vouchers (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  trip_id     bigint references public.trips(id),
  agent_id    bigint not null references public.agents(id),
  kind        text not null check (kind in ('trip', 'callout', 'placement', 'adjustment')),
  amount      integer not null,
  status      text not null default 'claimed' check (status in ('claimed', 'approved', 'held', 'paid')),
  approved_at timestamptz,
  paid_at     timestamptz,
  payout_ref  text,
  note        text
);
create unique index if not exists vouchers_one_per_trip on public.vouchers (trip_id, kind) where kind in ('trip', 'callout');
alter table public.vouchers enable row level security;
revoke all on public.vouchers from anon;
grant select, insert, update, delete on public.vouchers to authenticated;
drop policy if exists "admins manage vouchers" on public.vouchers;
create policy "admins manage vouchers" on public.vouchers for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "agents read own vouchers" on public.vouchers;
create policy "agents read own vouchers" on public.vouchers for select to authenticated using (agent_id = public.my_agent_id());

-- ---------- 5. Helpers ----------
create or replace function public.trip_settings()
returns jsonb language sql security definer set search_path = public stable as $$
  select value from public.app_settings where key = 'trip';
$$;

create or replace function public.nairobi_now()
returns timestamp language sql stable as $$ select (now() at time zone 'Africa/Nairobi'); $$;

-- Fare from distance and number of homes (same formula as js/trip-math.js)
create or replace function public.trip_fare(p_km numeric, p_homes integer, s jsonb)
returns integer language plpgsql immutable as $$
declare
  drive numeric := p_km / greatest((s->>'speed_kmh')::numeric, 1) * 60;
  wait  numeric := p_homes * (s->>'view_min')::numeric;
  raw   numeric := (s->>'base')::numeric + (s->>'per_km')::numeric * p_km
                 + (s->>'per_min')::numeric * drive + (s->>'wait_per_hour')::numeric * wait / 60;
  r     numeric := greatest((s->>'round_to')::numeric, 1);
begin
  return (ceil(greatest(raw, (s->>'min_fare')::numeric) / r) * r)::integer;
end $$;

-- Is this trip holding a slot? (unpaid bookings let go after the payment window)
create or replace function public.trip_holds_slot(t public.trips, s jsonb)
returns boolean language sql stable as $$
  select t.status in ('paid', 'confirmed', 'completed', 'no_show')
      or (t.status = 'awaiting_payment' and t.created_at > now() - make_interval(mins => (s->>'pay_window_min')::int));
$$;

create or replace function public.earliest_trip_day(s jsonb)
returns date language sql stable as $$
  select (public.nairobi_now()::date + case when public.nairobi_now()::time < (s->>'cutoff')::time then 1 else 2 end);
$$;

-- Open slots for the booking page
create or replace function public.trip_slots()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  s jsonb := public.trip_settings();
  agents int := (select count(*) from public.agents where active);
  per_day int := agents * (s->>'trips_per_agent_day')::int;
  d date := public.earliest_trip_day(s);
  last_day date := d + (s->>'days_ahead')::int - 1;
  days jsonb := '[]'::jsonb;
  slots jsonb;
  sl text;
  day_taken int;
  slot_taken int;
begin
  while d <= last_day loop
    if not ((s->'closed_days') @> to_jsonb(extract(dow from d)::int)) then
      day_taken := (select count(*) from public.trips t where t.trip_date = d and public.trip_holds_slot(t, s));
      slots := '[]'::jsonb;
      for sl in select jsonb_array_elements_text(s->'slots') loop
        slot_taken := (select count(*) from public.trips t where t.trip_date = d and t.slot = sl and public.trip_holds_slot(t, s));
        slots := slots || jsonb_build_object('slot', sl, 'open', slot_taken < agents and day_taken < per_day);
      end loop;
      days := days || jsonb_build_object('day', d, 'slots', slots);
    else
      last_day := last_day + 1;   -- skip closed days but still offer the same number of days
    end if;
    d := d + 1;
  end loop;
  return jsonb_build_object('agents', agents, 'days', days);
end $$;
grant execute on function public.trip_slots() to anon, authenticated;

-- ---------- 6. Client functions ----------
create or replace function public.phone_key(p text)
returns text language sql immutable as $$ select right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 9); $$;

-- Book: saves the trip (awaiting payment) and one viewings row per home
create or replace function public.create_trip(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s jsonb := public.trip_settings();
  v_name text := btrim(coalesce(p->>'name', ''));
  v_phone text := btrim(coalesce(p->>'phone', ''));
  v_day date := (p->>'date')::date;
  v_slot text := p->>'slot';
  v_homes jsonb := case when jsonb_typeof(p->'homes') = 'array' then p->'homes' else '[]'::jsonb end;
  n int := jsonb_array_length(case when jsonb_typeof(p->'homes') = 'array' then p->'homes' else '[]'::jsonb end);
  v_km numeric := round((p->>'distance_km')::numeric, 1);
  agents int := (select count(*) from public.agents where active);
  v_fare int; v_drive int; v_wait int;
  v_ref text; v_code text; h jsonb;
begin
  if char_length(v_name) not between 1 and 120 then raise exception 'bad_name'; end if;
  if length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 9 and 13 then raise exception 'bad_phone'; end if;
  if n not between 1 and 3 then raise exception 'bad_homes'; end if;
  if v_km is null or v_km < 0.5 or v_km > 150 then raise exception 'bad_distance'; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(s->'pickups', '[]'::jsonb)) x where x->>'name' = p->>'pickup_area')
  then raise exception 'bad_pickup'; end if;
  if not ((s->'slots') ? v_slot) then raise exception 'bad_slot'; end if;
  if v_day < public.earliest_trip_day(s) or v_day > public.earliest_trip_day(s) + 14
     or (s->'closed_days') @> to_jsonb(extract(dow from v_day)::int) then raise exception 'bad_date'; end if;

  -- one booking at a time per slot, so two families can't take the last agent together
  perform pg_advisory_xact_lock(hashtext('trip-slot' || v_day::text));
  if (select count(*) from public.trips t where t.trip_date = v_day and t.slot = v_slot and public.trip_holds_slot(t, s)) >= agents
     or (select count(*) from public.trips t where t.trip_date = v_day and public.trip_holds_slot(t, s)) >= agents * (s->>'trips_per_agent_day')::int
  then raise exception 'slot_full'; end if;

  v_fare := public.trip_fare(v_km, n, s);
  v_drive := round(v_km / greatest((s->>'speed_kmh')::numeric, 1) * 60);
  v_wait := n * (s->>'view_min')::int;
  loop
    v_ref := 'VS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.trips where booking_ref = v_ref);
  end loop;
  v_code := lpad((floor(random() * 10000))::int::text, 4, '0');

  insert into public.trips (booking_ref, client_name, client_phone, pickup_area, pickup_note, trip_date, slot, homes,
                            distance_km, drive_min, wait_min, fare, viewing_fee, total, trip_code)
  values (v_ref, v_name, v_phone, p->>'pickup_area', nullif(left(btrim(coalesce(p->>'pickup_note', '')), 200), ''), v_day, v_slot, v_homes,
          v_km, v_drive, v_wait, v_fare, (s->>'viewing_fee')::int, v_fare + (s->>'viewing_fee')::int, v_code);

  for h in select * from jsonb_array_elements(v_homes) loop
    insert into public.viewings (booking_ref, listing_id, building_code, listing_title, rent, viewing_date, viewing_time, tenant_name, tenant_phone, search)
    values (v_ref, coalesce(h->>'id', '?'), h->>'building_code', h->>'title', (h->>'rent')::int, v_day, v_slot, v_name, v_phone, p->'search');
  end loop;

  return jsonb_build_object('ref', v_ref, 'fare', v_fare, 'viewing_fee', (s->>'viewing_fee')::int, 'total', v_fare + (s->>'viewing_fee')::int,
                            'expires_at', now() + make_interval(mins => (s->>'pay_window_min')::int));
end $$;
grant execute on function public.create_trip(jsonb) to anon, authenticated;

-- Client types the M-Pesa confirmation code after paying
create or replace function public.submit_payment(p_ref text, p_phone text, p_mpesa text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s jsonb := public.trip_settings();
  t public.trips;
  v_code text := upper(regexp_replace(coalesce(p_mpesa, ''), '[^A-Za-z0-9]', '', 'g'));
  agents int := (select count(*) from public.agents where active);
begin
  select * into t from public.trips where booking_ref = upper(btrim(p_ref)) and public.phone_key(client_phone) = public.phone_key(p_phone) for update;
  if not found then raise exception 'not_found'; end if;
  if v_code !~ '^[A-Z0-9]{8,12}$' then raise exception 'bad_mpesa'; end if;
  if t.status <> 'awaiting_payment' then
    if t.mpesa_code is not null then return jsonb_build_object('ok', true, 'code', t.trip_code, 'already', true); end if;
    raise exception 'not_open';
  end if;
  -- paid late: still fine if the slot is free
  if not public.trip_holds_slot(t, s) then
    perform pg_advisory_xact_lock(hashtext('trip-slot' || t.trip_date::text));
    if (select count(*) from public.trips x where x.trip_date = t.trip_date and x.slot = t.slot and x.id <> t.id and public.trip_holds_slot(x, s)) >= agents
    then raise exception 'slot_full'; end if;
  end if;
  update public.trips set mpesa_code = v_code, paid_at = now(), status = 'paid' where id = t.id;
  return jsonb_build_object('ok', true, 'code', t.trip_code);
end $$;
grant execute on function public.submit_payment(text, text, text) to anon, authenticated;

-- "My trip" page: status, trip code and (once confirmed) the agent's details
create or replace function public.lookup_trip(p_ref text, p_phone text)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  t public.trips;
  a public.agents;
  s jsonb := public.trip_settings();
begin
  select * into t from public.trips where booking_ref = upper(btrim(p_ref)) and public.phone_key(client_phone) = public.phone_key(p_phone);
  if not found then raise exception 'not_found'; end if;
  if t.agent_id is not null and t.agent_response = 'accepted' and t.status in ('confirmed', 'completed') then
    select * into a from public.agents where id = t.agent_id;
  end if;
  return jsonb_build_object(
    'ref', t.booking_ref, 'name', t.client_name, 'status',
      case when t.status = 'awaiting_payment' and not public.trip_holds_slot(t, s) then 'expired' else t.status end,
    'date', t.trip_date, 'slot', t.slot, 'pickup_area', t.pickup_area, 'pickup_note', t.pickup_note, 'homes', t.homes,
    'fare', t.fare, 'viewing_fee', t.viewing_fee, 'total', t.total, 'mpesa_code', t.mpesa_code,
    'expires_at', t.created_at + make_interval(mins => (s->>'pay_window_min')::int),
    'code', case when t.status in ('paid', 'confirmed') then t.trip_code end,
    'agent', case when a.id is not null then jsonb_build_object('name', a.name, 'phone', a.phone, 'car', a.car, 'plate', a.plate, 'photo_url', a.photo_url) end,
    'rating', t.rating);
end $$;
grant execute on function public.lookup_trip(text, text) to anon, authenticated;

create or replace function public.rate_trip(p_ref text, p_phone text, p_rating int, p_note text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_rating not between 1 and 5 then raise exception 'bad_rating'; end if;
  update public.trips set rating = p_rating, rating_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
   where booking_ref = upper(btrim(p_ref)) and public.phone_key(client_phone) = public.phone_key(p_phone)
     and status = 'completed' and rating is null;
  return found;
end $$;
grant execute on function public.rate_trip(text, text, int, text) to anon, authenticated;

-- ---------- 7. Agent functions (agent.html) ----------
create or replace function public.agent_trips()
returns jsonb language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_agg(x order by x->>'date', x->>'slot'), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', t.id, 'ref', t.booking_ref, 'date', t.trip_date, 'slot', t.slot, 'status', t.status,
      'response', t.agent_response, 'pickup_area', t.pickup_area, 'pickup_note', t.pickup_note,
      'homes', t.homes, 'pay', t.fare, 'km', t.distance_km, 'drive_min', t.drive_min, 'wait_min', t.wait_min,
      'client', split_part(t.client_name, ' ', 1),
      'phone', case when t.agent_response = 'accepted' and t.status = 'confirmed' then t.client_phone end,
      'issue', t.issue, 'attempts_left', greatest(0, 5 - t.code_attempts)) as x
    from public.trips t
    where t.agent_id = public.my_agent_id()
      and t.status in ('confirmed', 'completed', 'no_show')
      and t.agent_response <> 'declined'
      and t.trip_date >= public.nairobi_now()::date - 30
  ) q;
$$;
revoke all on function public.agent_trips() from public, anon;
grant execute on function public.agent_trips() to authenticated;

create or replace function public.agent_respond(p_trip bigint, p_accept boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.trips set agent_response = case when p_accept then 'accepted' else 'declined' end
   where id = p_trip and agent_id = public.my_agent_id() and status = 'confirmed' and agent_response = 'pending';
  return found;
end $$;
revoke all on function public.agent_respond(bigint, boolean) from public, anon;
grant execute on function public.agent_respond(bigint, boolean) to authenticated;

-- Agent types the client's code -> trip completed + voucher claimed
create or replace function public.claim_trip(p_trip bigint, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  me bigint := public.my_agent_id();
begin
  select * into t from public.trips where id = p_trip and agent_id = me for update;
  if not found or me is null then return jsonb_build_object('ok', false, 'error', 'not_yours'); end if;
  if t.status <> 'confirmed' or t.agent_response <> 'accepted' then return jsonb_build_object('ok', false, 'error', 'not_open'); end if;
  if t.trip_date > public.nairobi_now()::date then return jsonb_build_object('ok', false, 'error', 'too_early'); end if;
  if t.code_attempts >= 5 then return jsonb_build_object('ok', false, 'error', 'locked'); end if;
  if btrim(coalesce(p_code, '')) <> t.trip_code then
    update public.trips set code_attempts = code_attempts + 1 where id = t.id;
    return jsonb_build_object('ok', false, 'error', case when t.code_attempts + 1 >= 5 then 'locked' else 'wrong' end, 'left', 5 - (t.code_attempts + 1));
  end if;
  update public.trips set status = 'completed', issue = null where id = t.id;
  update public.viewings set status = 'done' where booking_ref = t.booking_ref;
  insert into public.vouchers (trip_id, agent_id, kind, amount) values (t.id, me, 'trip', t.fare) on conflict do nothing;
  return jsonb_build_object('ok', true, 'amount', t.fare);
end $$;
revoke all on function public.claim_trip(bigint, text) from public, anon;
grant execute on function public.claim_trip(bigint, text) to authenticated;

-- Agent flags a problem: client has no code, client didn't come, or something else
create or replace function public.agent_report(p_trip bigint, p_issue text, p_note text, p_lat numeric, p_lng numeric)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_issue not in ('no_code', 'no_show', 'other') then raise exception 'bad_issue'; end if;
  update public.trips set issue = p_issue, issue_note = nullif(left(btrim(coalesce(p_note, '')), 500), ''), issue_at = now(),
         issue_lat = p_lat, issue_lng = p_lng
   where id = p_trip and agent_id = public.my_agent_id() and status = 'confirmed' and agent_response = 'accepted';
  return found;
end $$;
revoke all on function public.agent_report(bigint, text, text, numeric, numeric) from public, anon;
grant execute on function public.agent_report(bigint, text, text, numeric, numeric) to authenticated;
