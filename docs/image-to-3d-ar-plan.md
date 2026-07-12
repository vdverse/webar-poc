# Image → AI 3D model → QR → markerless AR: architecture & plan

Status: Batch 1 complete. This document is updated after every batch.

## 1. Current architecture (as of the end of Batch 1)

```
src/
  App.tsx                  Router root: wraps everything in AuthProvider,
                            lazy-loads every route except HomePage.
  pages/
    HomePage.tsx            /
    ArProofPage.tsx          /dev/ar-proof  (existing PoC, untouched)
    ar-proof.css
    auth/
      LoginPage.tsx          /login
      RegisterPage.tsx       /register
      ForgotPasswordPage.tsx /forgot-password
      ResetPasswordPage.tsx  /reset-password
    dashboard/
      DashboardHomePage.tsx  /dashboard (protected, stub — real dashboard is Batch 2)
  features/
    auth/
      AuthContext.ts         React context + useAuth() hook (non-component
                              exports live here, not in AuthProvider.tsx, so
                              Vite's fast-refresh lint rule stays clean)
      AuthProvider.tsx        Session state, sign in/up/out, password reset,
                              Google OAuth entry point
      ProtectedRoute.tsx      Redirects to /login when signed out; shows the
                              "not configured" notice instead of crashing
                              when Supabase env vars are absent
      SupabaseNotConfiguredNotice.tsx
      auth.css
  lib/
    supabaseClient.ts         Guarded Supabase client — `supabase` is `null`
                              and `isSupabaseConfigured` is `false` whenever
                              VITE_SUPABASE_URL/ANON_KEY are unset
    storagePaths.ts           Path builders + slug helpers that mirror the
                              storage RLS policies exactly (tested)
    storagePaths.test.ts
  ar/                         Existing MindAR session module — unchanged
  types/mind-ar.d.ts          Existing — unchanged
supabase/
  migrations/0001..0011       Schema, RLS, storage buckets/policies (below)
docs/
  image-to-3d-ar-plan.md      This file
.env.example                  Variable names only, per the security brief
```

## 2. Existing AR functionality (Mode 1 — preserved, not modified)

`/dev/ar-proof` (`src/pages/ArProofPage.tsx` + `src/ar/arSession.ts`):
image-target tracking via MindAR, an animated GLB anchored to a printed
target, full resource disposal on route exit. This is a different product
mode from the one being built now and continues to work exactly as before —
Batch 1 did not touch `src/ar/`, `src/types/mind-ar.d.ts`, `public/ar-demo/`,
or `ArProofPage.tsx`/`.css`. Verified: `npm run lint`, `npx tsc -b`,
`npm test` (the existing 6 AR tests still pass unchanged), and
`npm run build` (the AR route is still its own ~1.87 MB lazy chunk, and
`dist/ar-demo/{model.glb,target.jpg,target.mind}` are still emitted).

## 3. Files responsible for the current proof of concept

`src/ar/arSession.ts`, `src/types/mind-ar.d.ts`, `src/pages/ArProofPage.tsx`,
`src/pages/ar-proof.css`, `src/ar/fitModelToAnchor.test.ts`,
`src/pages/ArProofPage.test.tsx`, `public/ar-demo/*`,
`scripts/generate-target.py`, `scripts/compile-target.mjs`.

## 4. Deployment architecture

**Today:** GitHub Actions builds and deploys the whole Vite app as a static
site to GitHub Pages (`vdverse/webar-poc`, workflow at
`.github/workflows/deploy.yml`). No server-side code runs anywhere.

**What this batch adds without deploying it:** Supabase migrations
(`supabase/migrations/`) and frontend auth code that talks to a Supabase
project. Nothing here has been provisioned or deployed — see §9 below for
exactly what's blocked and why.

## 5. Main limitations of GitHub Pages for this feature

GitHub Pages serves static files only — no server runtime, no secrets, no
webhooks receiver, no database. That is fundamentally incompatible with
several hard requirements of this feature:

- **AI provider secrets cannot be used client-side.** An image-to-3D API
  key embedded in any GitHub Pages JavaScript bundle is public the moment
  the site is deployed — anyone can read it from the network tab or the
  built file. This feature requires a real backend (Supabase Edge
  Functions, or another server) to hold `IMAGE_TO_3D_API_KEY` and make the
  provider call itself.
- **No webhook receiver.** If the chosen provider supports webhooks instead
  of polling, something has to receive an HTTPS POST at a stable URL —
  GitHub Pages cannot do this.
- **No database.** RLS-protected project/job/publication state needs
  Postgres; GitHub Pages has no persistence beyond static files.
- **No long-running jobs.** Image-to-3D generation takes anywhere from
  seconds to several minutes; there is nowhere on GitHub Pages to run or
  track that.

