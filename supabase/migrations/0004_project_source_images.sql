-- project_source_images: the supplier's raw uploaded photos, stored
-- privately and never copied into the public bucket.

create table public.project_source_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ar_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  original_filename text,
  mime_type text,
  file_size_bytes bigint,
  width integer,
  height integer,
  angle_label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index project_source_images_project_id_idx on public.project_source_images (project_id);
create index project_source_images_owner_id_idx on public.project_source_images (owner_id);

alter table public.project_source_images enable row level security;

create policy "project_source_images_owner_select"
  on public.project_source_images for select
  using (auth.uid() = owner_id);

-- Insert additionally requires the referenced project to belong to the
-- same user, so a row cannot be attached to someone else's project even if
-- owner_id is (incorrectly) set to the caller's own id.
create policy "project_source_images_owner_insert"
  on public.project_source_images for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.ar_projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

-- Update is limited to reordering/labelling (sort_order, angle_label) by
-- the wizard's review step; the client only ever sends those two columns,
-- enforced at the application layer since RLS does not restrict columns.
create policy "project_source_images_owner_update"
  on public.project_source_images for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "project_source_images_owner_delete"
  on public.project_source_images for delete
  using (auth.uid() = owner_id);
