-- Storage buckets and per-object RLS.
--
-- Path conventions (must match src/lib/storagePaths.ts exactly):
--   source-images-private:   {userId}/{projectId}/{imageId}-{sanitizedFilename}
--   generated-models-private: {userId}/{projectId}/{modelId}.glb
--   published-ar-assets:      {projectId}/{publicationVersion}/{file}
--
-- storage.objects has no owner_id column, so ownership for the two private
-- buckets is read directly out of the first path segment.

insert into storage.buckets (id, name, public)
values
  ('source-images-private', 'source-images-private', false),
  ('generated-models-private', 'generated-models-private', false),
  ('published-ar-assets', 'published-ar-assets', true)
on conflict (id) do nothing;

-- source-images-private: the owning user may read, write and delete only
-- objects under their own uid prefix. Uploads happen directly from the
-- authenticated browser session (not the service role), so this is the one
-- storage bucket regular users can write to at all.
create policy "source_images_owner_all"
  on storage.objects for all
  using (
    bucket_id = 'source-images-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'source-images-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- generated-models-private: written exclusively by the service-role backend
-- after server-side download and validation (see the generation job
-- lifecycle in docs/image-to-3d-ar-plan.md). Regular users may only read
-- their own models, never write here directly.
create policy "generated_models_owner_read"
  on storage.objects for select
  using (
    bucket_id = 'generated-models-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- published-ar-assets: public bucket. Anyone may read (that is the entire
-- point — it serves the public /view and /ar routes), but only the
-- service-role publish transaction may write, so there is no authenticated
-- insert/update/delete policy here.
create policy "published_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'published-ar-assets');
