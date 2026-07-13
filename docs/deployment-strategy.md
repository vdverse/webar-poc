# Deployment strategy

Four separate concerns, deliberately not collapsed into one host. Nothing is
being migrated during Batch 2 — GitHub Pages does not block local Batch 2
development (the dashboard runs against `npm run dev` + a Supabase project).

## 1. GitHub Pages (exists today — keep)

- **Hosts:** the static AR proof of concept (`/dev/ar-proof`) and, for now,
  the whole static SPA build at https://vdverse.github.io/webar-poc/
- **Purpose:** public technical demo of Mode 1 (image-target AR);
  automatic redeploy on every push to `main`
- **Hard limitations:** static files only — no secure backend, no secrets
  (anything in the bundle is public), no server functions, no webhook
  receiver, no database, no long-running jobs. Deep links work via a
  `404.html` SPA fallback that returns HTTP 404 status with the app content.
- **Consequence:** the dashboard *pages* can technically be served from
  Pages (they talk to Supabase directly with the public anon key), but no
  provider secret and no server-side step can ever live here.

## 2. Future SaaS frontend host (Batch 6+ decision — Vercel or Cloudflare Pages recommended)

- **Purpose:** the authenticated dashboard and the public model viewer
  (`/view/:slug`) on a real domain, with per-environment variables, proper
  SPA rewrites (real 200s, unlike the Pages 404 trick), preview deploys per
  branch, and edge middleware if needed.
- The repo already contains `vercel.json` and a Cloudflare `_redirects`
  file from the PoC phase, so either target works without code changes.
- **Not migrated yet:** premature until there is a public viewer to host.

## 3. Supabase (project must be provisioned — external blocker)

- **Purpose:** authentication, Postgres with the RLS schema in
  `supabase/migrations/`, private + public storage buckets, and Edge
  Functions (from Batch 3) for every operation the browser must not do
  itself: credit checks, provider API calls, GLB download/validation,
  publishing transactions, validated analytics inserts.
- The browser talks to Supabase with the anon key only; all authority comes
  from RLS + the authenticated session.

## 4. Future generation backend (Batch 3+)

- **Purpose:** secure image-to-3D provider calls (`IMAGE_TO_3D_API_KEY`
  lives only here), async job orchestration, provider webhooks, server-side
  GLB download + validation, and eventually GLB→USDZ conversion.
- **Default shape:** Supabase Edge Functions, because they sit next to the
  database and storage with the service-role key already available. If
  GLB→USDZ conversion needs a heavier runtime (USD tooling is native code),
  that one piece moves to a container host (e.g. Cloud Run) behind the same
  interface — decided in Batch 6, not now.

## Summary of who holds which secret

| Secret | Lives in | Never in |
|---|---|---|
| Supabase anon key | Browser bundle (by design; RLS-constrained) | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions env | Browser, repo, `VITE_*` |
| `IMAGE_TO_3D_API_KEY` / webhook secret | Edge Functions env | Browser, repo, GitHub Pages |
| `MODEL_CONVERSION_API_KEY` | Conversion backend env | Browser, repo |
