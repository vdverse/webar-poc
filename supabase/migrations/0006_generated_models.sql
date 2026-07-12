-- generated_models: a validated, server-downloaded GLB (plus optional USDZ)
-- ready for preview/publication. Written exclusively by the service-role
-- backend after download and inspection.

create table public.generated_models (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ar_projects(id) on delete cascade,
  generation_job_id uuid references public.generation_jobs(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  glb_storage_path text not null,
  usdz_storage_path text,
  thumbnail_storage_path text,
  original_provider_url text,
  file_size_bytes bigint,
  triangle_count bigint,
  mesh_count integer,
  material_count integer,
  texture_count integer,
  animation_names jsonb not null default '[]',
  bounds jsonb not null default '{}',
  metadata jsonb not null default '{}',
  processing_status text not null default 'ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generated_models_processing_status_check check (processing_status in (
    'ready', 'validating', 'invalid'
  ))
);

create index generated_models_project_id_idx on public.generated_models (project_id);
create index generated_models_owner_id_idx on public.generated_models (owner_id);

alter table public.generated_models enable row level security;

create trigger generated_models_set_updated_at
  before update on public.generated_models
  for each row execute function public.set_updated_at();

create policy "generated_models_owner_select"
  on public.generated_models for select
  using (auth.uid() = owner_id);
