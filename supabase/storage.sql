-- Game videos. Run this once in the Supabase dashboard (SQL Editor), after schema.sql.
-- Safe to run again: it updates the bucket and recreates the policies.
-- The bucket is PUBLIC so visitors can watch without signing in. Only accounts listed in
-- public.admins can upload, replace or delete. 50 MB is the free plan cap per file.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-videos', 'game-videos', true, 52428800,
        array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'])
on conflict (id) do update
  set public = true,
      file_size_limit = 52428800,
      allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];

drop policy if exists "anyone can watch game videos" on storage.objects;
create policy "anyone can watch game videos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'game-videos');

drop policy if exists "editors can upload game videos" on storage.objects;
create policy "editors can upload game videos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'game-videos' and exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "editors can replace game videos" on storage.objects;
create policy "editors can replace game videos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'game-videos' and exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (bucket_id = 'game-videos' and exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "editors can delete game videos" on storage.objects;
create policy "editors can delete game videos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'game-videos' and exists (select 1 from public.admins a where a.user_id = auth.uid()));
