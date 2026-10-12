-- ============================================================
-- Viustay short stays: hotel-style bookings (dates, guests, pay in full).
-- Run once in Supabase -> SQL Editor -> New query -> Run, AFTER add-agents.sql.
-- Safe to run again.
-- ============================================================

-- Airport / bus-station pickup price (editable in admin -> Fare settings)
update public.app_settings set value = value || '{"airport_pickup_fee": 2500}'::jsonb
 where key = 'trip' and not (value ? 'airport_pickup_fee');

create table if not exists public.stays (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  booking_ref    text not null unique,
  listing_id     text not null,
  listing_title  text,
  area           text,
  guest_name     text not null,
  guest_phone    text not null,
  guests         integer not null,
  check_in       date not null,
  check_out      date not null,
  nights         integer not null,
  night_rate     integer not null,
  cleaning_fee   integer not null default 0,
  pickup         boolean not null default false,
  pickup_fee     integer not null default 0,
  pickup_note    text,
  total          integer not null,
  check_in_time  text,
  check_out_time text,
  mpesa_code     text,
  paid_at        timestamptz,
  status         text not null default 'awaiting_payment'
                 check (status in ('awaiting_payment', 'paid', 'confirmed', 'checked_in', 'completed', 'cancelled', 'expired')),
  checkin_info   text,                       -- address, directions, caretaker, keys: shown to the guest once confirmed
  rating         integer check (rating between 1 and 5),
  rating_note    text,
  admin_notes    text,
  check (check_out > check_in)
);
create index if not exists stays_listing_dates on public.stays (listing_id, check_in, check_out);
alter table public.stays enable row level security;
revoke all on public.stays from anon;
grant select, update on public.stays to authenticated;
drop policy if exists "admins read stays" on public.stays;
create policy "admins read stays" on public.stays for select to authenticated using (public.is_admin());
drop policy if exists "admins update stays" on public.stays;
create policy "admins update stays" on public.stays for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Is this booking holding its dates? (unpaid bookings let go after the payment window)
create or replace function public.stay_holds(s public.stays, cfg jsonb)
returns boolean language sql stable as $$
  select s.status in ('paid', 'confirmed', 'checked_in', 'completed')
      or (s.status = 'awaiting_payment' and s.created_at > now() - make_interval(mins => coalesce((cfg->>'pay_window_min')::int, 30)));
$$;

-- Dates already taken for a listing (no guest details), for the booking calendar
create or replace function public.stay_booked(p_listing text)
returns jsonb language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('from', s.check_in, 'to', s.check_out) order by s.check_in), '[]'::jsonb)
  from public.stays s
  where s.listing_id = p_listing and s.check_out >= public.nairobi_now()::date and public.stay_holds(s, public.trip_settings());
$$;
grant execute on function public.stay_booked(text) to anon, authenticated;

