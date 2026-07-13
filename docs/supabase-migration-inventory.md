# Supabase migration inventory

**Execution status (applies to every row below): syntax-validated only.**
Each file has been parsed with `libpg-query` (the C parser Postgres itself
uses), but **none has been executed against a real Supabase project** — no
project exists yet and this development sandbox cannot reach `supabase.com`.
Do not treat any of these as deployed.

Migrations are forward-only and must run in numerical order; later files
reference objects created by earlier ones (dependencies listed per row).

| # | File | Tables created | Policies created | Storage changes | Functions / triggers | Depends on |
|---|------|----------------|------------------|-----------------|----------------------|------------|
| 0001 | `0001_extensions_and_helpers.sql` | — | — | — | `pgcrypto` extension; `set_updated_at()` trigger fn | — |
| 0002 | `0002_profiles.sql` | `profiles` | select-own, update-own | — | `handle_new_user()` (security definer) + trigger on `auth.users` insert; `updated_at` trigger | 0001 |
| 0003 | `0003_ar_projects.sql` | `ar_projects` | owner select/insert/update/delete | — | `updated_at` trigger | 0001 |
| 0004 | `0004_project_source_images.sql` | `project_source_images` | owner select/update/delete; insert also verifies project ownership | — | — | 0003 |
| 0005 | `0005_generation_jobs.sql` | `generation_jobs` | owner **select only** (writes are service-role) | — | `updated_at` trigger; partial unique index: one active job per project | 0003 |
| 0006 | `0006_generated_models.sql` | `generated_models` | owner **select only** | — | `updated_at` trigger | 0003, 0005 |
| 0007 | `0007_scene_settings.sql` | `scene_settings` | owner select/insert/update | — | `updated_at` trigger | 0003, 0006 |
| 0008 | `0008_publications.sql` | `publications` | owner select-all; public select of `is_active = true` rows only | — | partial unique index: one active publication per project | 0003 |
| 0009 | `0009_viewer_events.sql` | `viewer_events` | owner select via join to `ar_projects`; public insert validated against an active publication | — | — | 0003, 0008 |
| 0010 | `0010_storage_buckets_and_policies.sql` | — | 3 policies on `storage.objects` | Buckets: `source-images-private` (private, owner CRUD by uid path prefix), `generated-models-private` (private, owner read-only), `published-ar-assets` (public read, service-role-only write) | — | 0001 |
| 0012 | `0012_project_wizard_columns.sql` | — (alters `ar_projects`) | — | — | — | 0003 |
| 0011 | `0011_grants.sql` | — | — | — | — (GRANT statements; RLS policies are unreachable without them) | all above |

> 0012 is listed before 0011 in the table only to group schema before
> grants conceptually; **execution order is strictly numeric:
> 0001 → 0011, then 0012.** 0012 was added in Batch 2 and only alters
> `ar_projects` (adds `source_method` and `wizard_stage` columns with check
> constraints), so it is safe to run after 0011 on a database that already
> executed 0001–0011.

## Setup path A — Supabase CLI (run on your machine, not in this sandbox)

```
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```

`supabase db push` applies everything in `supabase/migrations/` in filename
order and records what has run, so re-running it later applies only new
files (e.g. 0012 if you had already pushed 0001–0011).

## Setup path B — Supabase SQL editor

Open the project's SQL editor and paste/run each file's contents in
numerical order, 0001 through 0012, one file at a time. If a file fails,
stop and fix before continuing — later files assume earlier ones succeeded.

## Rules

- Never edit a migration that has been executed anywhere; add a new
  numbered file instead.
- Nothing in this repo runs destructive database commands automatically,
  and none of these migrations contains `drop`/`truncate`.
- After executing, update the status line at the top of this file to record
  when and against which project ref the migrations ran.
