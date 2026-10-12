-- ============================================================
-- Viustay: book a viewing now, pay after the trip.
-- Run once in Supabase -> SQL Editor -> New query -> Run, AFTER add-agents.sql.
-- Safe to run again.
--
-- What changes:
--  * New bookings start as 'booked' (nothing paid). You check the homes, confirm, assign an agent.
--  * The client's exact pickup pin (lat / lng) is saved with the trip.
--  * trip_calendar(): open days for the next 60 days (the page shows the first 7 open ones + a calendar).
--  * At the end of the trip the client pays by M-Pesa. The agent (or the client on "My bookings")
--    types the M-Pesa code: the trip is completed and the agent's voucher is claimed.
--    When the STK prompt is live (after company registration) this step becomes automatic.
--  * Old pay-first bookings keep working as before.
-- ============================================================

alter table public.trips add column if not exists pickup_lat numeric(9,6);
alter table public.trips add column if not exists pickup_lng numeric(9,6);
alter table public.trips add column if not exists pay_after boolean not null default false;

alter table public.trips drop constraint if exists trips_status_check;
alter table public.trips add constraint trips_status_check
  check (status in ('booked', 'awaiting_payment', 'paid', 'confirmed', 'completed', 'no_show', 'cancelled', 'expired'));
alter table public.trips drop constraint if exists trips_issue_check;
alter table public.trips add constraint trips_issue_check check (issue in ('no_code', 'no_show', 'unpaid', 'other'));

-- How far ahead the calendar goes
update public.app_settings set value = value || '{"calendar_days": 60}'::jsonb
 where key = 'trip' and not (value ? 'calendar_days');

-- 'booked' trips hold their slot
create or replace function public.trip_holds_slot(t public.trips, s jsonb)
returns boolean language sql stable as $$
  select t.status in ('booked', 'paid', 'confirmed', 'completed', 'no_show')
      or (t.status = 'awaiting_payment' and t.created_at > now() - make_interval(mins => (s->>'pay_window_min')::int));
$$;

-- Open days and times for the next calendar_days days (closed days left out)
create or replace function public.trip_calendar()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  s jsonb := public.trip_settings();
  agents int := (select count(*) from public.agents where active);
  per_day int := agents * (s->>'trips_per_agent_day')::int;
  d date := public.earliest_trip_day(s);
  last_day date := d + coalesce((s->>'calendar_days')::int, 60) - 1;
  days jsonb := '[]'::jsonb;
  slots jsonb; sl text; day_taken int; slot_taken int;
  taken jsonb;
begin
  -- one pass over the bookings instead of one query per day
  select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) into taken from (
    select t.trip_date::text || '|' || t.slot as k, count(*) as n from public.trips t
     where t.trip_date between d and last_day and public.trip_holds_slot(t, s) group by 1
    union all
    select t.trip_date::text, count(*) from public.trips t
     where t.trip_date between d and last_day and public.trip_holds_slot(t, s) group by 1
  ) q;
  while d <= last_day loop
    if not ((s->'closed_days') @> to_jsonb(extract(dow from d)::int)) then
      day_taken := coalesce((taken->>d::text)::int, 0);
      slots := '[]'::jsonb;
      for sl in select jsonb_array_elements_text(s->'slots') loop
        slot_taken := coalesce((taken->>(d::text || '|' || sl))::int, 0);
        slots := slots || jsonb_build_object('slot', sl, 'open', slot_taken < agents and day_taken < per_day);
      end loop;
      days := days || jsonb_build_object('day', d, 'slots', slots);
    end if;
    d := d + 1;
  end loop;
  return jsonb_build_object('agents', agents, 'days', days);
end $$;
grant execute on function public.trip_calendar() to anon, authenticated;

-- Book now, pay after. Same checks as before, plus the pickup pin.
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
  v_lat numeric := nullif(p->>'pickup_lat', '')::numeric;
  v_lng numeric := nullif(p->>'pickup_lng', '')::numeric;
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
  -- pin must be in greater Nairobi
  if v_lat is not null and (v_lat not between -1.75 and -0.95 or v_lng not between 36.45 and 37.25) then raise exception 'bad_pickup'; end if;
  if not ((s->'slots') ? v_slot) then raise exception 'bad_slot'; end if;
  if v_day < public.earliest_trip_day(s) or v_day > public.earliest_trip_day(s) + coalesce((s->>'calendar_days')::int, 60)
     or (s->'closed_days') @> to_jsonb(extract(dow from v_day)::int) then raise exception 'bad_date'; end if;

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

  insert into public.trips (booking_ref, client_name, client_phone, pickup_area, pickup_note, pickup_lat, pickup_lng, trip_date, slot, homes,
                            distance_km, drive_min, wait_min, fare, viewing_fee, total, trip_code, status, pay_after)
  values (v_ref, v_name, v_phone, p->>'pickup_area', nullif(left(btrim(coalesce(p->>'pickup_note', '')), 200), ''), round(v_lat, 6), round(v_lng, 6),
          v_day, v_slot, v_homes, v_km, v_drive, v_wait, v_fare, (s->>'viewing_fee')::int, v_fare + (s->>'viewing_fee')::int, v_code, 'booked', true);

  for h in select * from jsonb_array_elements(v_homes) loop
    insert into public.viewings (booking_ref, listing_id, building_code, listing_title, rent, viewing_date, viewing_time, tenant_name, tenant_phone, search)
    values (v_ref, coalesce(h->>'id', '?'), h->>'building_code', h->>'title', (h->>'rent')::int, v_day, v_slot, v_name, v_phone, p->'search');
  end loop;

  return jsonb_build_object('ref', v_ref, 'fare', v_fare, 'viewing_fee', (s->>'viewing_fee')::int, 'total', v_fare + (s->>'viewing_fee')::int, 'status', 'booked');