create or replace function public.create_stay(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb := public.trip_settings();
  v_name text := btrim(coalesce(p->>'name', ''));
  v_phone text := btrim(coalesce(p->>'phone', ''));
  v_in date := (p->>'check_in')::date;
  v_out date := (p->>'check_out')::date;
  v_n int := (p->>'check_out')::date - (p->>'check_in')::date;
  v_rate int := (p->>'night_rate')::int;
  v_clean int := coalesce((p->>'cleaning_fee')::int, 0);
  v_min int := greatest(coalesce((p->>'min_nights')::int, 1), 1);
  v_guests int := (p->>'guests')::int;
  v_pick boolean := coalesce((p->>'pickup')::boolean, false);
  v_pfee int := case when coalesce((p->>'pickup')::boolean, false) then coalesce((cfg->>'airport_pickup_fee')::int, 0) else 0 end;
  v_total int; v_ref text;
begin
  if char_length(v_name) not between 1 and 120 then raise exception 'bad_name'; end if;
  if length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 9 and 13 then raise exception 'bad_phone'; end if;
  if coalesce(p->>'listing_id', '') = '' then raise exception 'bad_listing'; end if;
  if v_in is null or v_out is null or v_in < public.nairobi_now()::date or v_in > public.nairobi_now()::date + 365 then raise exception 'bad_dates'; end if;
  if v_n < v_min then raise exception 'min_nights'; end if;
  if v_n > 60 then raise exception 'too_long'; end if;
  if v_guests is null or v_guests not between 1 and 20 then raise exception 'bad_guests'; end if;
  if v_rate is null or v_rate not between 500 and 500000 or v_clean not between 0 and 100000 then raise exception 'bad_price'; end if;

  perform pg_advisory_xact_lock(hashtext('stay' || (p->>'listing_id')));
  if exists (select 1 from public.stays s where s.listing_id = p->>'listing_id' and public.stay_holds(s, cfg)
               and s.check_in < v_out and s.check_out > v_in) then raise exception 'dates_taken'; end if;

  v_total := v_n * v_rate + v_clean + v_pfee;
  loop
    v_ref := 'ST-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.stays where booking_ref = v_ref);
  end loop;
  insert into public.stays (booking_ref, listing_id, listing_title, area, guest_name, guest_phone, guests, check_in, check_out, nights,
                            night_rate, cleaning_fee, pickup, pickup_fee, pickup_note, total, check_in_time, check_out_time)
  values (v_ref, p->>'listing_id', left(p->>'title', 160), left(p->>'area', 80), v_name, v_phone, v_guests, v_in, v_out, v_n,
          v_rate, v_clean, v_pick, v_pfee, nullif(left(btrim(coalesce(p->>'pickup_note', '')), 200), ''), v_total,
          left(p->>'check_in_time', 20), left(p->>'check_out_time', 20));
  return jsonb_build_object('ref', v_ref, 'total', v_total, 'nights', v_n,
                            'expires_at', now() + make_interval(mins => coalesce((cfg->>'pay_window_min')::int, 30)));
end $$;
grant execute on function public.create_stay(jsonb) to anon, authenticated;

create or replace function public.submit_stay_payment(p_ref text, p_phone text, p_mpesa text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb := public.trip_settings();
  s public.stays;
  v_code text := upper(regexp_replace(coalesce(p_mpesa, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select * into s from public.stays where booking_ref = upper(btrim(p_ref)) and public.phone_key(guest_phone) = public.phone_key(p_phone) for update;
  if not found then raise exception 'not_found'; end if;
  if v_code !~ '^[A-Z0-9]{8,12}$' then raise exception 'bad_mpesa'; end if;
  if s.status <> 'awaiting_payment' then
    if s.mpesa_code is not null then return jsonb_build_object('ok', true, 'already', true); end if;
    raise exception 'not_open';
  end if;
  if not public.stay_holds(s, cfg) then
    perform pg_advisory_xact_lock(hashtext('stay' || s.listing_id));
    if exists (select 1 from public.stays x where x.listing_id = s.listing_id and x.id <> s.id and public.stay_holds(x, cfg)
                 and x.check_in < s.check_out and x.check_out > s.check_in) then raise exception 'dates_taken'; end if;
  end if;
  update public.stays set mpesa_code = v_code, paid_at = now(), status = 'paid' where id = s.id;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.submit_stay_payment(text, text, text) to anon, authenticated;

create or replace function public.lookup_stay(p_ref text, p_phone text)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  s public.stays;
  cfg jsonb := public.trip_settings();
begin
  select * into s from public.stays where booking_ref = upper(btrim(p_ref)) and public.phone_key(guest_phone) = public.phone_key(p_phone);
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object(
    'ref', s.booking_ref, 'kind', 'stay', 'name', s.guest_name,
    'status', case when s.status = 'awaiting_payment' and not public.stay_holds(s, cfg) then 'expired' else s.status end,
    'listing_id', s.listing_id, 'title', s.listing_title, 'area', s.area, 'guests', s.guests,
    'check_in', s.check_in, 'check_out', s.check_out, 'nights', s.nights, 'check_in_time', s.check_in_time, 'check_out_time', s.check_out_time,
    'night_rate', s.night_rate, 'cleaning_fee', s.cleaning_fee, 'pickup', s.pickup, 'pickup_fee', s.pickup_fee, 'total', s.total,
    'mpesa_code', s.mpesa_code, 'expires_at', s.created_at + make_interval(mins => coalesce((cfg->>'pay_window_min')::int, 30)),
    'checkin_info', case when s.status in ('confirmed', 'checked_in', 'completed') then s.checkin_info end,
    'rating', s.rating);
end $$;
grant execute on function public.lookup_stay(text, text) to anon, authenticated;

create or replace function public.rate_stay(p_ref text, p_phone text, p_rating int, p_note text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_rating not between 1 and 5 then raise exception 'bad_rating'; end if;
  update public.stays set rating = p_rating, rating_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
   where booking_ref = upper(btrim(p_ref)) and public.phone_key(guest_phone) = public.phone_key(p_phone)
     and status in ('checked_in', 'completed') and rating is null;
  return found;
end $$;
grant execute on function public.rate_stay(text, text, int, text) to anon, authenticated;
