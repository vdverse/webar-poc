# WebAR proof of concept

An isolated proof of concept, built before any SaaS integration: a mobile
browser recognises a printed target image and displays an animated GLB model
anchored to it.

Stack: React 19 + TypeScript + Vite, MindAR 1.2.5 (image tracking),
three.js 0.147, GLTFLoader. No backend, no Supabase.

## Layout

```
public/ar-demo/target.jpg    printable target image (generated)
public/ar-demo/target.mind   compiled MindAR tracking data
public/ar-demo/model.glb     animated model (Khronos BoxAnimated sample)
scripts/generate-target.py   generates target.jpg + grayscale dump
scripts/compile-target.mjs   compiles target.mind offline (Node, no native deps)
src/ar/arSession.ts          imperative AR lifecycle: start, errors, disposal
src/pages/ArProofPage.tsx    /dev/ar-proof UI states
src/types/mind-ar.d.ts       types written from the installed mind-ar bundle
```

Routes: `/` (index) and `/dev/ar-proof` (the PoC, lazy-loaded because the AR
chunk is ~1.9 MB minified — MindAR bundles TensorFlow.js).

## Commands

```
npm install
npm run dev             # HTTPS dev server, exposed on the LAN
npm run compile:target  # regenerate target.jpg and recompile target.mind
npm run lint            # oxlint
npx tsc -b              # typecheck
npm test                # vitest (desktop fallback + fit-math tests)
npm run build           # production build
npx vite preview        # serve the production build over HTTPS
```

## How to compile the target

Two supported paths:

**A. Offline script (used to produce the committed file).**
`npm run compile:target` runs `scripts/generate-target.py` (Pillow) to draw a
feature-rich 800×800 target and dump raw grayscale pixels, then
`scripts/compile-target.mjs`, which replicates mind-ar's `OfflineCompiler`
using the compiler modules shipped inside the installed package
(`node_modules/mind-ar/src/image-target/…`). It feeds grayscale pixels
directly, so the native `canvas` package — which fails to build on many
machines and is stubbed out via an npm override here — is not needed. The
output is msgpack format v2, identical in layout to the official compiler,
and the script decodes it back and validates the structure (v2, dimensions,
feature counts) before finishing. Compiling takes a minute or two on CPU.

**B. Official web compiler (for your own images).**
Open <https://hiukim.github.io/mind-ar-js-doc/tools/compile>, upload the
image, click Start, download `targets.mind`, and save it as
`public/ar-demo/target.mind`. If you replace the image, also replace
`public/ar-demo/target.jpg` so the printed sheet matches the compiled data.

Target image guidance: high texture density, many corners, asymmetric,
non-repetitive, decent contrast. Avoid logos on flat backgrounds and
symmetric patterns.

## How to run the app over HTTPS

`getUserMedia` requires a secure context, so everything runs over HTTPS via
`@vitejs/plugin-basic-ssl` (self-signed certificate, applied to both `dev`
and `preview`):

```
npm run dev
# ➜ Local:   https://localhost:5173/
# ➜ Network: https://192.168.x.x:5173/
```

The browser will warn about the self-signed certificate; accept it
(Advanced → Proceed). For the production bundle: `npm run build`, then
`npx vite preview --host` and open `https://<lan-ip>:4173/dev/ar-proof`.

If your phone refuses the self-signed cert (some corporate profiles do), use
a tunnel that gives you a real certificate, e.g. `npx ngrok http 5173` or
Cloudflare Tunnel, and open the HTTPS URL it prints.

## How to test on a physical phone

1. Put the phone and the dev machine on the same Wi-Fi network.
2. `npm run dev` and note the `Network:` URL.
3. Print the target (below) or display `public/ar-demo/target.jpg` full-screen
   on a second monitor.
4. On the phone, open `https://<lan-ip>:5173/dev/ar-proof` in Safari (iOS) or
   Chrome (Android). Accept the certificate warning.
5. Follow the manual test procedure below.

Notes: iOS in-app browsers (Instagram, Slack, etc.) often block camera
access — use the real Safari app. Camera permission can only be granted on
HTTPS or localhost.

### Manual test procedure (mobile)

The steps a human must perform, in order, and what they verify:

1. **Idle state.** Load `/dev/ar-proof`. Expect the intro overlay with a
   "Start AR" button. Verify no camera-permission prompt has appeared and the
   camera indicator (iOS green dot / Android icon) is off. *(Req. 5, 6)*
2. **Permission timing.** Tap Start AR. The browser's camera prompt must
   appear only now. *(Req. 6)*
3. **Deny path.** Deny it. Expect the "Camera permission denied" screen with
   recovery instructions and a Back button. Re-allow in browser settings,
   tap Back → Start AR again. *(Req. 20)*
4. **Scanning state.** After granting, expect the camera feed with the
   "Point your camera at the target" pill. *(Req. 14)*
5. **Recognition.** Point at the printed target from ~20–40 cm. Expect the
   pill to switch to "Target found" and an animated model (a box with a
   swinging lid) to appear standing on the target, roughly 60 % of its
   width, centred. The animation must loop. *(Req. 8–14)*
