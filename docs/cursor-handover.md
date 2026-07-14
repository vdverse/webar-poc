# Cursor development handover

Written at the start of Batch 2, on branch `feature/batch-2-project-wizard`.

## Repository state at handover

- **Origin:** `https://github.com/vdverse/webar-poc.git`
- **Base branch:** `main`, clean working tree, up to date with origin
- **Latest commit at handover:** `09fa4a8` — "Batch 1: Supabase foundation,
  auth, RLS-protected schema, storage policies"
- **Previous commit:** `3317a1f` — the original MindAR proof of concept
- **Live deployment:** https://vdverse.github.io/webar-poc/ via GitHub Actions
  (`.github/workflows/deploy.yml`), redeployed automatically on every push to
  `main`. The deployed workflow runs the same gates as local (lint, tsc,
  tests, build) before publishing.
- **Note:** the brief's read list mentions `CLAUDE.md`; no such file exists
  in this repository. `README.md` and `docs/image-to-3d-ar-plan.md` are the
  authoritative docs.

## Gate results at handover (before any Batch 2 change)

`npm ci` clean → `npm run lint` 0 warnings/0 errors → `npx tsc -b` clean →
`npm test` 4 files, 22 tests, all passing → `npm run build` succeeds with
`dist/ar-demo/{model.glb,target.jpg,target.mind}` intact and `/dev/ar-proof`
in its own lazy chunk.

## Local development commands

```
npm ci              # reproducible install (a `canvas` npm override makes
                    # mind-ar installable without native builds — do not remove it)
npm run dev         # HTTPS dev server (self-signed cert) exposed on the LAN
npm run lint        # oxlint
npm run typecheck   # tsc -b   (added at handover)
npm test            # vitest, jsdom environment
npm run build       # tsc -b && vite build
npm run preview     # serve the production build over HTTPS
npm run compile:target  # regenerate the MindAR target (needs python3+Pillow)
```

There are intentionally **no** `supabase:*` npm scripts: the Supabase CLI is
not part of this environment and no local Supabase stack exists. Adding
broken scripts is worse than adding none — see
`docs/supabase-migration-inventory.md` for the two real setup paths.

## Environment variables

Copy `.env.example` → `.env.local` (already gitignored) and fill in:

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — the anon/public key (safe to expose; all access
  control lives in RLS)
- `VITE_PUBLIC_APP_URL` — the public origin used to build share/QR URLs in
  later batches

Rules: never commit `.env.local`; never put `SUPABASE_SERVICE_ROLE_KEY` or
any provider API key behind a `VITE_` prefix or anywhere in `src/` — those
are server-side-only values for Edge Functions (Batch 3+).

Typed access goes through `src/lib/env.ts`, which parses `import.meta.env`
with Zod once at startup. **Behaviour without Supabase configured:** the
homepage and `/dev/ar-proof` work fully; every auth/dashboard route renders
an explicit "Backend not configured" panel; nothing crashes, nothing fakes a
login, and nothing pretends to save data. This is covered by automated tests
(`src/features/auth/unconfigured.test.tsx` and Batch 2's dashboard tests).

## Completed features at handover

- Mode 1 AR proof at `/dev/ar-proof` (MindAR image tracking + animated GLB),
  validated on a physical phone, deployed on GitHub Pages
- Batch 1: 11 Supabase migrations (schema/RLS/storage — syntax-verified
  only, **not yet executed against any real project**), guarded Supabase
  client, auth pages (login/register/forgot/reset), `ProtectedRoute`,
  storage-path helpers with tests

## Incomplete / not started

- Two-user live Batch 2 RLS validation was **stopped** (product focus moved to
  the direct-GLB publish slice). Auth, migrations, and RLS remain in place.
- Direct GLB upload → studio → publish → QR → `/view/:slug` is implemented on
  this branch; see `docs/glb-publish-slice.md`. Manual phone AR acceptance is
  still required before calling the slice proven.
- Batch 3+: image-to-3D provider, generation backend, USDZ conversion,
  analytics, entitlements

## External blockers

1. **Live Supabase validation is pending.** A project is configured in
   `.env.local` on the developer machine, but the build sandbox cannot reach
   `supabase.com` (`403 host_not_allowed`), so migrations have not been
   applied and no live auth/CRUD/storage/RLS check has run from here. Run
   `docs/batch-2-live-validation.md` (migrations + `npm run validate:supabase`
   + the manual app checks) on a machine with network access before merging.
2. **No image-to-3D provider credential** (blocks Batch 3, not Batch 2).
3. Google OAuth appears in the UI only when configured in the Supabase
   dashboard.

## Safe development rules

1. Never work directly on `main`; every batch gets a feature branch and is
   merged only after review.
2. The protected surface is: `src/ar/**`, `src/types/mind-ar.d.ts`,
   `src/pages/ArProofPage.*`, `src/pages/ar-proof.css`, `public/ar-demo/**`,
   `scripts/**`, the existing tests, and `.github/workflows/deploy.yml`.
   Do not modify these without a documented regression, new tests, and
   explicit sign-off.
3. `three` stays pinned at 0.147.x — mind-ar's published bundle imports
   symbols removed in newer three releases. Do not "upgrade" it.
4. The `canvas → empty-npm-package` override in `package.json` is
   intentional (mind-ar's native compiler dependency doesn't build here and
   isn't needed at runtime). Do not remove it.
5. Every batch ends with: lint, typecheck, test, build, plus a manual check
   that `dist/ar-demo/*` is emitted and `/dev/ar-proof` still lazy-loads.
6. No fake data in production paths: no mock providers outside an explicit
   dev flag, no fabricated analytics/projects, no non-functional buttons
   presented as functional.

## Rollback procedure

- Uncommitted mess: `git restore . && git clean -fd` (careful: removes
  untracked files).
- Bad commit on the feature branch: `git revert <sha>` (preferred) or reset
  the branch — never rewrite `main`.
- Bad deploy: `main` is the deploy trigger; revert the offending commit on
  `main` and push — the Pages workflow redeploys the previous state. Every
  previous run's artifact is also downloadable from the Actions tab.
- Database: migrations are forward-only; write a new corrective migration
  rather than editing an executed one. Nothing destructive is ever run
  automatically.
