-- ============================================================
-- Viustay: publish a manager's building from admin.html -> Buildings.
-- Run once in Supabase -> SQL Editor -> New query -> Run, AFTER add-buildings.sql.
-- Safe to run again.
--
-- Published units go into a "listings" table that the homes page reads together
-- with your Google Sheet. No sheet editing needed for these.
-- When a manager marks a unit let or pauses it, its listing comes off by itself.
-- ============================================================

create table if not exists public.listings (
  id             text primary key,                 -- e.g. VS-1001 (made for you)
  created_at     timestamptz not null default now(),
  published_at   timestamptz not null default now(),
  building_id    bigint references public.buildings(id) on delete cascade,
  unit_id        bigint references public.units(id) on delete set null,
  status         text not null default 'available' check (status in ('available', 'taken', 'paused')),
  type           text, bedrooms int, bathrooms int, rent int,
  area           text, road text, building_code text, floor text, furnished text,
  amenities      text, available_from text, deposit text, notes text, photos text
);
alter table public.listings enable row level security;
grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;
drop policy if exists "anyone reads live listings" on public.listings;
create policy "anyone reads live listings" on public.listings for select to anon, authenticated using (status = 'available');
drop policy if exists "admins manage listings" on public.listings;
create policy "admins manage listings" on public.listings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Photos saved on the unit (so they can be reused for a same-type unit later)
alter table public.units add column if not exists photos text;

-- Admins see and update every building and unit (managers still see only their own)
grant update on public.buildings, public.units to authenticated;
drop policy if exists "admins read buildings" on public.buildings;
create policy "admins read buildings" on public.buildings for select to authenticated using (public.is_admin());
drop policy if exists "admins update buildings" on public.buildings;
create policy "admins update buildings" on public.buildings for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins read units" on public.units;
create policy "admins read units" on public.units for select to authenticated using (public.is_admin());
drop policy if exists "admins update units" on public.units;
create policy "admins update units" on public.units for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Publish ----------
-- p: {"units": [{"unit_id": 5, "photos": "assets/a.jpg assets/b.jpg", "notes": "...", "bedrooms": 1, "bathrooms": 1,
--                 "amenities": "Borehole;CCTV", "type": "1 bedroom"}], "cover": "assets/a.jpg"}
create or replace function public.admin_publish(p_building bigint, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b public.buildings; u public.units; it jsonb; v_id text; n int; done jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into b from public.buildings where id = p_building for update;
  if not found then raise exception 'not_found'; end if;
  if jsonb_typeof(p->'units') <> 'array' or jsonb_array_length(p->'units') = 0 then raise exception 'no_units'; end if;
  perform pg_advisory_xact_lock(hashtext('listing-ids'));

  for it in select * from jsonb_array_elements(p->'units') loop
    select * into u from public.units where id = (it->>'unit_id')::bigint and building_id = b.id for update;
    if not found then raise exception 'not_found'; end if;
    if char_length(btrim(coalesce(it->>'photos', ''))) < 5 then raise exception 'no_photos'; end if;

    v_id := u.listing_id;
    if v_id is null or v_id = '' then
      select greatest(1000, coalesce(max((substring(id from '^VS-(\d+)$'))::int), 1000)) + 1 into n from public.listings where id ~ '^VS-\d+$';
      v_id := 'VS-' || n;
    end if;

    insert into public.listings as l (id, building_id, unit_id, status, type, bedrooms, bathrooms, rent, area, road, building_code,
                                      floor, furnished, amenities, available_from, deposit, notes, photos, published_at)
    values (v_id, b.id, u.id, case when u.status = 'let' then 'taken' when u.paused then 'paused' else 'available' end,
            coalesce(nullif(it->>'type', ''), u.type), nullif(it->>'bedrooms', '')::int, nullif(it->>'bathrooms', '')::int, u.rent,
            b.location, b.road, b.code, u.floor, u.furnished, nullif(it->>'amenities', ''),
            case when u.available_from is not null and u.available_from > (public.nairobi_now())::date then to_char(u.available_from, 'FMDD Mon') else 'Now' end,
            u.deposit, nullif(btrim(coalesce(it->>'notes', '')), ''), btrim(it->>'photos'), now())
    on conflict (id) do update set
      type = excluded.type, bedrooms = excluded.bedrooms, bathrooms = excluded.bathrooms, rent = excluded.rent,
      area = excluded.area, road = excluded.road, building_code = excluded.building_code, floor = excluded.floor,
      furnished = excluded.furnished, amenities = excluded.amenities, available_from = excluded.available_from,
      deposit = excluded.deposit, notes = excluded.notes, photos = excluded.photos, status = excluded.status, published_at = now();

    update public.units set listing_id = v_id, photos = btrim(it->>'photos'), updated_at = now() where id = u.id;
    done := done || jsonb_build_object('unit_id', u.id, 'listing_id', v_id);
  end loop;

  update public.buildings set status = 'live', updated_at = now(),
    details = case when nullif(p->>'cover', '') is not null and coalesce(details->>'photo_url', '') = '' then details || jsonb_build_object('photo_url', p->>'cover') else details end
  where id = b.id;
  update public.property_submissions set status = 'listed'
   where status in ('new', 'visit booked') and lower(building_name) = lower(b.name) and lower(coalesce(contact_email, '')) = lower(coalesce(b.owner_email, ''));
  return jsonb_build_object('published', done);
end $$;
revoke all on function public.admin_publish(bigint, jsonb) from public, anon;
grant execute on function public.admin_publish(bigint, jsonb) to authenticated;

-- ---------- Keep listings in step with the manager's changes ----------
create or replace function public.sync_listing_from_unit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.listings set
    status = case when new.status = 'let' then 'taken' when new.paused then 'paused' else 'available' end,
    rent = new.rent, deposit = new.deposit, furnished = new.furnished, floor = new.floor
  where unit_id = new.id;
  return new;
end $$;
drop trigger if exists units_sync_listing on public.units;
create trigger units_sync_listing after update of status, paused, rent, deposit, furnished, floor on public.units
  for each row execute function public.sync_listing_from_unit();