**Conclusion, per the brief:** GitHub Pages keeps hosting the static
`/dev/ar-proof` PoC (and can still host the rest of the *static* frontend if
desired, since the frontend is just files), but Supabase (Postgres, Auth,
Storage, Edge Functions) must be provisioned separately for everything
Batch 1 onward introduces. A frontend host with an SSR/edge-function layer
of its own (Vercel, Cloudflare Pages, Netlify) is also an option if a single
platform is preferred over GitHub Pages + Supabase; either way, the AI
provider call has to run server-side.

## 6. Database schema, RLS and storage — what Batch 1 built

11 forward-only SQL migrations in `supabase/migrations/`, syntax-verified
against a real Postgres grammar (`libpg-query`, the C library Postgres
itself uses to parse SQL) since no live database is reachable from this
environment — see §12.

| File | Contents |
|---|---|
| `0001_extensions_and_helpers.sql` | `pgcrypto`, shared `set_updated_at()` trigger fn |
| `0002_profiles.sql` | `profiles` table, auto-provisioning trigger on `auth.users` insert, RLS |
| `0003_ar_projects.sql` | `ar_projects`, mode/status check constraints, owner-only RLS |
| `0004_project_source_images.sql` | `project_source_images`, owner + project-ownership RLS |
| `0005_generation_jobs.sql` | `generation_jobs`, **one active job per project** unique index (idempotency), read-only RLS for owners (writes are service-role only) |
| `0006_generated_models.sql` | `generated_models`, read-only RLS for owners |
| `0007_scene_settings.sql` | `scene_settings`, owner RLS |
| `0008_publications.sql` | `publications`, **one active publication per project** unique index, owner-sees-all + public-sees-active-only RLS |
| `0009_viewer_events.sql` | `viewer_events`, no `owner_id` column at all — ownership for reads is derived via a join to `ar_projects`; inserts are validated against a live, active `publications` row rather than any client-supplied identifier |
| `0010_storage_buckets_and_policies.sql` | Three buckets (`source-images-private`, `generated-models-private` — both private; `published-ar-assets` — public) and path-prefix-based object RLS |
| `0011_grants.sql` | Explicit `GRANT`s — a fresh Postgres schema gives `anon`/`authenticated` no table privileges by default, so every table above needs one or its RLS policies are unreachable |

Design decisions worth calling out:

- **Default `ar_projects.mode` is `'markerless_surface'`**, matching "for
  this feature default mode to: markerless_surface" in the brief, while
  `'image_target'` remains a valid value for Mode 1 projects if that mode is
  ever brought into the same dashboard later.
- **`generation_jobs` and `generated_models` grant `SELECT` only** to
  `authenticated`. All provider calls happen server-side (Batch 3), so
  there is no legitimate reason for the browser to `INSERT`/`UPDATE` these
  tables directly, and not granting it removes an entire class of potential
  RLS-policy mistakes.
- **`viewer_events` has no `owner_id`** specifically to satisfy "never trust
  an owner_id supplied by a browser" for a table whose whole purpose is
  accepting anonymous, unauthenticated inserts.

## 7. Storage path convention

Enforced identically in the storage RLS policies (`0010_…sql`) and in
`src/lib/storagePaths.ts` (unit-tested):

```
source-images-private/{userId}/{projectId}/{imageId}-{sanitizedFilename}
generated-models-private/{userId}/{projectId}/{modelId}.glb
published-ar-assets/{projectId}/{publicationVersion}/{model.glb|model.usdz|poster.webp|qr.svg|qr.png}
```

`sanitizeFilename()` strips path separators and anything outside
`[a-zA-Z0-9._-]`, so a crafted original filename like `../../etc/passwd`
cannot escape the intended prefix — tested directly.

## 8. New architecture (target shape for later batches)

```
Supplier (browser)                     Supabase                          AI providers
──────────────────                     ────────                          ────────────
Auth pages ───────────────────────────▶ Auth (Postgres auth.users)
Dashboard / wizard ───────────────────▶ Postgres (RLS-protected tables)
Image upload ──────────────────────────▶ Storage: source-images-private
"Generate" click ─────────────────────▶ Edge Function: create-generation-job
                                            │
                                            ├─ credit check (server-side)
                                            ├─ signed source-image URLs
                                            └─ POST to provider ─────────▶ Image-to-3D provider
Status polling ───────────────────────▶ Edge Function: generation-status ◀── provider status/webhook
                                            │ on completion:
                                            ├─ download GLB server-side
                                            ├─ validate structure/size
                                            ├─ store in generated-models-private
                                            └─ write generated_models row
Editor (preview/scale/rotate) ────────▶ Postgres: scene_settings
"Publish" click ───────────────────────▶ Edge Function: publish-project
                                            ├─ copy GLB/USDZ/poster into published-ar-assets
                                            ├─ (optional) MODEL_CONVERSION for USDZ ─▶ conversion worker
                                            ├─ generate QR PNG/SVG
                                            └─ write publications row (versioned, immutable)

Receiver (browser, no account) ───────▶ /view/:slug, /ar/:slug
                                            └─ reads only the active publications.snapshot
                                            └─ <model-viewer> for preview + WebXR/Scene Viewer/Quick Look
                                            └─ Edge Function: track-viewer-event (validated insert)
```

