-- generation_jobs: one row per image-to-3D provider submission. Written
-- exclusively by the service-role backend (Edge Functions) — never
-- directly by the browser — so this table grants the authenticated role
-- read-only access.

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ar_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  external_job_id text,
  input_mode text not null,
  status text not null default 'queued',
  progress integer not null default 0,
  request_payload jsonb not null default '{}',
  result_metadata jsonb not null default '{}',
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generation_jobs_status_check check (status in (
    'queued', 'uploading', 'submitted', 'processing',
    'completed', 'failed', 'cancelled', 'expired'
  )),
  constraint generation_jobs_input_mode_check check (input_mode in (
    'single_image', 'multi_view', 'glb_upload'
  )),
  constraint generation_jobs_progress_range check (progress between 0 and 100)
);

create index generation_jobs_project_id_idx on public.generation_jobs (project_id);
create index generation_jobs_owner_id_idx on public.generation_jobs (owner_id);
create index generation_jobs_status_idx on public.generation_jobs (status);

-- Database-level half of generation idempotency: at most one job may be in
-- a non-terminal state per project at a time. The Edge Function that
-- creates jobs must additionally check this before insert and return the
-- existing job instead of erroring, so a double-tapped "Generate" button
-- degrades to a no-op rather than a failed request.
create unique index generation_jobs_one_active_per_project
  on public.generation_jobs (project_id)
  where status in ('queued', 'uploading', 'submitted', 'processing');

alter table public.generation_jobs enable row level security;

create trigger generation_jobs_set_updated_at
  before update on public.generation_jobs
  for each row execute function public.set_updated_at();

create policy "generation_jobs_owner_select"
  on public.generation_jobs for select
  using (auth.uid() = owner_id);
