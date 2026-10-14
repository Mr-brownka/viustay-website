-- ============================================================
-- Viustay: short-stay guests give their M-Pesa number and get a payment request.
-- Run once in Supabase -> SQL Editor -> New query -> Run, AFTER add-stays.sql.
-- Safe to run again.
--
-- For now (no till/paybill yet): the request lands in admin -> Short stays ("Needs action").
-- When the money arrives, tap "Payment received" there; the guest's screen turns to "Paid" by itself.
-- Later, when we have a till + Safaricom Daraja (or IntaSend / Kopo Kopo), request_stay_payment
-- will also send the real M-Pesa prompt, and the payment callback will mark the stay paid automatically.
-- ============================================================

alter table public.stays add column if not exists mpesa_phone      text;
alter table public.stays add column if not exists pay_requested_at timestamptz;
alter table public.stays add column if not exists pay_requests     int not null default 0;

create or replace function public.request_stay_payment(p_ref text, p_phone text, p_mpesa_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb := public.trip_settings();
  s public.stays;
  v_num text := regexp_replace(coalesce(p_mpesa_phone, ''), '[^0-9]', '', 'g');
begin
  select * into s from public.stays where booking_ref = upper(btrim(p_ref)) and public.phone_key(guest_phone) = public.phone_key(p_phone) for update;
  if not found then raise exception 'not_found'; end if;
  if length(v_num) not between 9 and 13 then raise exception 'bad_phone'; end if;
  if s.status in ('paid', 'confirmed', 'checked_in', 'completed') then return jsonb_build_object('ok', true, 'paid', true); end if;
  if s.status <> 'awaiting_payment' then raise exception 'not_open'; end if;
  if s.pay_requests >= 6 then raise exception 'too_many'; end if;
  if not public.stay_holds(s, cfg) then
    perform pg_advisory_xact_lock(hashtext('stay' || s.listing_id));
    if exists (select 1 from public.stays x where x.listing_id = s.listing_id and x.id <> s.id and public.stay_holds(x, cfg)
                 and x.check_in < s.check_out and x.check_out > s.check_in) then raise exception 'dates_taken'; end if;
  end if;
  update public.stays set mpesa_phone = btrim(p_mpesa_phone), pay_requested_at = now(), pay_requests = pay_requests + 1,
         created_at = case when public.stay_holds(s, cfg) then created_at else now() end   -- hold the dates again while they pay
   where id = s.id;
  return jsonb_build_object('ok', true, 'paid', false);
end $$;
grant execute on function public.request_stay_payment(text, text, text) to anon, authenticated;
