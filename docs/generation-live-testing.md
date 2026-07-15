# Generation live testing

## Batch 3B status (2026-07-16)

| Step | Result |
|------|--------|
| Migration 0015 | Applied remotely |
| Edge Functions | Deployed (Meshy adapter + ingestion) |
| `IMAGE_TO_3D_PROVIDER=meshy` | Set |
| `IMAGE_TO_3D_API_KEY` | **Not set in Supabase — live Meshy blocked** |
| Test project prepared | `593fea53-623b-44f5-ab25-701501c3d008` (single JPEG, 36 KB) |
| Dry-run create job | Failed `provider-not-configured`; credits unchanged (3) |
| Real Meshy GLB | **Pending API key + one live run** |
| Studio / publish / QR / AR | **Pending real GLB** |

### After you set `IMAGE_TO_3D_API_KEY`

1. `node scripts/live-meshy-generate.mjs` (uses `.env.batch3b.local` from prepare script).
2. Open studio → publish → scan QR on Android.
3. Fill the manual section below.

## Batch 3A (mock)

Mock path remains behind `IMAGE_TO_3D_ALLOW_MOCK=true` — disabled on production project.

## Manual real-provider validation

- Date: 2026-07-16 (partial — infra only)
- Meshy task id: _pending_
- Internal job id: `9c2d56f2-…` (failed — no API key; redacted)
- Credits before/after dry-run: 3 / 3
- File size: _pending_
- Studio OK: _pending_
- Publish slug: _pending_
- Android AR OK: **Not tested — awaiting your phone confirmation**

## Android AR checklist (for you)

1. Display QR on desktop after publishing Meshy-generated project.
2. Scan with Android phone (Chrome).
3. Confirm no login.
4. Confirm generated 3D model loads.
5. Tap **View in your space**.
6. Detect floor/table → place model.
7. Walk around; verify scale.
8. Reply **Android AR Pass** or describe failure.