## 9. Image-to-3D provider strategy

Per the brief's own instructions when no provider credential exists, Batch 1
stops here rather than guessing an API:

- The provider abstraction (`ImageTo3DProvider` interface, `providerFactory`,
  `generationService`) is Batch 3 work and will be implemented against
  whichever provider's *current* official documentation is inspected at
  that time — endpoints, auth, input/output formats, and commercial terms
  are not being assumed now.
- **A real credential is required before Batch 3 can call a real provider.**
  Candidates worth evaluating on cost, commercial-use terms, single- vs
  multi-image support, and turnaround time include Meshy, Tripo3D, Luma
  (Genie), and Kaedim — this list is not a commitment; whichever is chosen,
  its docs get read fresh before any code is written against it.
- Until a credential is supplied, Batch 3 will ship the complete provider
  interface plus a development-only mock provider gated behind an explicit
  local flag (never reachable in a production build), and the mandatory
  **direct GLB upload fallback**, so the rest of the platform (wizard,
  editor, publish, QR, public viewer) is fully testable without any AI
  provider at all.
- **Action needed from you:** which provider (if you already have a
  preference or an existing account), and the corresponding API key, before
  Batch 3 can produce real generations instead of the mock/upload path.

## 10. Markerless AR delivery strategy

`@google/model-viewer` is the right choice here specifically because it
already implements the fallback chain the brief requires instead of this
project reinventing it:

- **Android:** `ar-modes="webxr scene-viewer quick-look"` tries WebXR first,
  falls back to Google Scene Viewer automatically.
- **iOS:** Apple AR Quick Look, which requires a **USDZ** file — there is no
  reliable browser-only GLB→USDZ path, so per the brief's own instruction,
  iOS AR is only offered once a real USDZ exists (server-side conversion in
  a later batch, or a creator-supplied USDZ). Until then, iOS gets an honest
  interactive 3D preview with no broken AR button.
- **Desktop:** interactive 3D preview (model-viewer works without a camera)
  plus a QR code prompting the visitor to continue on a phone.

`model-viewer` will be lazy-loaded only on `/view/:slug` and `/ar/:slug` in
Batch 6, kept out of the dashboard and out of the existing `/dev/ar-proof`
bundle entirely (that route has its own hand-rolled three.js/MindAR pipeline
and has no reason to also load model-viewer).

## 11. Security risks and how the current migrations address them

| Risk | Mitigation already in place |
|---|---|
| Cross-user data access | RLS on every table, `owner_id = auth.uid()` on every owner-scoped policy |
| Draft project exposed publicly | Public routes only ever read `publications` (§6); no public policy exists on `ar_projects`, `generation_jobs`, `generated_models`, or `scene_settings` |
| Forged `owner_id` from the browser | Every insert policy re-checks `owner_id = auth.uid()`; `viewer_events` sidesteps the problem by having no `owner_id` column at all |
| Provider job IDs / payloads leaking to viewers | `generation_jobs` has no public SELECT policy — only the owner can read `external_job_id`/`request_payload` |
| Path traversal in storage keys | `sanitizeFilename()`, unit-tested against `../../etc/passwd`-style input |
| Duplicate/concurrent generation jobs | `generation_jobs_one_active_per_project` partial unique index |
| Two "live" publications for one project | `publications_one_active_per_project` partial unique index |
| Anonymous analytics abuse | `viewer_events` insert policy requires a real, active publication row — not a client-asserted ID |
| Service-role key in the frontend | Not present anywhere in `src/`; `.env.example` documents it as server-only and it is never read via `VITE_` |

Risks that remain **open** and are explicitly out of Batch 1's scope (each
is called out again in the batch it belongs to): rate limiting on the
generation-job Edge Function, webhook signature verification (depends on
which provider is chosen), and file-content validation of uploaded images
beyond MIME/size (Batch 2).

## 12. What could not be verified in this environment, and why

This sandbox's network egress is allow-listed to package registries and
GitHub only — `supabase.com` and `api.supabase.com` both return
`403 host_not_allowed` here. Also, no local Postgres/Docker are available
to run the Supabase CLI's own `db push`/`db reset` locally. Concretely,
this means:

- **No live Supabase project exists yet.** The migrations have not been
  applied to any real database.
