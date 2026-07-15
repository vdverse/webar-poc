# Generation live testing

## Batch 3A (no paid key)

1. Apply migration `0015`.
2. Deploy Edge Functions.
3. Set mock secrets (`IMAGE_TO_3D_PROVIDER=mock`, `IMAGE_TO_3D_ALLOW_MOCK=true`).
4. Sign in → create single-image project → upload photo → save.
5. Click **Generate 3D model**.
6. Poll until Complete (mock uses a Khronos sample GLB).
7. **Open GLB Studio** → publish → QR → Android AR (existing path).
8. Confirm `/dev/ar-proof` and direct GLB upload still work.
9. Disable mock before expecting real AI quality.

## Batch 3B (real Meshy)

1. Replace secrets with Meshy key.
2. Generate from a real product photo.
3. Confirm provider job id stored, private GLB ingested, studio + AR.

Do not mark Batch 3 complete until step 3 of Batch 3B succeeds on a phone.

## Manual real-provider validation (fill after first live run)

- Date:
- Meshy task id:
- Internal job id:
- File size:
- Studio OK:
- Publish slug:
- Android AR OK:
