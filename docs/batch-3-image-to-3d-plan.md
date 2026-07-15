# Batch 3 — Image-to-3D plan

**Protected baseline commit:** `8f8175c`  
(`Improve markerless AR surface placement and physical scale.`)  
Branch: `feature/batch-2-project-wizard` (already on origin).

**Batch 3B (in progress):** Meshy adapter aligned to official API; migration 0015 applied; Edge Functions deployed; Supabase secret names `IMAGE_TO_3D_PROVIDER` / `IMAGE_TO_3D_API_KEY` / `IMAGE_TO_3D_ALLOW_MOCK` configured. Next: one live Meshy generation + studio → publish → Android AR confirmation.

**Dirty working-tree resolution (2026-07-16):** Uncommitted changes were an
unexplained full *reverse* of `8f8175c` (~923 lines deleted). They did **not**
represent the phone-tested AR placement behaviour. Preserved via:

`git stash` — `WIP: unexplained reverse of 8f8175c markerless AR placement`

Do **not** apply that stash without explicit review. Working tree restored to
`8f8175c` before Batch 3A.

---

## 1. Current working pipeline (preserve)

```
Auth → project → GLB upload OR (future) generation result
  → generated_models (private)
  → GLB Studio (preview + scene_settings)
  → publish → published-ar-assets + publications snapshot
  → /view/:slug + QR → model-viewer AR (Android)
```

Direct GLB upload and `/dev/ar-proof` remain first-class.

## 2. Where generated GLBs enter

Provider completion → Edge Function downloads GLB → validates → uploads to
`generated-models-private` → inserts `generated_models` (same shape as direct
upload) → sets `ar_projects.status = 'generated'` → creator opens **existing**
`/dashboard/projects/:id/studio`.

## 3. Reusable schema

| Table | Reuse |
|-------|--------|
| `project_source_images` | Source photos (private) |
| `generation_jobs` | Job tracking (0005 already exists) |
| `generated_models` | Validated GLB metadata + path |
| `scene_settings` | Studio |
| `publications` / storage | Unchanged publish path |

## 4. Schema additions (migration 0015)

Harden `generation_jobs` with: `stage`, `attempts`, `request_hash`,
`cancelled_at`, richer status alignment, credit/dev-limit helper columns where
needed. Users remain **select-only**; writes via service role / Edge Functions.

## 5–6. Provider abstraction + security

Server-only `ImageTo3DProvider` interface in Supabase Edge Functions.
Browser never sees `IMAGE_TO_3D_API_KEY` or service-role key.
JWT → `auth.uid()` → project ownership → signed short-lived source URLs →
provider → private store → studio.

## 7–9. Job lifecycle / poll / storage

Create job → submit → poll (or webhook later) → download GLB → validate →
`generated_models` → studio. Mock provider for local Batch 3A only
(`IMAGE_TO_3D_PROVIDER=mock`).

## 10–12. Failure, cost, deploy

One active job per project (existing unique index). Dev generation limit
server-side. Deploy secrets via `supabase secrets set`. Frontend on
https://webar-poc-one.vercel.app.

## 13–14. Testing / limitations

Unit + mock integration in 3A. Real provider in 3B after API key. Quality of
reconstruction is provider-dependent; checklist warnings are honest, not
guarantees.

## Batch 3A vs 3B

| 3A (this PR slice) | 3B (blocked on secrets) |
|--------------------|-------------------------|
| Plan + provider compare | Real Meshy (or chosen) adapter |
| Abstraction + mock | Secrets configured |
| Migration 0015 | Live image → GLB → studio → AR |
| Edge Function scaffolds | Redeploy + phone acceptance |
| Generation UI + gates | |

**Recommended primary:** Meshy (`docs.meshy.ai`) — single + multi-image, GLB,
polling + webhooks. **Fallback:** Tripo3D. See
`docs/image-to-3d-provider-comparison.md`.