6. **Anchoring.** Move and tilt the phone slowly. The model must stay glued
   to the printed sheet. *(Req. 8, 12)*
7. **targetLost.** Point away. Expect "Point your camera at the target"
   again; point back and "Target found" returns. *(Req. 15)*
8. **Portrait/rotation.** Use the phone in portrait; rotate to landscape and
   back. The feed and overlay must stay usable and full-screen. *(Req. 16)*
9. **Route exit.** Tap Stop, or navigate back to `/`. The camera indicator
   must turn off within a second or two. *(Req. 17–19)*
10. **Re-entry.** Open `/dev/ar-proof` again and tap Start AR; a second
    session must work (no leaked state from the first).

## How to print the target

- Print `public/ar-demo/target.jpg` on A4/Letter at 100 % scale, colour if
  possible (grayscale also works — tracking uses luminance).
- Matte paper strongly preferred; glossy reflections break tracking.
- Keep the sheet flat (tape it to a table or wall) and evenly lit, no strong
  glare or shadows.
- A width of roughly 12–18 cm on paper works well at phone-arm distance.

## Known limitations

- **mind-ar 1.2.5 pins three.js to 0.147.** The published bundle imports
  `sRGBEncoding` and sets `renderer.outputEncoding`, both removed in modern
  three releases, so this project pins `three@0.147.0`. Upgrading three
  requires patching or forking mind-ar.
- **MindAR leaks a `window` resize listener** per `MindARThree` instance and
  appends DOM it never removes. The session cleanup removes the DOM, stops
  tracks, disposes GPU resources, and neutralises the leaked listener (it
  early-returns once `video` is nulled), but the listener itself cannot be
  removed because MindAR keeps no reference to the bound handler. Negligible
  for a PoC; patch it before the SaaS.
- **`canvas` is stubbed via npm override** (`canvas → empty-npm-package`)
  because its native build fails on current Node and it is only used by
  mind-ar's own offline compiler, which `scripts/compile-target.mjs`
  replaces.
- **MindAR's `start()` rejects with `undefined`** on camera failure
  (verified in the installed bundle), so the app performs its own
  permission probe first to classify errors precisely.
- **Large AR chunk (~1.9 MB min / ~490 KB gzip)** due to TensorFlow.js
  inside MindAR; it is code-split onto the AR route but still slow on poor
  connections.
- **Static hosting needs an SPA rewrite** so `/dev/ar-proof` serves
  `index.html` (`vite preview` already does this).
- **Tracking quality is physical.** Small prints, glossy paper, low light,
  motion blur, or a target occupying too little of the frame all degrade
  recognition. Image tracking also drifts slightly at steep viewing angles.
- **Desktop is a fallback, not a feature.** With a webcam it can technically
  track a printed target; without one it shows the "No camera available"
  error. The UI is designed for mobile portrait.

## SaaS app (Vercel + Supabase)

Preview: https://webar-poc-one.vercel.app

Working path: auth → project → **upload GLB** → studio → publish → QR → Android markerless AR.

**Batch 3 (image-to-3D):** photo projects can call secure Edge Functions to generate a GLB, then reuse the same studio. Requires server secrets — see `docs/batch-3-image-to-3d-plan.md` and `docs/image-to-3d-provider-setup.md`. Direct GLB upload remains permanent.

MindAR image-target proof stays at `/dev/ar-proof` (also on GitHub Pages).

Verified in this environment (no camera, GPU, or real browser available):

- `oxlint`: 0 errors, 0 warnings.
- `tsc -b`: clean.
- `npm run build`: succeeds; `dist/ar-demo/` contains all three assets.
- `vitest` (6 tests): idle state renders with Start button; camera is not
  requested before the button is pressed; WebGL-unavailable, no-camera and
  camera-denied error states render with correct copy; bounding-box
  scale/centre/rest-on-page math is exact; zero-size model does not NaN.
- Dev server and production preview respond 200 over HTTPS for `/`,
  `/dev/ar-proof`, `target.mind` and `model.glb`.
- `target.mind` decodes as msgpack v2 with expected structure and 400+
  feature points at the largest scale.
- `model.glb` is a valid glTF 2.0 binary containing 1 animation.

**Not automatically verifiable — requires the manual phone procedure above:**

- Real camera capture, the permission prompt UX, and MindAR's runtime
  start-up on a device (TensorFlow.js backend init, video pipeline).
- Actual recognition of the printed target, anchoring stability,
  `targetFound`/`targetLost` firing, and tracking latency.
- Visual correctness of model scale/orientation on the physical target
  (the math is unit-tested; the look is not).
- Animation playback smoothness under real frame timing.
- Orientation-change behaviour on device (MindAR's resize handler is not
  exercised in jsdom).
- That GPU memory is actually freed on route exit (every documented
  `dispose()` is called, and camera-track shutdown is observable via the
  phone's camera indicator, but GPU memory cannot be measured here).
