# Image-to-3D provider setup

Supabase project: `codqgrxradxaloruoyys`

## Secrets (server only — never `VITE_*`)

| Secret | Status (2026-07-16) |
|--------|---------------------|
| `IMAGE_TO_3D_PROVIDER=meshy` | Configured |
| `IMAGE_TO_3D_ALLOW_MOCK=false` | Configured |
| `IMAGE_TO_3D_API_KEY` | Configured (value never in repo) |
| `IMAGE_TO_3D_WEBHOOK_SECRET` | Optional (polling used in v1) |

### Set the Meshy key (you)

1. Copy `.env.meshy.local.example` → `.env.meshy.local` (gitignored).
2. Add one line: `IMAGE_TO_3D_API_KEY=msy_…` (your real key — never commit).
3. Run:

```powershell
powershell -File scripts/set-meshy-secrets.ps1
```

Or manually:

```bash
supabase secrets set IMAGE_TO_3D_API_KEY=YOUR_KEY --project-ref codqgrxradxaloruoyys
```

Verify names only:

```bash
supabase secrets list --project-ref codqgrxradxaloruoyys
```

## Deploy functions

```bash
supabase functions deploy create-generation-job get-generation-status cancel-generation-job process-generation-result --project-ref codqgrxradxaloruoyys
```

Deployed 2026-07-16 (Batch 3B Meshy adapter + data-URI delivery).

## Migration

`0015_generation_job_hardening.sql` applied remotely via `supabase db push`.

## Live test scripts

| Script | Purpose |
|--------|---------|
| `scripts/prepare-meshy-source-project.mjs` | Creates single_image project + JPEG (service role) |
| `scripts/live-meshy-generate.mjs` | One paid generation + poll (uses `.env.batch3b.local` or validation user) |
| `scripts/set-meshy-secrets.ps1` | Uploads key from `.env.meshy.local` without printing it |

## Meshy API notes (official docs)

- Single: `POST /openapi/v1/image-to-3d` → poll `GET …/image-to-3d/:id`
- Multi: `POST /openapi/v1/multi-image-to-3d` (1–4 images) → poll `GET …/multi-image-to-3d/:id`
- Input formats: **JPEG/PNG only** (WebP rejected)
- Result: `model_urls.glb` on `assets.meshy.ai` (expiring — re-hosted privately)

## Credits

Server decrements `profiles.generation_credits` only after Meshy **accepts** the job.
Failed submit (e.g. missing API key) does **not** consume a credit (verified 2026-07-16).
