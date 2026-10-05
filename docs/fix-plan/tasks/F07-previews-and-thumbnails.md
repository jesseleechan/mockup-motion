# F07: Real template previews, shot thumbnails, and project thumbnails

**Size:** M · **Depends on:** F04, F06

## Bugs

1. **Template previews are fake.** `public/templates/*.webp` are 4 KB placeholder cards showing the template's name and a fake "PREVIEW" button (`../evidence/08-fake-template-preview.webp`). There are no `.webm` files. `scripts/template-previews.ts` swallows errors (`.catch(() => {})` on `__labReady`), writes "fallback posters" when rendering fails, and has comments about "dummy webm placeholder".
2. **Timeline shot cards have no thumbnails.** `src/editor/timeline/ShotCard.tsx` never renders the shot; WP-14 required an engine-rendered thumbnail at the shot's midpoint.
3. Project thumbnails in the Projects dialog need checking: confirm they show real renders, not placeholders. If they are placeholders, fix them in this task.

## Required changes

1. **Rewrite `scripts/template-previews.ts`**
   - Build the app (`vite build`), serve `dist/` and open `/lab`.
   - For each template:
     - Call `window.__exportWithEngine(previewDoc, provider, { resolution: 360, fps: 24, quality: "web", format: "webm", supersample: 1, motionBlur: false })` and save `public/templates/<id>.webm`.
     - Render the frame at 35% of the total as PNG through the existing `exportCurrentFrame`, then convert it with `sharp` to `public/templates/<id>.webp` (quality 82).
   - Fail with exit code 1 on any error, including when a `.webm` file is over 450 KB. No fallbacks or placeholders.
   - Print a table of id, duration, bytes and dimensions.
   - Commit the generated files.
2. **Gallery cards** (`TemplateGalleryModal.tsx` and the Library list)
   - Show `<video muted loop playsInline preload="none" poster="/templates/<id>.webp">`. Play on hover and keyboard focus; pause and reset on leave and blur.
   - Under `prefers-reduced-motion`, show the poster only.
   - Library list cards show the poster thumbnail.
3. **`ThumbnailRenderer`** (`src/editor/thumbnails/ThumbnailRenderer.ts`)
   - One shared `Engine` on an `OffscreenCanvas` (or a hidden canvas), 320 px on the long side × `min(dpr, 2)`.
   - API: `render(doc, t, aspect) → Promise<string>`, returning an object URL. It uses a serial queue, debounces each key by 300 ms, and caches by `hash(shot JSON + aspect + asset ids)`.
   - Revoke URLs that are no longer used.
   - `ShotCard` shows the thumbnail of the shot at its local midpoint. The Projects dialog uses the project at 35% of the total (store it with the existing `putThumb`, at most once per 30 s while editing).

## Tests

- **Unit** (Node, `tests/template-previews.test.ts`): for each of the 12 templates, `public/templates/<id>.webm` exists and Mediabunny `Input` reads it. Its duration equals `schedule(previewDoc).total` ±1 frame, its dimensions are 640×360 (360×640 for 9:16 templates), and it is ≤ 450 KB. Each `.webp` poster is ≥ 15 KB and its decoded pixels are not a single flat colour (standard deviation > 10).
- **E2E:** after applying a template, every timeline shot card has an `<img>` with `naturalWidth > 0`. Changing the shot's camera updates that thumbnail within 1.5 s.

## Acceptance criteria

- [ ] The script runs cleanly from a clean checkout. Its output table is in the PR.
- [ ] Commit screenshots of the gallery (with previews) and the timeline (with thumbnails) under `docs/fix-plan/evidence/F07/`.
