# Preview deployment testing

**Preview URL:** https://webar-poc-one.vercel.app  
**Branch:** `feature/batch-2-project-wizard`  
**Vercel project:** `kindyjoy/webar-poc`  
**Date:** 2026-07-15

Do not merge into `main` until physical-phone AR acceptance passes.

## Environment variables (Vercel)

Required at **build time** (Vite inlines them):

| Name | Purpose |
|------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Anon key (public; RLS constrained) |
| `VITE_PUBLIC_APP_URL` | Must be the preview HTTPS origin used in QR codes |

Current preview origin baked into the live build:

`https://webar-poc-one.vercel.app`

Never set a service-role key in Vercel or any `VITE_` variable.

GitHub Pages continues to build with `--base=/webar-poc/` and is unchanged.
Vercel builds with Vite default `base: '/'`.

## Supabase Auth URL configuration (manual)

Open:
https://supabase.com/dashboard/project/codqgrxradxaloruoyys/auth/url-configuration

**Do not remove** existing localhost or GitHub Pages entries.

Add (or keep) these redirect allow-list entries:

```
https://webar-poc-one.vercel.app/**
https://webar-poc-one.vercel.app/dashboard
https://webar-poc-one.vercel.app/reset-password
https://*.vercel.app/**
http://localhost:5173/**
http://localhost:5173/dashboard
http://localhost:5173/reset-password
https://vdverse.github.io/webar-poc/**
```

Site URL can remain localhost for development, or be set to
`https://webar-poc-one.vercel.app` while this preview is the active demo host.

## Routes verified (automated)

| Route / asset | Result |
|---------------|--------|
| `/` | Pass (200 HTML) |
| `/login` | Pass (SPA 200) |
| `/dashboard` | Pass (SPA 200) |
| `/dev/ar-proof` | Pass (SPA 200) |
| `/view/nonexistent-test-slug` | Pass (SPA 200 — app not-found, not server 404) |
| `/ar-demo/model.glb` | Pass (`model/gltf-binary`) |
| `/ar-demo/target.mind` | Pass |
| `/ar-demo/target.jpg` | Pass (`image/jpeg`) |
| Supabase URL baked into bundle | Pass |
| `VITE_PUBLIC_APP_URL` is preview origin (not localhost) | Pass |

See also `docs/publication-url-and-republish.md` for republish / QR origin rules.
| HTTPS | Pass |

## Creator acceptance (one account)

| Step | Result |
|------|--------|
| Login | Not tested |
| Create project | Not tested |
| Upload GLB | Not tested |
| Studio preview / settings | Not tested |
| Publish + QR | Not tested |
| QR uses preview HTTPS origin | Not tested (code + bake verified; end-to-end publish Not tested) |

## Public viewer / anonymous

| Step | Result |
|------|--------|
| Open `/view/...` logged out | Not tested (missing slug Pass) |
| Private session | Not tested |
| Copy / share | Not tested |
| QR encodes public viewer only | Pass (unit tests + URL builder) |

## Android AR (you must run)

See checklist below. Status: **Not tested**.

## iPhone

Without USDZ: 3D preview works; Quick Look not claimed. Status: **Not tested** on device;
UI copy + logic: **Pass** in code.

## Phone checklist (Android / Chrome)

1. Ensure Supabase redirect URLs above are saved.
2. On desktop: log in at https://webar-poc-one.vercel.app/login
3. Create project → **Upload an existing GLB** → upload a small `.glb`
4. Open **GLB studio** → adjust scale/rotation → save → **Publish**
5. Confirm QR URL starts with `https://webar-poc-one.vercel.app/view/`
6. Scan QR on phone → page opens **without login**
7. Confirm model loads and rotates
8. Tap model-viewer AR / **View in your space**
9. Allow camera → detect floor/table → place → walk around

### Expected outcomes

| Situation | What you should see |
|-----------|---------------------|
| WebXR works | In-browser AR placement |
| Scene Viewer fallback | Google Scene Viewer / ARCore opens the GLB |
| AR unsupported | Preview still works; notice about unsupported device |
| Model fails | Viewer error / load failure state |
| GLB too large | Slow load or phone memory pressure — prefer under 15 MB for demos |

## Redeploy notes

If env vars change, redeploy so Vite rebuilds:

```bash
npx vercel deploy --prod --yes
```

Or pass explicit build envs:

```bash
npx vercel deploy --prod --yes \
  --build-env VITE_SUPABASE_URL=... \
  --build-env VITE_SUPABASE_ANON_KEY=... \
  --build-env VITE_PUBLIC_APP_URL=https://webar-poc-one.vercel.app
```
