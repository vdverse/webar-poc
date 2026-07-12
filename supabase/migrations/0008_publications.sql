-- publications: immutable, versioned public snapshots. The public /view and
-- /ar routes read only from this table, never from ar_projects,
-- scene_settings or generated_models directly, so draft edits never leak
-- and a publish can be rolled back by flipping is_active.

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ar_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  public_slug text unique not null,
  version integer not null,
  snapshot jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint publications_public_slug_format check (public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint publications_version_positive check (version > 0),
  unique (project_id, version)
);

create index publications_project_id_idx on public.publications (project_id);
create index publications_owner_id_idx on public.publications (owner_id);

-- At most one active publication per project. Publishing a new version must
-- deactivate the previous one in the same transaction (enforced by the
-- publish Edge Function, not just this index) so the public route never has
-- two "active" snapshots to choose between.
create unique index publications_one_active_per_project
  on public.publications (project_id)
  where is_active;

alter table public.publications enable row level security;

-- Owners can see their full publication history, including inactive
-- versions, for the version-history feature planned for a later batch.
create policy "publications_owner_select"
  on public.publications for select
  using (auth.uid() = owner_id);

-- Anonymous and authenticated viewers may read only the single active
-- snapshot for a project — never draft/editor state and never an inactive
-- version. The snapshot's own JSON shape is validated server-side at
-- publish time to exclude private fields (owner email, storage service
-- paths, provider job ids); see docs/image-to-3d-ar-plan.md.
create policy "publications_public_active_select"
  on public.publications for select
  using (is_active = true);

-- No insert/update/delete policy is granted to authenticated or anon:
-- publications are written exclusively by the service-role publish
-- transaction.
