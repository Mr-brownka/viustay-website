-- ============================================================
-- Viustay: upload listing photos straight from admin.html -> Buildings (no GitHub step).
-- Run once in Supabase -> SQL Editor -> New query -> Run, AFTER add-publish.sql.
-- Safe to run again.
--
-- Creates a public photo folder ("bucket") called listing-photos (Supabase free plan: 1 GB).
-- Everyone can see the photos (they are on the homes page); only admins can add or remove them.
-- Photos are shrunk on the phone before upload (about 200-400 KB each).
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "anyone sees listing photos" on storage.objects;
create policy "anyone sees listing photos" on storage.objects for select to anon, authenticated
  using (bucket_id = 'listing-photos');

drop policy if exists "admins add listing photos" on storage.objects;
create policy "admins add listing photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and public.is_admin());

drop policy if exists "admins change listing photos" on storage.objects;
create policy "admins change listing photos" on storage.objects for update to authenticated
  using (bucket_id = 'listing-photos' and public.is_admin()) with check (bucket_id = 'listing-photos' and public.is_admin());

drop policy if exists "admins remove listing photos" on storage.objects;
create policy "admins remove listing photos" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and public.is_admin());
