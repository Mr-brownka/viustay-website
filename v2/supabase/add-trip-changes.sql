-- ============================================================
-- Viustay: clients change or cancel their viewing trip in the app.
-- Run once in Supabase -> SQL Editor -> New query -> Run, AFTER add-pay-after.sql.
-- Safe to run again.
--
-- Rule: changes and cancellations are allowed in the app up to 36 hours before the trip
-- (admin -> Fare settings: "change_lock_hours"). After that the client WhatsApps or calls us.
-- Changing the day or time sends the trip back to "booked" (we re-check the homes and re-assign an agent).
-- Changing only the pickup, name or phone keeps the agent; they see the new details on their page.
-- ============================================================

alter table public.trips add column if not exists changed_at timestamptz;

update public.app_settings set value = value || '{"change_lock_hours": 36}'::jsonb
 where key = 'trip' and not (value ? 'change_lock_hours');

-- When the trip starts (Nairobi time)
create or replace function public.trip_start(t public.trips)
returns timestamp language sql stable as $$ select t.trip_date + (t.slot)::time; $$;

create or replace function public.trip_can_change(t public.trips, s jsonb)
returns boolean language sql stable as $$
  select t.status in ('booked', 'confirmed')
     and public.nairobi_now() < public.trip_start(t) - make_interval(hours => coalesce((s->>'change_lock_hours')::int, 36));
$$;

-- Client changes the trip (only the fields sent are changed)
create or replace function public.update_trip(p_ref text, p_phone text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s jsonb := public.trip_settings();
  t public.trips;
  agents int := (select count(*) from public.agents where active);
  v_name text; v_phone text; v_day date; v_slot text; v_area text; v_note text; v_lat numeric; v_lng numeric; v_km numeric;
  n int; v_fare int; moved boolean;
begin
  select * into t from public.trips where booking_ref = upper(btrim(p_ref)) and public.phone_key(client_phone) = public.phone_key(p_phone) for update;
  if not found then raise exception 'not_found'; end if;
  if not public.trip_can_change(t, s) then raise exception 'locked'; end if;

  v_name  := btrim(coalesce(p->>'name', t.client_name));
  v_phone := btrim(coalesce(p->>'phone', t.client_phone));
  v_day   := coalesce((p->>'date')::date, t.trip_date);
  v_slot  := coalesce(p->>'slot', t.slot);
  v_area  := coalesce(p->>'pickup_area', t.pickup_area);
  v_note  := case when p ? 'pickup_note' then nullif(left(btrim(coalesce(p->>'pickup_note', '')), 200), '') else t.pickup_note end;
  v_lat   := coalesce(nullif(p->>'pickup_lat', '')::numeric, t.pickup_lat);
  v_lng   := coalesce(nullif(p->>'pickup_lng', '')::numeric, t.pickup_lng);
  v_km    := coalesce(round((p->>'distance_km')::numeric, 1), t.distance_km);
  n := jsonb_array_length(t.homes);

  if char_length(v_name) not between 1 and 120 then raise exception 'bad_name'; end if;
  if length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 9 and 13 then raise exception 'bad_phone'; end if;
  if v_km is null or v_km < 0.5 or v_km > 150 then raise exception 'bad_distance'; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(s->'pickups', '[]'::jsonb)) x where x->>'name' = v_area) then raise exception 'bad_pickup'; end if;
  if v_lat is not null and (v_lat not between -1.75 and -0.95 or v_lng not between 36.45 and 37.25) then raise exception 'bad_pickup'; end if;
  if not ((s->'slots') ? v_slot) then raise exception 'bad_slot'; end if;

  moved := v_day <> t.trip_date or v_slot <> t.slot;
  if moved then
    if v_day < public.earliest_trip_day(s) or v_day > public.earliest_trip_day(s) + coalesce((s->>'calendar_days')::int, 60)
       or (s->'closed_days') @> to_jsonb(extract(dow from v_day)::int) then raise exception 'bad_date'; end if;
    perform pg_advisory_xact_lock(hashtext('trip-slot' || v_day::text));
    if (select count(*) from public.trips x where x.id <> t.id and x.trip_date = v_day and x.slot = v_slot and public.trip_holds_slot(x, s)) >= agents
       or (select count(*) from public.trips x where x.id <> t.id and x.trip_date = v_day and public.trip_holds_slot(x, s)) >= agents * (s->>'trips_per_agent_day')::int
    then raise exception 'slot_full'; end if;
  end if;

  v_fare := public.trip_fare(v_km, n, s);
  update public.trips set
    client_name = v_name, client_phone = v_phone, trip_date = v_day, slot = v_slot,
    pickup_area = v_area, pickup_note = v_note, pickup_lat = round(v_lat, 6), pickup_lng = round(v_lng, 6),
    distance_km = v_km, drive_min = round(v_km / greatest((s->>'speed_kmh')::numeric, 1) * 60),
    fare = v_fare, total = v_fare + viewing_fee, changed_at = now(),
    status = case when moved then 'booked' else status end,
    agent_id = case when moved then null else agent_id end,
    agent_response = case when moved then null else agent_response end
  where id = t.id;

  update public.viewings set viewing_date = v_day, viewing_time = v_slot, tenant_name = v_name, tenant_phone = v_phone
   where booking_ref = t.booking_ref;

  return jsonb_build_object('ref', t.booking_ref, 'date', v_day, 'slot', v_slot, 'fare', v_fare, 'total', v_fare + t.viewing_fee,
                            'status', case when moved then 'booked' else t.status end, 'phone', v_phone);
