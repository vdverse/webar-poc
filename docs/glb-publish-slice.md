# GLB publish vertical slice

**Status (2026-07-15):** Implemented on `feature/batch-2-project-wizard` against
Supabase project `codqgrxradxaloruoyys`. Two-user Batch 2 live RLS validation
was **stopped by design** so the product focus could move to a direct-GLB
upload → preview → publish → QR → public viewer path. Existing auth,
migrations 0001–0012, RLS and photo-wizard work are preserved.

## What this slice delivers

1. Creator signs in with one real account (Option A).
2. Chooses **Upload an existing GLB** in the project wizard.
3. Uploads a `.glb` (max 25 MB) — validated with Three.js `GLTFLoader`.
4. Opens **GLB studio** (`/dashboard/projects/:id/studio`).
5. Previews via CDN `@google/model-viewer` (keeps mind-ar on `three@0.147`).
6. Edits scene settings (persisted to `scene_settings`).
7. Publishes → copies GLB to `published-ar-assets`, writes `publications`
   snapshot, generates QR for `/view/:publicSlug` only.
8. Anyone opens the public page with no login and taps into AR
   (`webxr` / `scene-viewer`; Quick Look only when a USDZ exists).

## Migration

- `0013_creator_publish_write_policies.sql` — temporary owner write policies for
  `generated_models`, `publications`, and the two storage buckets, until Edge
  Functions own those writes. Applied to `codqgrxradxaloruoyys`.

## Manual acceptance

| Step | Status |
|------|--------|
| Upload real GLB in studio | Not tested (needs operator + sample file) |
| Preview + change scale/rotation | Not tested |
| Publish + QR | Not tested |
| Scan QR on phone → `/view/...` without login | Not tested |
| Android “View in your space” | Not tested |
| iPhone without USDZ shows honest limitation | Pass (UI copy + tests for missing USDZ notice path) |

Do **not** treat this slice as merge-to-`main` ready for full Batch 2
validation claims. Merge readiness for the *product demo* depends on completing
the manual acceptance rows above on a real phone.

## Image-to-3D generation

Still deferred (Batch 3). Photo capture/wizard remains; Generate stays disabled.
