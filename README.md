# Lovesick Wedding Photography — v2

## Install
Copy everything into your `lovesickweddings-main` folder, replacing `index.html`,
`about.html`, `services.html`, `portfolio.html`, `contact.html`, `css/style.css`
and `js/main.js`. Keep your existing `assets/images/` — all photo paths are unchanged.

New files:
- `assets/logo/lovesick-logo-cream.png` — for wine/dark backgrounds (hero, loader, footer)
- `assets/logo/lovesick-logo-wine.png` — for light backgrounds (sticky header)
- `assets/favicon.svg` — replaces the old one

## Brand colours (from the logo)
- Wine `#7F3242` · Cream `#EBDBCE` — set as `--wine` / `--cream` in `css/style.css`

## Hero camera
Real-time 3D (Three.js r128 from cdnjs, home page only). Sequence:
exploded wireframe skeleton assembles → scan line fills it with materials →
lens glows → REC + viewfinder HUD → idles and follows the mouse.
Falls back to a photo if WebGL is unavailable. Respects reduced-motion.

## Optional: swap in a Gemini/Veo video as frames
1. Generate the clip (prompt below), 1:1 or 4:3, transparent-looking wine background.
2. Export frames:
   `ffmpeg -i camera.mp4 -vf "fps=30,scale=1400:-1" -c:v libwebp -quality 82 assets/frames/camera_%03d.webp`
3. In `js/main.js` set `CONFIG.heroFrames.count` to the number of frames
   (optionally `loopFrom` to loop the idle tail). The 3D model is skipped automatically.

**Gemini prompt:**
> Cinematic product reveal of a premium black full-frame mirrorless cinema camera with a 24–70mm lens, no logos or brand text. Starts as a glowing cream-coloured wireframe blueprint, parts exploded and floating apart, slowly assembling together while the camera rotates from a side view to a three-quarter front view. A soft horizontal light scan sweeps upward and turns the wireframe into real matte black leatherette, satin metal dials and a deep purple-reflective lens. Finally the red record button lights up and the lens glass glows softly. Deep wine-red (#7F3242) studio background with soft vignette, soft key light top-left, rose rim light, shallow depth of field, locked-off camera, 8 seconds, 4K, photoreal.

## Forms
Paste your GHL Inbound Webhook URL into `CONFIG.ghlWebhookUrl` in `js/main.js`.
