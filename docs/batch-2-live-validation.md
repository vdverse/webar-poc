# Batch 2 live validation

## Status: Stopped (product priority change)

**Date:** 2026-07-15
**Project ref:** `codqgrxradxaloruoyys`
**Validated by:** local agent session (partial)

Two-user authentication / cross-user RLS automated validation was **stopped**
so work could move to the direct-GLB publishing vertical slice
(`docs/glb-publish-slice.md`). Existing auth, migrations, RLS policies and
tests were **not** removed.

Do **not** merge unfinished “Batch 2 fully validated” claims into `main`.

## Project reference

- Project ref / URL host: `codqgrxradxaloruoyys.supabase.co`
- Email confirmation setting during validation: **Not tested** (blocked earlier
  by invalid `@example.com` credentials / rate limits; then deprioritised)
- Date validated: 2026-07-14 (schema/migrations only) / 2026-07-15 (priority change)
- Validated by: agent + operator credentials file (no keys recorded here)

## Results table

| Area | Result | Notes |
|------|--------|-------|
| Migrations applied (0001–0012) | Pass | Applied via `supabase db push` |
| Migration 0013 (creator publish writes) | Pass | Applied 2026-07-15 |
| 8 tables + RLS enabled | Pass | Verified via SQL |
| Batch 2 columns + constraints | Pass | |
| Buckets (2 private, 1 public) | Pass | |
| Storage owner-path policies | Pass | Plus 0013 owner writes for models/publish |
| Auth flows (5a–5e) | Not tested | Two-user validation stopped |
| CRUD + owner_id integrity | Not tested | Stopped before successful sign-in with supplied accounts |
| Wizard persistence (5f) | Not tested | |
| Upload flows (5g–5m) | Not tested | |
| Mobile capture (5n) | Not tested | |
| Cross-user RLS (script §4) | Not tested | Intentionally stopped |

## Bugs found / fixes applied (before stop)

1. `unconfigured.test.tsx` assumed missing `.env.local` — now mocks
   `supabaseClient` as unconfigured (Pass with real env present).
2. `validate-supabase.mjs` used `@example.com` (rejected by GoTrue) and fell
   through to `signUp` on any sign-in failure (rate-limit masking). Now loads
   `.env.validation.local` and sign-in-only when A/B creds are present.
3. `.gitignore` now excludes `supabase/.temp/` (link cache can hold DB credentials).

## Merge gate

Batch 2 **full** merge (auth + CRUD + storage + cross-user RLS) is **not**
cleared. The GLB publish slice has separate acceptance criteria in
`docs/glb-publish-slice.md`.
