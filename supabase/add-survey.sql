-- Run once in Supabase -> SQL Editor. Creates the field survey table used by
-- admin.html -> Field survey. Only admins (the admins list) can add, read or
-- delete interviews; website visitors cannot see or write anything here.
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
