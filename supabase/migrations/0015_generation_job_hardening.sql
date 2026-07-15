-- Batch 3A: harden generation_jobs for provider lifecycle.
-- 0005 already created the table + one-active-job index + owner SELECT.
-- Browser still must not write status/results; Edge Functions use service role.

alter table public.generation_jobs
  add column if not exists stage text,
  add column if not exists attempts integer not null default 0,
  add column if not exists request_hash text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists safe_error_code text,
  add column if not exists safe_error_message text;

comment on column public.generation_jobs.stage is
  'Honest human-readable stage for UI (e.g. submitting, processing, validating).';
comment on column public.generation_jobs.request_hash is
  'Idempotency fingerprint of project + source image set + mode.';
comment on column public.generation_jobs.safe_error_code is
  'User-safe error code; never raw provider internals.';
comment on column public.generation_jobs.safe_error_message is
  'User-safe error message.';

-- Align status enum with provider-neutral lifecycle (keep legacy values).
alter table public.generation_jobs
  drop constraint if exists generation_jobs_status_check;

alter table public.generation_jobs
  add constraint generation_jobs_status_check check (status in (
    'queued',
    'uploading',
    'submitted',
    'processing',
    'completed',
    'failed',
    'cancelled',
    'expired'
  ));

create index if not exists generation_jobs_request_hash_idx
  on public.generation_jobs (owner_id, request_hash)
  where request_hash is not null;

create index if not exists generation_jobs_external_job_id_idx
  on public.generation_jobs (provider, external_job_id)
  where external_job_id is not null;

-- Entitlement uses existing profiles.generation_credits (see 0002).
-- Edge Functions decrement credits server-side; never trust the browser.
