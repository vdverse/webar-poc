# Image-to-3D provider comparison

Research date: 2026-07-16  
Sources: official Meshy docs (`docs.meshy.ai`) and Tripo OpenAPI docs
(`docs.tripo3d.ai`). Endpoints verified against current published docs — not
guessed from memory.

## Primary recommendation: Meshy

| Criterion | Meshy |
|-----------|--------|
| Single-image → 3D | Yes — `POST /openapi/v1/image-to-3d` |
| Multi-image → 3D | Yes — Multi-Image to 3D API |
| Textured GLB | Yes — `model_urls.glb` (optional PBR / texture flags) |
| Job create | Returns task id (`result`) |
| Status | `GET …/image-to-3d/:id` — `PENDING` / `IN_PROGRESS` / `SUCCEEDED` / `FAILED` / `CANCELED` + `progress` |
| Webhooks | Supported (docs.meshy.ai/api/webhooks) |
| Auth | `Authorization: Bearer <MESHY_API_KEY>` |
| Download | Time-limited signed URLs on Meshy CDN — **must** re-host privately |
| API access | Pro / Studio / Enterprise (API key from Meshy dashboard) |
| Pricing (docs, subject to change) | Image-to-3D ~15–30 credits depending on model/texture; Multi-Image similar band |
| Docs | https://docs.meshy.ai/en/api/image-to-3d |

**Why primary:** Matches our single + multi_view wizard modes, returns GLB,
has progress + webhooks, straightforward REST for Edge Functions.

## Fallback: Tripo3D

| Criterion | Tripo |
|-----------|--------|
| Single-image | Yes — `image_to_model` |
| Multi-view | Yes — `multiview_to_model` (typically 2–4 images, ordered front/left/back/right; front required) |
| GLB | Yes |
| Job / status | Task API with wait/poll |
| Auth | Tripo API key |
| Notes | Multi-view angle ordering is stricter than our free-form 2–12 capture; adapter must map or pad |

Docs: https://docs.tripo3d.ai / https://www.tripo3d.ai/api

## Recommendation

1. **Implement Meshy first** in Batch 3B.
2. Keep Tripo as a second `ImageTo3DProvider` implementation if Meshy is
   unavailable or quality experiments require it.
3. Until a key exists: `IMAGE_TO_3D_PROVIDER=mock` (dev only) or unset
   (generation UI shows “provider not configured”).

## What you must supply for Batch 3B

1. Create a Meshy account on a plan that includes API access.  
2. Create an API key in the Meshy dashboard.  
3. Store server-side only:

```
IMAGE_TO_3D_PROVIDER=meshy
IMAGE_TO_3D_API_KEY=...
IMAGE_TO_3D_WEBHOOK_SECRET=...   # if using webhooks
SUPABASE_SERVICE_ROLE_KEY=...    # already from Supabase (Edge Functions)
```

Never put these in `VITE_*` or commit them.

4. Rough cost: budget on the order of **tens of Meshy credits per textured
   generation** (confirm current table on https://www.meshy.ai/api before
   spend). Expect variable wall-clock time (often minutes), not seconds.
