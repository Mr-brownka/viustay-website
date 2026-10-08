-- Run once in Supabase -> SQL Editor. Creates the admin list and lets admins
-- see and update all leads from admin.html. Add more admins with:
--   insert into public.admins (email) values ('someone@example.com');
create table if not exists public.admins (
  email      text primary key,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
insert into public.admins (email) values ('abdiwayne27@gmail.com') on conflict do nothing;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admins a where lower(a.email) = lower(auth.jwt() ->> 'email'));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy "admins read viewings"     on public.viewings             for select to authenticated using (public.is_admin());
create policy "admins update viewings"   on public.viewings             for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read requests"     on public.home_requests        for select to authenticated using (public.is_admin());
create policy "admins update requests"   on public.home_requests        for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read submissions"  on public.property_submissions for select to authenticated using (public.is_admin());
create policy "admins update submissions" on public.property_submissions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read messages"     on public.contact_messages     for select to authenticated using (public.is_admin());
create policy "admins update messages"   on public.contact_messages     for update to authenticated using (public.is_admin()) with check (public.is_admin());
