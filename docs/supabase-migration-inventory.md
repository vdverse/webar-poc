# Supabase migration inventory

**Execution status:** migrations `0001`–`0013` have been applied to Supabase
project ref `codqgrxradxaloruoyys` (2026-07-14 / 2026-07-15). Schema, RLS and
buckets for Batch 1–2 were verified after `db push`. Migration `0013` adds
temporary owner write policies for direct-GLB upload and browser publish until
Edge Functions exist. Do not silently re-edit applied files — add forward
migrations only.

Migrations are forward-only and must run in numerical order; later files
reference objects created by earlier ones (dependencies listed per row).

All 12 files were re-validated with `libpg-query` at the end of Batch 2
(0001–0011: 2–10 statements each, all `OK`; 0012: 2 statements, `OK`). 0012
was confirmed not to duplicate any column defined in 0003 — it is the sole
definer of `source_method` and `wizard_stage`, only `ALTER`s `ar_projects`
(so it inherits that table's existing RLS and `updated_at` trigger), and
adds two check constraints. It is safe to apply on a fresh project after
0001–0011 and safe to apply to a database that already ran Batch 1.

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
| 0011 | `0011_grants.sql` | — | — | — | — (GRANT statements; RLS policies are unreachable without them) | all above through 0010 |
| 0012 | `0012_project_wizard_columns.sql` | — (alters `ar_projects`) | — | — | — | 0003 |
| 0013 | `0013_creator_publish_write_policies.sql` | — | owner insert/update on `generated_models` + `publications`; storage write policies for `generated-models-private` and `published-ar-assets` | Temporary creator write path for the GLB publish slice (Edge Functions later) | 0006, 0008, 0010, 0011 |

> **Execution order is strictly numeric: 0001 → 0013.** 0012 only alters
> `ar_projects`. 0013 is required for the browser-side GLB publish slice and
> is safe only after 0010–0011.

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
numerical order, 0001 through 0013, one file at a time. If a file fails,
stop and fix before continuing — later files assume earlier ones succeeded.

## Rules

- Never edit a migration that has been executed anywhere; add a new
  numbered file instead.
- Nothing in this repo runs destructive database commands automatically,
  and none of these migrations contains `drop`/`truncate`.
- After executing, update the status line at the top of this file to record
  when and against which project ref the migrations ran.
