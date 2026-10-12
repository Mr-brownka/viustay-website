-- Run once in Supabase -> SQL Editor (adds the Contact page form table)
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
