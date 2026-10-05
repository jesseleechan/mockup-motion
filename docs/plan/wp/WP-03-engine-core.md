# WP-03: three.js engine core, preview, worker export, and `/lab`

**Milestone:** M1 · **Depends on:** WP-00 (uses WP-02's `evaluate` when available; stub `FrameState` until then) · **Size:** L

## Goal

Build the rendering engine that preview and export share. It turns a `FrameState` into pixels with three.js, renders color-exact and crisp screenshots, runs in the main thread and in a worker, and exports through the existing Mediabunny pipeline. Also build a dev-only `/lab` page where everyone can see and review the output.

**This WP starts with a spike.** The go/no-go gate below decides whether three.js is the right engine before anyone builds on it.

## Context (read first)

- `docs/plan/README.md` §2 (three.js decisions and gotchas), `contracts.md` §3, §6, §7, §9
- `quality-bar.md` §3.1 (screen fidelity), §5 (no bloom or flares)
- Existing export to reuse: `src/export/encode.ts`, `src/export/video.worker.ts`, `probeExport` in `src/export/video.ts`

## Scope

**In**

1. **Dependency:** add `three` and `@types/three`.
2. **`Engine` (`src/engine/Engine.ts`)** per `contracts.md` §7.
   - Renderer: `WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer })`, `outputColorSpace = SRGBColorSpace`, `toneMapping = NoToneMapping`. Read `capabilities.maxTextureSize` and `getMaxAnisotropy()`.
   - `setDocument` diffs by shot id, node id, and asset id, rebuilds only what changed, and resolves when every needed texture is uploaded. Call `renderer.compile` or render once offscreen so the first visible frame never stutters.
   - `renderAt(t)`: `evaluate(doc, t)` → for each layer, render into an MSAA `WebGLRenderTarget({ samples: 4 })` sized `output × supersample` → final pass (fade blend only in this WP; WP-14 adds the other transitions, WP-08 adds grain, vignette, dither, and a better downsample) → canvas.
   - Handle context loss: listen for `webglcontextlost`/`webglcontextrestored`, rebuild GPU resources from the cached doc, and expose an `onContextRestored` callback.
   - `dispose()` frees every texture, geometry, material, and render target. Verify with `renderer.info.memory`.
3. **Stage (`src/engine/stage.ts`):** a perspective camera from `CameraPose` per `contracts.md` §3 (fit distance, orbit about the target, roll), with near and far planes tight around the content.
4. **Textures (`src/engine/textures/`)**
   - Requested width = `ceil(screenWidthPx × 1.5)` (×2 for `master`), bucketed to limit re-decodes, through `AssetProvider.getImage`.
   - **Tiling:** split images taller than `min(maxTextureSize, 4096)` into strips. Upload with `SRGBColorSpace`, `generateMipmaps`, `LinearMipmapLinearFilter`, and max anisotropy.
5. **Screen compositor (`src/engine/materials/screen.ts`)**
   - Each device screen owns a render target the size of its on-screen viewport in px (with mipmaps). Draw the visible tile strips at the current `scroll` into it with an orthographic camera.
   - Re-render the target only when scroll, cursor, or size changes. Static screens render once.
   - The screen mesh samples this target through an unlit `ShaderMaterial`. It uses a signed-distance rounded-rect mask (corner radius uniform) with `fwidth` anti-aliasing for crisp corners at any scale and angle.
   - Fill the area below a short screenshot with its bottom-row average color (quality-bar §3.1).
6. **Placeholder devices and background.** Define a `DeviceBuilder` interface (`build(node, style, ctx) → { object3d, screen, update(node), dispose }`) and ship only `card` (screen with border). Other devices fall back to `card` until WP-06. Background is solid color only, behind an interface WP-07 implements (`BackgroundRenderer.render(target, frame, style)`).
7. **Preview component (`src/engine/react/EngineCanvas.tsx`):** a thin React wrapper (the only React file in `engine/`).
   - Size the canvas from CSS size × `devicePixelRatio` via `ResizeObserver`.
   - Render on demand when paused (doc or time change). Use `requestAnimationFrame` while playing, with time from the store playhead.
   - **Adaptive quality while playing:** if the average frame time is over 20 ms for 30 frames, drop the internal supersample to 1, then the pixel ratio to 1. Restore full quality when paused.
8. **Worker export (`src/export/engine-worker.ts`)** per `contracts.md` §9: `OffscreenCanvas` + `Engine` with `preserveDrawingBuffer: true`. Render frame `i` at `t = i / fps`, then `CanvasSource.add(t, 1/fps)` (reuse `encode.ts` patterns: bounded awaits, progress, cancel, cleanup). The main thread decodes images at export size and transfers `ImageBitmap`s. Text stays empty until WP-10. Expose `exportWithEngine(doc, settings, signal, onProgress)` in `src/export/engine-export.ts`. Do not remove the legacy path; WP-16 does that.
9. **`/lab` (dev only, `src/lab/`):** route when `import.meta.env.DEV && location.pathname.startsWith("/lab")`, lazy-loaded from `main.tsx`.
   - Fixture picker (`src/lab/fixtures/*.json`: ProjectDocs referencing images in `public/demo/`), aspect switcher, play, scrub, a time readout with frame stepping, "Export 1080p", and an `engine.info` panel (draw calls, textures, frame ms).
   - URL params `?fixture=…&t=…&aspect=…&w=…` render a single still for visual tests. Set `window.__labReady = true` once rendered.
10. **Playwright:** add `@playwright/test`, `playwright.config.ts` (uses `/opt/pw-browsers` when present), and `tests/e2e/lab.spec.ts` (renders a fixture still and asserts the canvas is not blank; exports 2 s and verifies dimensions and duration with Mediabunny `Input`). Script: `test:e2e`.

**Out:** real device frames (WP-06), backgrounds beyond solid (WP-07), shadows and post-processing (WP-08), layouts beyond `single` (WP-09), text (WP-10), editor integration (WP-12).

## Spike: go/no-go gate (do first, report in the PR before finishing the rest)

Fixture: a `card` showing a 1440 × 9000 screenshot with scroll enabled, at `heroTilt`, 1080p. If WP-04's demo captures have not landed, make the fixture yourself: write a long HTML page with realistic 14–16 px body text, headings, and images, and take a full-page Playwright screenshot at 1440 wide. Small body text is required to test shimmer honestly.

| Check | Pass if |
|---|---|
| Color exactness | Frontal camera, 20 sampled screen pixels vs. source: max channel difference ≤ 2 (8-bit) |
| Text shimmer | 3 s `orbitLeft` export at 1080p30. Small body text in the screenshot shows no visible shimmer (attach the video). Compare with and without pre-downscale. |
| Preview performance | ≥ 50 fps for a 1440 × 810 canvas on an integrated GPU (state the machine) |
| Export speed | 6 s at 1080p30 finishes in ≤ 12 s in Chromium |
| Memory | 20 `setDocument` cycles return `renderer.info.memory` to baseline |
| Worker | The same frame rendered in the main thread and in the worker differs by at most 2 per channel |

If any check fails and you cannot fix it within the WP, stop and report options to the user. Do not continue on a failed gate.

## Acceptance criteria

- [ ] All spike checks pass, with evidence (numbers, frames, a video) in the PR.
- [ ] `/lab` renders fixtures at all 5 aspects. Scrubbing is deterministic: the same `t` gives identical pixels.
- [ ] Export from `/lab` produces a verified MP4 (or WebM in Playwright Chromium) with the correct dimensions and duration within ±1 frame.
- [ ] Context loss simulated with `WEBGL_lose_context` recovers without reloading the page.
- [ ] No React or DOM imports in `src/engine/` outside `react/`.
