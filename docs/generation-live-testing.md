# Generation live testing

## Batch 3B live result (2026-07-16)

| Step | Result |
|------|--------|
| Migration 0015 | Applied remotely |
| Edge Functions | Deployed |
| Secrets | `IMAGE_TO_3D_PROVIDER`, `IMAGE_TO_3D_API_KEY`, `IMAGE_TO_3D_ALLOW_MOCK` |
| Real Meshy generation | **Completed** (no further paid runs) |
| Internal job | `67452677-3510-4ca8-81ed-e70eefdb530c` |
| Model | `f4c1c560-c930-461f-9f90-810686a4c3c7` |
| Project | `593fea53-623b-44f5-ab25-701501c3d008` · Batch 3B Meshy test |
| Duration | **160,146 ms** (~2.7 min) |
| Credits | **3 → 2** (1 consumed on accept) |
| GLB size | **21,397,196** bytes (~20.4 MB) |
| Private storage | `generated-models-private` under owner/project prefix |
| Metadata (post-inspect) | 1 mesh · 662,630 tris · 1 material · 1 texture · no animations · bounds ≈ 1.90×1.87×0.74 |
| Scene settings | Saved (floor, scale 1, physicalHeight 0.3 m) |
| Publication | `8cc57c7f-e544-4b87-9468-c358b998881b` · slug `batch-3b-meshy-test-593fea53` · v1 |
| Public GLB | HTTP 200 · `model/gltf-binary` · public bucket only |
| QR / viewer URL | https://webar-poc-one.vercel.app/view/batch-3b-meshy-test-593fea53 |
| QR image | `public/batch3b-meshy-qr.png` |
| Anonymous viewer route | SPA 200 on Vercel |
| Android AR | **Not tested — awaiting your phone confirmation** |

### Known notes

- Ingest initially stored empty mesh/bounds; backfilled via GLB JSON inspect, and Edge ingestion now records counts/bounds for future jobs.
- Triangle count is high (~663k) — AR may be heavy on mid-range Android; still valid GLB.

## Android AR checklist

1. Display `public/batch3b-meshy-qr.png` or open the viewer URL above on desktop.
2. Scan with Android Chrome.
3. Confirm no login.
4. Confirm Meshy model loads.
5. Tap **View in your space** → place on floor/table → walk around.
6. Reply **Android AR Pass** or describe the failure.

## Do not

- Rerun `node scripts/live-meshy-generate.mjs` for this project (costs another Meshy generation).
