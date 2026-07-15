-- Fix published-ar-assets owner write policies.
--
-- Bug: migration 0013 used unqualified `name` inside an EXISTS subquery on
-- ar_projects. Postgres resolved `name` to ar_projects.name (the human
-- title), not storage.objects.name (the object path). The WITH CHECK then
-- compared the project UUID to foldername(project_title) and always failed,
-- producing: "new row violates row-level security policy" on publish upload.
--
-- Fix: fully qualify storage.objects.name in every published-assets policy.

drop policy if exists "published_assets_owner_write" on storage.objects;
drop policy if exists "published_assets_owner_update" on storage.objects;
drop policy if exists "published_assets_owner_delete" on storage.objects;

create policy "published_assets_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'published-ar-assets'
    and exists (
      select 1 from public.ar_projects p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and p.owner_id = auth.uid()
    )
  );

create policy "published_assets_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'published-ar-assets'
    and exists (
      select 1 from public.ar_projects p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and p.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'published-ar-assets'
    and exists (
      select 1 from public.ar_projects p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and p.owner_id = auth.uid()
    )
  );

create policy "published_assets_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'published-ar-assets'
    and exists (
      select 1 from public.ar_projects p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and p.owner_id = auth.uid()
    )
  );
