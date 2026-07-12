-- ar_projects: a creator's project, either the legacy image-target mode or
-- the new markerless-surface mode.

create table public.ar_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  slug text unique not null,
  mode text not null default 'markerless_surface',
  status text not null default 'draft',
  thumbnail_path text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ar_projects_mode_check check (mode in ('image_target', 'markerless_surface')),
  constraint ar_projects_status_check check (status in (
    'draft', 'uploading', 'generating', 'generated', 'editing',
    'ready', 'published', 'generation_failed', 'archived'
  )),
  constraint ar_projects_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index ar_projects_owner_id_idx on public.ar_projects (owner_id);
create index ar_projects_status_idx on public.ar_projects (status);

alter table public.ar_projects enable row level security;

create trigger ar_projects_set_updated_at
  before update on public.ar_projects
  for each row execute function public.set_updated_at();

-- RLS: a creator can only see, create, edit and delete their own projects.
-- Anonymous users have no policy here at all — draft project rows are
-- never readable by the public viewer, which instead reads only the
-- publications table (see 0008_publications.sql).
create policy "ar_projects_owner_select"
  on public.ar_projects for select
  using (auth.uid() = owner_id);

create policy "ar_projects_owner_insert"
  on public.ar_projects for insert
  with check (auth.uid() = owner_id);

create policy "ar_projects_owner_update"
  on public.ar_projects for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "ar_projects_owner_delete"
  on public.ar_projects for delete
  using (auth.uid() = owner_id);