end $$;
grant execute on function public.update_trip(text, text, jsonb) to anon, authenticated;

-- Client cancels the trip
create or replace function public.cancel_trip(p_ref text, p_phone text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  s jsonb := public.trip_settings();
  t public.trips;
begin
  select * into t from public.trips where booking_ref = upper(btrim(p_ref)) and public.phone_key(client_phone) = public.phone_key(p_phone) for update;
  if not found then raise exception 'not_found'; end if;
  if not public.trip_can_change(t, s) then raise exception 'locked'; end if;
  update public.trips set status = 'cancelled', changed_at = now() where id = t.id;
  update public.viewings set status = 'cancelled' where booking_ref = t.booking_ref;
  return true;
end $$;
grant execute on function public.cancel_trip(text, text) to anon, authenticated;

-- "My bookings": adds can_change, change_until and the pickup pin
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
    'ref', t.booking_ref, 'name', t.client_name, 'phone', t.client_phone, 'status',
      case when t.status = 'awaiting_payment' and not public.trip_holds_slot(t, s) then 'expired' else t.status end,
    'pay_after', t.pay_after, 'today', public.nairobi_now()::date,
    'date', t.trip_date, 'slot', t.slot, 'pickup_area', t.pickup_area, 'pickup_note', t.pickup_note,
    'pickup_lat', t.pickup_lat, 'pickup_lng', t.pickup_lng, 'homes', t.homes,
    'fare', t.fare, 'viewing_fee', t.viewing_fee, 'total', t.total, 'mpesa_code', t.mpesa_code,
    'till', s->>'till', 'pay_name', s->>'pay_name',
    'can_change', public.trip_can_change(t, s),
    'change_until', public.trip_start(t) - make_interval(hours => coalesce((s->>'change_lock_hours')::int, 36)),
    'lock_hours', coalesce((s->>'change_lock_hours')::int, 36),
    'expires_at', t.created_at + make_interval(mins => (s->>'pay_window_min')::int),
    'code', case when not t.pay_after and t.status in ('paid', 'confirmed') then t.trip_code end,
    'agent', case when a.id is not null then jsonb_build_object('name', a.name, 'phone', a.phone, 'car', a.car, 'plate', a.plate, 'photo_url', a.photo_url) end,
    'rating', t.rating);
end $$;
grant execute on function public.lookup_trip(text, text) to anon, authenticated;
