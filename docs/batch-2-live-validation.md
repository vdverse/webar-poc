# Batch 2 live validation

## Status: NOT YET VALIDATED against a live Supabase project

**Important honesty note.** This validation was prepared in a build sandbox
whose network egress is allow-listed to package registries and GitHub only.
`api.supabase.com` returns `403 host_not_allowed` and `*.supabase.co`
connections are refused outright there, and no `.env.local` is present in
that environment. **No migration has been applied, and no live
authentication, CRUD, storage, or cross-user RLS check has been executed by
me.** Everything below is the runbook + tooling to perform that validation on
*your* machine (which has `.env.local` and real network access), plus a
results table to fill in.

Do not merge Batch 2 to `main` until the results table is complete and green.

## Project reference

Record here (no secrets — reference/URL host only, never the anon or
service-role key):

- Project ref / URL host: `__________.supabase.co`
- Email confirmation setting during validation: `on` / `off`
- Date validated: `__________`
- Validated by: `__________`

## 0. Environment preflight

```bash
# from the repo root, on your machine
grep -oE '^[A-Z_]+=' .env.local          # names only; must list the 3 VITE_ vars
git check-ignore .env.local              # must print .env.local (ignored)
git grep -nEi 'service_role|SUPABASE_SERVICE' -- src || echo "no service-role key in src (good)"
```

Expected: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_APP_URL`
present; `.env.local` ignored; no service-role key anywhere in `src/`.

## 1. Apply migrations (choose ONE path)

**Path A — Supabase CLI (recommended):**
```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```
> If `supabase login`/`link` needs interactive auth, that is the one external
> step to do by hand; there is no way around it. `db push` applies
> `supabase/migrations/0001…0012` in order.

**Path B — SQL editor:** paste each file `0001` → `0012` in numerical order,
running one at a time.

## 2. Verify the resulting schema (SQL editor)

Run these and confirm the expected rows. Passing CLI output is **not**
sufficient — confirm the schema itself.

```sql
-- 8 tables present
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles','ar_projects','project_source_images',
    'generation_jobs','generated_models','scene_settings','publications','viewer_events')
order by table_name;                    -- expect 8 rows

-- Batch 2 columns + their check constraints on ar_projects
select column_name from information_schema.columns
where table_name = 'ar_projects' and column_name in ('source_method','wizard_stage'); -- expect 2

select conname from pg_constraint
where conrelid = 'public.ar_projects'::regclass and contype = 'c'
  and conname in ('ar_projects_source_method_check','ar_projects_wizard_stage_check'); -- expect 2

-- RLS enabled on every public table above
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('profiles','ar_projects','project_source_images',
    'generation_jobs','generated_models','scene_settings','publications','viewer_events');
-- relrowsecurity must be true for all

-- updated_at triggers exist
select event_object_table, trigger_name from information_schema.triggers
where trigger_schema = 'public' and action_statement like '%set_updated_at%'
order by event_object_table;

-- the two idempotency indexes
select indexname from pg_indexes where schemaname = 'public'
  and indexname in ('generation_jobs_one_active_per_project','publications_one_active_per_project'); -- expect 2
```

## 3. Verify storage (SQL editor + script)

```sql
-- three buckets; source + generated are private, published is public
select id, public from storage.buckets
where id in ('source-images-private','generated-models-private','published-ar-assets');
-- source-images-private.public = false, generated-models-private.public = false,
-- published-ar-assets.public = true

-- object policies exist on storage.objects
select policyname from pg_policies where schemaname='storage' and tablename='objects';
```

If `source-images-private` is missing, re-run migration `0010`. Do **not**
make it public.

## 4. Run the automated validation script

This exercises auth + CRUD + storage + cross-user RLS against the real
project using the anon key and two throwaway users:

```bash
npm run validate:supabase
```

- If **email confirmation is ON**, `signUp` returns no session and the script
  will say so and skip authenticated checks. To run them, either temporarily
  turn confirmation OFF in Auth settings for the run, confirm the two
  `batch2+…@example.com` users by hand, or pass pre-confirmed accounts:
  ```bash
  A_EMAIL=... A_PASSWORD=... B_EMAIL=... B_PASSWORD=... npm run validate:supabase
  ```
- The script creates only clearly-labelled `[batch2-validation]` rows and a
  single test object, and removes them at the end.

It checks, and prints ✓/✗ for, each of:
table presence · profile auto-provision trigger · create/list/fetch/update/
archive/delete · `owner_id = auth.uid()` · forged-`owner_id` rejected by RLS ·
`updated_at` advanced · `wizard_stage` check constraint · archived excluded
from active list · owner upload inside own path · cross-path upload denied ·
owner signed URL · anon cannot read private object · B cannot select/update/
delete A's project · B cannot list A's image metadata · B cannot sign or
download A's object.

## 5. Manual checks the script can't cover (run the app)

```bash
npm run dev
```

| # | Check | How | Result |
|---|-------|-----|--------|
| 5a | Email registration + verification | Register a new email; confirm the "check your inbox" state; click the emailed link | ☐ |
| 5b | Login / logout | Sign in, then sign out | ☐ |
| 5c | Session persists on refresh | Sign in, hard-refresh `/dashboard` — no bounce to login | ☐ |
| 5d | Forgot + reset password | Request reset, follow email link, set new password, sign in | ☐ |
| 5e | Protected redirect | Visit `/dashboard` signed-out → redirected to `/login`; after login → back to dashboard | ☐ |
| 5f | Wizard resume | Create project, choose a source method, upload an image, refresh mid-wizard → resumes at the same step | ☐ |
| 5g | Single-image upload: valid JPEG/PNG/WebP | Upload each; preview appears; row + object created | ☐ |
| 5h | Reject invalid | Rename a `.txt` to `.jpg` and upload → blocked (decode-fail / mismatch) | ☐ |
| 5i | Reject oversized | >15 MB single / >10 MB multi → blocked | ☐ |
| 5j | Low-res warning | <512 px shortest side → warning, not rejection | ☐ |
| 5k | Multi-view | Upload 2–12, reorder, label angles, delete one, replace | ☐ |
| 5l | Delete removes both | Delete an image → metadata row and storage object both gone | ☐ |
| 5m | Signed thumbnail | Uploaded images render via signed URL; refresh still shows them | ☐ |
| 5n | Mobile camera capture | On a real phone, "Take a photo" opens the rear camera and uploads | ☐ |
| 5o | GLB option honestly unavailable | Source step shows GLB "Coming in Batch 3"; Generate button disabled | ☐ |

## Results table (fill in from §2–§5)

| Area | Result | Notes |
|------|--------|-------|
| Migrations applied (0001–0012) | ☐ | |
| 8 tables + RLS enabled | ☐ | |
| Batch 2 columns + constraints | ☐ | |
| Buckets (2 private, 1 public) | ☐ | |
| Storage owner-path policies | ☐ | |
| Auth flows (5a–5e) | ☐ | |
| CRUD + owner_id integrity | ☐ | |
| Wizard persistence (5f) | ☐ | |
| Upload flows (5g–5m) | ☐ | |
| Mobile capture (5n) | ☐ | |
| Cross-user RLS (script §4) | ☐ | |

## Bugs found / fixes applied

_None yet — validation not yet run against a live project. Record findings
here; any code fix should be a new commit on `feature/batch-2-project-wizard`
with a matching test, then re-run §4 and the affected §5 rows._

## Merge gate

Batch 2 is safe to merge to `main` only when every row in the results table
is green **and** the local gates (`npm run lint`, `npm run typecheck`,
`npm test`, `npm run build`) still pass. Until then: **do not merge.**
