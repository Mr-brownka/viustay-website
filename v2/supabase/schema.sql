-- ============================================================
-- Viustay database. Paste this whole file into Supabase:
-- Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run once on a new project.
-- ============================================================

-- ---------- 1. Leads that come in from the website ----------

-- One row per home in a viewing booking (a booking of 3 homes = 3 rows, same booking_ref)
create table public.viewings (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  booking_ref   text not null,
  listing_id    text not null,
  building_code text,
  listing_title text,
  rent          integer,
  viewing_date  date not null,
  viewing_time  text not null,
  tenant_name   text not null check (char_length(tenant_name) between 1 and 120),
  tenant_phone  text not null check (char_length(tenant_phone) between 9 and 20),
  search        jsonb,
  status        text not null default 'new' check (status in ('new', 'confirmed', 'done', 'cancelled')),
  admin_notes   text
);

-- "No match yet, find it for me" requests
create table public.home_requests (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name       text not null check (char_length(name) between 1 and 120),
  phone      text not null check (char_length(phone) between 9 and 20),
  details    text check (char_length(details) <= 1000),
  search     jsonb,
  status     text not null default 'new' check (status in ('new', 'contacted', 'placed', 'closed'))
);

-- "List your property" submissions from owners, managers and caretakers
create table public.property_submissions (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  role           text not null,
  building_name  text not null check (char_length(building_name) between 1 and 160),
  location       text not null check (char_length(location) between 1 and 200),
  units          jsonb not null,
  contact_name   text not null check (char_length(contact_name) between 1 and 120),
  contact_phone  text not null check (char_length(contact_phone) between 9 and 20),
  contact_email  text,
  visit_date     date,
  status         text not null default 'new' check (status in ('new', 'visit booked', 'listed', 'declined'))
);

-- ---------- 2. What you (Viustay) set up after visiting a building ----------

-- owner_email links a building to the manager's dashboard login
create table public.buildings (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  code        text not null unique,          -- same as building_code in the Google Sheet, e.g. KIL-01
  name        text not null,
  location    text,
  owner_email text,                          -- the manager's login email (lower case)
  caretaker   text,
  notes       text
);

create table public.units (
  id           bigint generated always as identity primary key,
  building_id  bigint not null references public.buildings(id) on delete cascade,
  label        text not null,                -- e.g. A1
  type         text not null,                -- e.g. 1 bedroom
  rent         integer,
  status       text not null default 'vacant' check (status in ('vacant', 'let')),
  vacant_since date,
  listing_id   text                          -- the id in the Google Sheet, e.g. VS-001
);

create table public.placements (
  id           bigint generated always as identity primary key,
  building_id  bigint not null references public.buildings(id) on delete cascade,
  unit_label   text not null,
  tenant_name  text,                         -- never shown to managers
  lease_signed date,
  move_in      date,
  fee_amount   integer,
  status       text not null default 'due' check (status in ('due', 'paid')),
  receipt_no   text
);

-- ---------- 3. Security rules (Row Level Security) ----------
alter table public.viewings             enable row level security;
alter table public.home_requests        enable row level security;
alter table public.property_submissions enable row level security;
alter table public.buildings            enable row level security;
alter table public.units                enable row level security;
alter table public.placements           enable row level security;

-- Website visitors can ADD leads but never read them back
create policy "public can create viewings"   on public.viewings             for insert to anon, authenticated with check (status = 'new' and admin_notes is null);
create policy "public can create requests"   on public.home_requests        for insert to anon, authenticated with check (status = 'new');
create policy "public can submit properties" on public.property_submissions for insert to anon, authenticated with check (status = 'new');

-- Managers can READ only their own buildings, units and placements
create policy "managers read own buildings" on public.buildings for select to authenticated
  using (lower(owner_email) = lower(auth.jwt() ->> 'email'));
create policy "managers read own units" on public.units for select to authenticated
  using (building_id in (select id from public.buildings where lower(owner_email) = lower(auth.jwt() ->> 'email')));
create policy "managers read own placements" on public.placements for select to authenticated
  using (building_id in (select id from public.buildings where lower(owner_email) = lower(auth.jwt() ->> 'email')));

-- Managers see viewings for their buildings WITHOUT tenant names or phone numbers
create or replace function public.my_viewings()
returns table (viewing_date date, viewing_time text, listing_id text, listing_title text, status text)
language sql
security definer
set search_path = public
stable
as $$
  select v.viewing_date, v.viewing_time, v.listing_id, v.listing_title, v.status
  from public.viewings v
  join public.buildings b on b.code = v.building_code
  where lower(b.owner_email) = lower(auth.jwt() ->> 'email')
    and v.status <> 'cancelled'
  order by v.viewing_date desc
  limit 500;
$$;
revoke all on function public.my_viewings() from public, anon;
grant execute on function public.my_viewings() to authenticated;

-- Hide placement tenant names from managers (they only need unit, dates, fee, status)
revoke select on public.placements from anon, authenticated;
grant select (id, building_id, unit_label, lease_signed, move_in, fee_amount, status, receipt_no) on public.placements to authenticated;

-- You (the admin) see and edit everything in Supabase -> Table Editor,
-- which bypasses these rules. Nothing else is needed.

-- ---------- 4. Contact page messages ----------
create table public.contact_messages (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name       text not null check (char_length(name) between 1 and 120),
  phone      text not null check (char_length(phone) between 9 and 20),
  kind       text,
  message    text not null check (char_length(message) between 1 and 2000),
  status     text not null default 'new' check (status in ('new', 'replied', 'closed'))
);
alter table public.contact_messages enable row level security;
create policy "public can send contact messages" on public.contact_messages
  for insert to anon, authenticated with check (status = 'new');

-- Field survey (also in add-survey.sql)
create table if not exists public.survey_responses (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  type        text not null check (type in ('fam', 'ind')),
  place       text,
  answers     jsonb not null default '{}'::jsonb,
  created_by  text default (auth.jwt() ->> 'email')
);
create index if not exists survey_responses_created_at on public.survey_responses (created_at desc);

alter table public.survey_responses enable row level security;
revoke all on public.survey_responses from anon;
grant select, insert, delete on public.survey_responses to authenticated;

create policy "admins add survey"    on public.survey_responses for insert to authenticated with check (public.is_admin());
create policy "admins read survey"   on public.survey_responses for select to authenticated using (public.is_admin());
create policy "admins delete survey" on public.survey_responses for delete to authenticated using (public.is_admin());
