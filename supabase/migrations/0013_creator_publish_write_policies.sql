-- Batch 2.5 vertical slice: allow authenticated creators to upload GLB models
-- and publish from the browser until Edge Functions exist (Batch 3/7).
-- Ownership is still enforced via auth.uid() and project ownership checks.
-- Service-role remains able to write; these policies add owner paths only.

-- generated_models: owners may insert/update their own validated uploads
grant insert, update on public.generated_models to authenticated;

create policy "generated_models_owner_insert"
  on public.generated_models for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.ar_projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "generated_models_owner_update"
  on public.generated_models for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- publications: owners may insert snapshots and deactivate prior versions
grant insert, update on public.publications to authenticated;

create policy "publications_owner_insert"
  on public.publications for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.ar_projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "publications_owner_update"
  on public.publications for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- generated-models-private: owners may write under their uid prefix
create policy "generated_models_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'generated-models-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "generated_models_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'generated-models-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'generated-models-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "generated_models_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'generated-models-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- published-ar-assets: owners may write under a project id they own
create policy "published_assets_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'published-ar-assets'
    and exists (
      select 1 from public.ar_projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.owner_id = auth.uid()
    )
  );

create policy "published_assets_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'published-ar-assets'
    and exists (
      select 1 from public.ar_projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'published-ar-assets'
    and exists (
      select 1 from public.ar_projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.owner_id = auth.uid()
    )
  );

create policy "published_assets_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'published-ar-assets'
    and exists (
      select 1 from public.ar_projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.owner_id = auth.uid()
    )
  );