end $$;
grant execute on function public.create_trip(jsonb) to anon, authenticated;

-- Finish a pay-after trip with the client's M-Pesa code (used by the agent and by the client)
create or replace function public.finish_paid_trip(t public.trips, p_mpesa text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_code text := upper(regexp_replace(coalesce(p_mpesa, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if v_code !~ '^[A-Z0-9]{8,12}$' then raise exception 'bad_mpesa'; end if;
  if exists (select 1 from public.trips x where x.mpesa_code = v_code and x.id <> t.id) then raise exception 'used_mpesa'; end if;
  update public.trips set mpesa_code = v_code, paid_at = now(), status = 'completed', issue = null where id = t.id;
  update public.viewings set status = 'done' where booking_ref = t.booking_ref;
  if t.agent_id is not null then
    insert into public.vouchers (trip_id, agent_id, kind, amount, note) values (t.id, t.agent_id, 'trip', t.fare, 'Client paid: M-Pesa ' || v_code) on conflict do nothing;
  end if;
  return jsonb_build_object('ok', true, 'amount', t.fare, 'mpesa', v_code);
end $$;
revoke all on function public.finish_paid_trip(public.trips, text) from public, anon, authenticated;

-- Client: old trips pay first; pay-after trips pay on the trip day
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
  if t.pay_after then
    if t.mpesa_code is not null then return jsonb_build_object('ok', true, 'already', true); end if;
    if t.status <> 'confirmed' or t.trip_date > public.nairobi_now()::date then raise exception 'not_open'; end if;
    return public.finish_paid_trip(t, v_code);
  end if;
  if t.status <> 'awaiting_payment' then
    if t.mpesa_code is not null then return jsonb_build_object('ok', true, 'code', t.trip_code, 'already', true); end if;
    raise exception 'not_open';
  end if;
  if not public.trip_holds_slot(t, s) then
    perform pg_advisory_xact_lock(hashtext('trip-slot' || t.trip_date::text));
    if (select count(*) from public.trips x where x.trip_date = t.trip_date and x.slot = t.slot and x.id <> t.id and public.trip_holds_slot(x, s)) >= agents
    then raise exception 'slot_full'; end if;
  end if;
  update public.trips set mpesa_code = v_code, paid_at = now(), status = 'paid' where id = t.id;
  return jsonb_build_object('ok', true, 'code', t.trip_code);
end $$;
grant execute on function public.submit_payment(text, text, text) to anon, authenticated;

-- "My bookings"
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
    'pay_after', t.pay_after, 'today', public.nairobi_now()::date,
    'date', t.trip_date, 'slot', t.slot, 'pickup_area', t.pickup_area, 'pickup_note', t.pickup_note, 'homes', t.homes,
    'fare', t.fare, 'viewing_fee', t.viewing_fee, 'total', t.total, 'mpesa_code', t.mpesa_code,
    'till', s->>'till', 'pay_name', s->>'pay_name',
    'expires_at', t.created_at + make_interval(mins => (s->>'pay_window_min')::int),
    'code', case when not t.pay_after and t.status in ('paid', 'confirmed') then t.trip_code end,
    'agent', case when a.id is not null then jsonb_build_object('name', a.name, 'phone', a.phone, 'car', a.car, 'plate', a.plate, 'photo_url', a.photo_url) end,
    'rating', t.rating);
end $$;
grant execute on function public.lookup_trip(text, text) to anon, authenticated;

-- Agent's list: adds the pickup pin, pay-after flag and the amount the client pays
create or replace function public.agent_trips()
returns jsonb language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_agg(x order by x->>'date', x->>'slot'), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', t.id, 'ref', t.booking_ref, 'date', t.trip_date, 'slot', t.slot, 'status', t.status,
      'response', t.agent_response, 'pickup_area', t.pickup_area, 'pickup_note', t.pickup_note,
      'lat', case when t.agent_response = 'accepted' then t.pickup_lat end,
      'lng', case when t.agent_response = 'accepted' then t.pickup_lng end,
      'homes', t.homes, 'pay', t.fare, 'km', t.distance_km, 'drive_min', t.drive_min, 'wait_min', t.wait_min,
      'pay_after', t.pay_after, 'total', t.total, 'mpesa_code', t.mpesa_code,
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

-- Agent ends the trip: pay-after trips use the client's M-Pesa code, old trips the 4-digit trip code
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
  if t.pay_after then
    if upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) !~ '^[A-Z0-9]{8,12}$' then return jsonb_build_object('ok', false, 'error', 'bad_mpesa'); end if;
    begin
      return public.finish_paid_trip(t, p_code);
    exception when others then
      return jsonb_build_object('ok', false, 'error', case when sqlerrm = 'used_mpesa' then 'used_mpesa' else 'bad_mpesa' end);
    end;
  end if;
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

-- Agent flags a problem (adds 'unpaid': the client hasn't paid at the end)
create or replace function public.agent_report(p_trip bigint, p_issue text, p_note text, p_lat numeric, p_lng numeric)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_issue not in ('no_code', 'no_show', 'unpaid', 'other') then raise exception 'bad_issue'; end if;
  update public.trips set issue = p_issue, issue_note = nullif(left(btrim(coalesce(p_note, '')), 500), ''), issue_at = now(),
         issue_lat = p_lat, issue_lng = p_lng
   where id = p_trip and agent_id = public.my_agent_id() and status = 'confirmed' and agent_response = 'accepted';
  return found;
end $$;
revoke all on function public.agent_report(bigint, text, text, numeric, numeric) from public, anon;
grant execute on function public.agent_report(bigint, text, text, numeric, numeric) to authenticated;
