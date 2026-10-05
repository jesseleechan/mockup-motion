# MockupMotion

A local screenshot presentation studio. Upload website screenshots, choose a preset, adjust the composition, and export a video or PNG.

## Run

Use Node.js 22.12 or later and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. `npm run build` type-checks and builds the production app; `npm run preview` serves that build.

## Editor

- Eight presets: Clean Hero, Soft Studio, Midnight Rows, Gallery Wall, Angled Gallery, Phone Columns, Phone Spotlight, and Responsive Pair.
- Upload PNG, JPEG, WebP, or AVIF by dropping files, choosing files, or pasting images. Media controls let you replace, remove, reorder, and assign screenshots to desktop/mobile presentations.
- Screenshots stay static inside their frames by default. **Motion → Advanced motion → Scroll within screenshot** enables optional scrolling for a tall screenshot in a single filled browser/phone frame. Gallery and column layouts keep content static.
- Output ratios: 16:9, 9:16, 1:1, and 4:5. The preview fits the actual output rectangle.
- Composition, frame, background, crop, motion, effects, and optional title/logo settings use the same Canvas renderer for preview and export.
- Undo/redo: Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z. A slider drag is one edit. Space toggles playback when focus is outside a control.
- Projects and original image blobs autosave in IndexedDB on this browser/device. Favorites and personal presets use local storage. Wait for the saved indicator before closing the tab. Clearing site data removes the local project and presets.
- Demo images are explicit. The first real upload replaces them rather than mixing them into your work.

## Export

Choose 720p or 1080p-class dimensions, 30 or 60 FPS, standard/high quality, and MP4/WebM. Export is rendered locally; source screenshots are never uploaded to a server. The result appears for playback and an explicit download.

The exporter checks codec support for the requested dimensions, frame rate, and quality. Modern browsers use WebCodecs and Mediabunny, with an OffscreenCanvas worker where supported. Other supported browsers can use a real-time MediaRecorder fallback; keep that tab visible during recording. Unsupported MP4 settings offer correctly labeled WebM output. The export dialog also offers PNG of the current preview frame.

Export cancellation stops its worker or recorder and keeps the editor usable. The original upload is retained for encoding. No account, API key, or external service is required.

## Checks

```sh
npm test
npm run typecheck
npm run build
npm run format
```

The unit tests cover image fitting/crop bounds, output geometry, preset application, static screenshot defaults, loop boundaries, scroll eligibility, and undo/redo. Browser verification covered upload, presets, playback, optional scrolling, undo/redo, custom presets, IndexedDB restore, MP4/WebM/PNG exports, cancellation, and mobile drawers in Chrome.

## Structure

- `src/editor`: workspace components and edit/history state.
- `src/presets`: coordinated preset definitions.
- `src/rendering`: deterministic layout, crop, motion, and drawing.
- `src/assets`: image validation and decoding.
- `src/storage`: local project persistence.
- `src/export`: codec probing, encoding worker, fallback recorder, and output metadata.

The visual direction is recorded in `docs/editor-concept.png`. The architecture website demo in `public/demo/aurelia.png` was generated with the built-in image generation tool from an architecture-homepage brief; it is a demo asset, not a user upload. Existing Canvas-generated desktop/mobile samples provide the other demo screens. The original implementation plan is in `IMPLEMENTATION_PLAN.md`.

Current scope is one locally saved project with reusable presets. Multi-scene timelines, audio, 3D devices, cloud sync, 4K, and batch export are future additions. Automated browser checks currently cover Chrome; Safari/Firefox compatibility still needs separate verification.