- **The migrations were syntax-checked, not execution-checked.** Each of
  the 11 files was parsed with `libpg-query` (the actual C parser Postgres
  uses), confirming they are all valid SQL and counting statements per
  file — but this does not catch every possible runtime issue (e.g., a
  policy referencing a column that gets renamed in a later edit,
  privilege edge cases specific to Supabase's exact role setup).
- **Auth flows are code-complete but unexercised against a real backend.**
  `npm test` verifies the *unconfigured* path end-to-end (every auth and
  dashboard route degrades to a clear "not configured" message instead of
  crashing — this is genuinely useful because it's exactly what today's
  GitHub Pages deployment shows). It cannot verify actual sign-up, email
  confirmation, Google OAuth, or password reset against a live project.

**To unblock verification, I need from you:**

1. A Supabase project (new or existing) — project URL and anon key for
   `.env.local`, so `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` can be set.
2. Either the Supabase CLI linked to that project run from *your* machine
   (`supabase link`, `supabase db push`) since this sandbox cannot reach
   `supabase.com`, or you paste the migration files into the SQL editor in
   order.
3. If Google sign-in is wanted, a Google OAuth client configured in the
   Supabase Auth provider settings (dashboard-only step).
4. Per §9, an image-to-3D provider decision + API key before Batch 3.

None of this blocks Batch 2 (dashboard/wizard/upload UI can be built and
unit-tested against the same unconfigured-Supabase pattern used here), but
it does block ever seeing real data flow through the system end-to-end.

## 13. Implementation batches (unchanged from the brief; tracked here)

1. **Audit, Supabase foundation, auth, migrations, RLS, storage policies —
   done, this document.**
2. Dashboard, project CRUD, wizard shell, source-image upload, multi-view
   capture UI.
3. Provider abstraction, secure generation backend, job lifecycle, mock
   provider, GLB upload fallback.
4. Generated-GLB download/validation/storage/inspection/thumbnail/preview.
5. Markerless AR configuration editor (scale, orientation, shadows,
   animation, poster).
6. USDZ strategy, `model-viewer` public viewer, Android WebXR/Scene Viewer,
   iOS Quick Look.
7. Publication snapshots, public asset copy, QR generation, sharing.
8. Analytics, entitlements, error handling, accessibility, performance.
9. Automated tests, real-device checklist, deployment, security audit,
   final documentation.

Each batch report follows the same shape as §14 below: files added/changed,
migrations added, tests added, blocked items, manual steps — and each batch
re-runs lint/tsc/test/build and re-confirms `/dev/ar-proof` before starting
the next one.

## 14. Batch 1 report

**Files added:**
`.env.example`,
`supabase/migrations/0001..0011_*.sql` (11 files),
`src/lib/supabaseClient.ts`, `src/lib/storagePaths.ts`,
`src/lib/storagePaths.test.ts`,
`src/vite-env.d.ts`,
`src/features/auth/AuthContext.ts`, `AuthProvider.tsx`, `ProtectedRoute.tsx`,
`SupabaseNotConfiguredNotice.tsx`, `auth.css`, `unconfigured.test.tsx`,
`src/pages/auth/LoginPage.tsx`, `RegisterPage.tsx`,
`ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`,
`src/pages/dashboard/DashboardHomePage.tsx`, `dashboard.css`,
`docs/image-to-3d-ar-plan.md` (this file).

**Files changed:** `src/App.tsx` (new routes added, existing two routes
untouched), `src/pages/HomePage.tsx` (two nav links added),
`package.json`/`package-lock.json` (new dependencies, see below),
`.gitignore` (`.env*` added).

**Files explicitly not changed:** everything under `src/ar/`, `src/types/`,
`public/ar-demo/`, `ArProofPage.tsx`/`.css`, `scripts/`.

**Dependencies added:** `@supabase/supabase-js`, `zod`, `react-hook-form`,
`@hookform/resolvers`.

**Migrations added:** 11 (§6 table above).

**Tests added:** 12 (`storagePaths.test.ts`) + 4
(`features/auth/unconfigured.test.tsx`) = 16 new tests. Combined with the
6 pre-existing AR tests: **22 tests, all passing.**

**Gate results:** `npm run lint` — 0 warnings, 0 errors, 24 files.
`npx tsc -b` — clean. `npm test` — 4 files, 22 tests, all passing.
`npm run build` — succeeds; `/dev/ar-proof` remains its own ~1.87 MB lazy
chunk with `dist/ar-demo/*` intact; new auth pages are separate small lazy
chunks (~0.6–2.6 KB each) plus a shared ~89 KB `zod`-validation chunk.

**Blocked items:** everything in §12 — no live Supabase project, so auth is
code-complete but unexercised end-to-end; migrations are syntax-verified
(via `libpg-query`) but not execution-verified.

**Manual steps required from you before Batch 1 can be considered "live"
rather than just "code complete":** the four items listed at the end of §12.
