# MockupMotion implementation plan

Reviewed October 4, 2026. This plan covers the existing React/Vite app in `mockup-motion` and the public editor at [shots.so](https://shots.so/).

## Product direction

Create a small presentation studio for website screenshots. The core workflow is **drop screenshots → choose a visual preset → make a few adjustments → export a beautiful video**. Users should see their actual work throughout that process.

The default experience should be calm: static screenshots inside frames, slow movement of the overall composition, restrained effects, and good spacing. Add **“Scroll within screenshot” as an optional advanced toggle, off by default**. Tall screenshots must never start scrolling automatically.

Preserve browser-local rendering, no required account, and watermark-free exports. Keep React, Vite, TypeScript, Tailwind, and the shared Canvas preview/export approach.

## What exists and what needs work

| Area | Current implementation | Implication |
| --- | --- | --- |
| Workflow | `src/App.tsx` switches among style, upload, and preview screens. | Replace the wizard with a persistent editor; media and preset changes should happen beside the preview. |
| Styles | `src/types.ts` has two `AnimationStyle` values: screenshot rows and phone columns. | Layout, device appearance, and motion are coupled. Separate them before adding presets. |
| Controls | `TweakControls.tsx` offers duration, background, phone finish, speed, easing, and two effect toggles. | Useful basics, but no composition size, spacing, crop, direction, or effect intensity. Phone finish is shown even when editing screenshot rows. |
| Assets | `App.tsx` automatically preloads both sample sets; uploads append to those sets. | A user can export unrelated demo screens alongside their own. Make demos explicit and separate from project assets. |
| Uploads | `UploadSection.tsx` has desktop/mobile tabs, sequential decoding, and console-only errors. | Add one media library, reorder/replace actions, visible validation, and safe asynchronous updates. |
| Frames | `canvasRenderer.ts` centers/crops screenshot cards and fits phone screenshots by width. | Short images can leave empty phone-screen space; tall images lack crop positioning. Use a shared, explicit image-fit model. |
| Motion | Rows and columns move by elapsed seconds. Phone content receives `scrollY = 0`. | Current content already stays static, which is the right default. Optional internal scrolling needs a separate setting. |
| Looping | Preview time resets to zero; spatial wrapping happens at arbitrary travel distances. | Spatial wrapping does not guarantee that the exported video loops cleanly. Image order, lighting, and transforms must agree at the loop boundary. |
| Preview | `PreviewStage.tsx` redraws continuously, even when paused, and updates React time state each frame. | Separate playback from document state; draw on demand when paused and throttle timecode updates. |
| Export | `videoExporter.ts` hardcodes 1080-class output, 60 FPS, 8 Mbps, and one AVC configuration. | Add export settings, codec capability checks, cancellation, bounded encoding queues, and resource cleanup. |
| Fallback | MediaRecorder can produce WebM, while `ExportModal.tsx` still says MP4 and uses `.mp4` for a second download. | Return actual format metadata and use it for the label, filename, and download action. |
| Setup | Standard npm install fails on the Vite/esbuild peer dependency conflict. `mp4-muxer` is deprecated. | Repair reproducible dependency installation and migrate the export wrapper to a maintained library. |
| Persistence | Config and image lists live only in component state. | Add undo/redo, local autosave, and reusable personal presets. |

Other fixes to include: stop sample-loading completion from overwriting a user's uploads, clamp the playhead when duration changes, use pointer capture for scrubbing, handle empty asset lists explicitly, and scale shadow/border/radius values consistently between preview and export.

## Editor design

Use the reference's visual selection and direct manipulation patterns: a quiet neutral shell, rounded panels, clear selected states, and a large canvas. Shots exposes style thumbnails, layout presets, background options, and grouped controls beside the composition. Adapt those patterns to a video-focused workflow with fewer initially visible controls.

Suggested desktop arrangement:

```text
Project name / saved state       Undo / Redo       Output size       Export
┌─────────────────┬────────────────────────────┬─────────────────────┐
│ Presets / Media │                            │ Contextual settings │
│                 │       Live preview         │ Layout              │
│ Visual cards    │                            │ Frame               │
│ Asset thumbnails│                            │ Background          │
│                 │                            │ Motion              │
│                 ├────────────────────────────┤ Branding            │
│                 │ Play · Scrub · Time · Loop │                     │
└─────────────────┴────────────────────────────┴─────────────────────┘
```

- **Top bar:** editable project name, autosave status, undo/redo, aspect ratio, and one primary Export button.
- **Left panel:** tabs for Presets and Media. Presets use real rendered thumbnails and animate on hover or focus. Media supports upload, paste, drag/drop, replacement, removal, and ordering.
- **Center:** fit the actual output rectangle into the available space without stretching it. Keep playback controls underneath it. Canvas zoom is an editor view setting, separate from video composition scale.
- **Right panel:** collapsible control groups. Show relevant settings for the selected layout/frame. Sliders have readable values, numeric entry where useful, and per-section reset.
- **Empty state:** an inviting drop target and a secondary “Try demo” action. After upload, immediately display a compatible starting composition.
- **Smaller screens:** keep the preview visible and move presets/settings into tabbed drawers or a bottom sheet. Do not stack the whole desktop inspector into a very long page.

Use a light neutral shell as the initial direction, following the reference. The exported background remains independent of the editor theme. Add a dark editor theme later if useful.

## Preset library

Start with eight curated presets built from a small set of reusable layouts. Each preset supplies a coordinated layout, frame, background, spacing, and motion configuration. Applying it preserves uploaded assets and the chosen output ratio; changing a setting marks it as customized.

| Preset | Composition and motion | Best use |
| --- | --- | --- |
| Clean Hero | One browser frame, generous margins, gentle zoom. | A single homepage or landing-page design. |
| Soft Studio | One frameless screenshot, warm background, subtle drift. | Editorial and minimal website designs. |
| Midnight Rows | Alternating horizontal rows on a dark background. | Multiple pages or portfolio work. |
| Gallery Wall | A spacious screenshot grid that moves slowly together. | Collections of designs. |
| Angled Gallery | Slightly rotated rows with restrained diagonal movement. | A more expressive portfolio presentation. |
| Phone Columns | The existing two-column device layout, improved spacing and finish. | Mobile websites. |
| Phone Spotlight | One centered phone with subtle vertical drift. | One mobile design. |
| Responsive Pair | Desktop and phone frames together with coordinated gentle motion. | Desktop and mobile versions of a website. |

Requirements:

- Render thumbnails using the same scene renderer as the main canvas.
- Show useful recommendations based on asset count and assignment, without changing the user's choice automatically.
- Reflow compositions for 16:9, 9:16, 1:1, and 4:5. Output ratio is separate from screenshot dimensions and device proportions.
- Make repeated assets intentional when a gallery has few images; avoid showing the same screenshot at every prominent position.
- For Responsive Pair, explicitly assign a desktop image and a mobile image. A desktop screenshot cannot be turned into a responsive mobile design by cropping it.
- Include preset reset, favorites, and “Save as preset” after the core preset application flow works.

## Settings

| Group | Everyday controls | Advanced controls |
| --- | --- | --- |
| Layout | Composition scale, padding, spacing, alignment. | Row/column count, rotation, individual placement where supported. |
| Frame | None, rounded screenshot, browser, phone; light/dark appearance. | Border width, corner radius, browser title/URL, phone finish, status details. |
| Image | Fixed crop position, fit/fill, replace screenshot. | Per-image focal point and crop reset. |
| Background | Solid, two-color gradient, studio spotlight; curated palettes. | Gradient angle, spotlight intensity, custom background image, optional subtle texture. |
| Motion | Duration, still/drift/glide/zoom, direction, intensity, loop toggle. | Easing, start/end holds, optional internal screenshot scrolling. |
| Effects | Shadow strength; reflection toggle. | Shadow blur/offset, reflection opacity. Animated lighting is opt-in. |
| Branding | Optional title and logo. | Placement, font, color, size, safe margins. |

Use 6 seconds and gentle motion as starting defaults. Keep effects subdued and provide a still option. Label controls in terms of the result: “Spacing,” “Motion amount,” and “Shadow,” rather than internal rendering terminology.

### Optional internal screenshot scrolling

- Add `contentMotion.enabled`, defaulting to `false` in every built-in preset.
- Show “Scroll within screenshot” under advanced motion for single browser/phone presentations.
- Only enable it when the fitted image is taller than its frame viewport. Otherwise explain that no scrollable content exists.
- Reveal start/end crop positions and hold duration only when enabled. Compute travel from the actual fitted image height and clamp it to valid bounds so no empty area appears.
- Keep content movement independent of movement of the frame. Use one clear content movement with start/end holds; looping mode must also define a smooth return.
- Leave gallery rows and device columns static internally in the first release. Provide the compatible single-frame presets for this option.

## Technical structure

Keep a single deterministic rendering contract: **project + time + target dimensions → frame**. Avoid implementing an animation only with CSS in preview; it would not automatically appear in Canvas exports.

Split the current flat config into a serializable document:

```ts
ProjectDocument {
  version;
  id;
  name;
  assets;          // Metadata and references to stored image blobs.
  composition: {
    layout;
    assetAssignments;
    frame;
    background;
    motion;
    contentMotion;
    effects;
    branding;
  };
  exportSettings; // Output ratio, resolution, FPS, quality, requested format.
}
```

- **Document state:** a reducer and focused hooks are sufficient initially. Keep playhead, panel state, selection, and preview zoom outside undo history.
- **Asset runtime:** decoded images and temporary object URLs live in an asset manager, outside the serialized project. Generate thumbnails and lower-resolution preview assets; retain original pixels for export.
- **Storage:** use IndexedDB for project documents and image blobs. Debounce autosave; provide a saved/restored state and a recoverable storage-full message. Recreate temporary URLs on restore.
- **History:** store meaningful edit transactions. One slider drag is one undo operation; preset application is one operation. Keep asset references available for undo and reclaim resources when no longer referenced.
- **Renderer:** extract background, frame, image crop, layout, motion evaluation, and overlays into modules. Use normalized layout coordinates or a consistent logical coordinate space; fixed pixel shadows must not change relative appearance at export size.
- **Playback:** use a ref-based clock, skip unchanged paused frames, and pause preview while exporting. Draw the edited scene immediately while paused.
- **Motion:** evaluate transforms from timestamps instead of accumulating movement frame by frame. Looping must account for the complete ordered image pattern and any animated background/reflection. For seamless loops, derive compatible travel from duration and repetition; show motion amount rather than promising arbitrary speed with exact loop closure.

Suggested modules: `editor/`, `presets/`, `rendering/`, `assets/`, `storage/`, and `export/`. Replace the wizard-specific components incrementally; preserve the existing renderer/export behavior while extracting it.

## Export experience

Open an export dialog before rendering. Show a simple summary such as **1920 × 1080 · 30 FPS · 6 seconds · MP4** with resolution, frame-rate, and quality selectors.

First release:

- 720p and 1080p-class sizes; 30 FPS default and 60 FPS optional.
- Preferred MP4/H.264 output where supported, clearly labeled WebM fallback where necessary.
- Probe the actual requested encoder configuration before rendering. Checking only whether `VideoEncoder` exists is insufficient.
- Migrate `mp4-muxer` to Mediabunny behind an exporter adapter. The maintainer [states that mp4-muxer is deprecated and superseded by Mediabunny](https://github.com/Vanilagy/mp4-muxer).
- Use bounded encoder queues, cancellation, and `finally` cleanup for encoders, frames, recording tracks, and temporary URLs. Introduce a worker/OffscreenCanvas path after validating feature support; retain a main-thread path.
- Progress states: preparing, rendering, finishing, complete, cancelled, failed. Show the preparing state immediately and preserve project edits on failure or cancellation.
- Return `{ url, mimeType, extension, filename, width, height, fps, duration }`; keep labels and both download actions consistent with the actual output.
- On completion, provide video playback and an explicit Download action. Do not start an automatic second download or claim a file has been saved before the user chooses it.
- Add PNG export of the current frame using the same composition renderer.

4K and batch exports follow once memory use and codec support are measured. Transparent backgrounds may be supported for PNG; ordinary MP4 output should use an opaque background.

## Implementation order and completion criteria

| Phase | Work | Complete when |
| --- | --- | --- |
| 1. Reliable foundation | Repair dependency compatibility; document package-manager setup; separate document/assets/playback state; fix demo mixing, crop gaps, export format metadata, and cleanup. Extract renderer modules. | A clean supported installation, typecheck, and production build work; existing rows/phones export correctly; user uploads cannot be overwritten by samples. |
| 2. Persistent editor | Replace wizard with editor shell, Presets/Media panel, contextual inspector, fitted canvas, and playback bar. Add upload/paste, reordering, replacement, and undo/redo. | User uploads and edits a composition without leaving the preview. Desktop and smaller-screen controls remain usable and keyboard accessible. |
| 3. Visual system and presets | Separate layouts/frames/motion; add single hero, gallery, and responsive-pair layouts; implement eight presets, backgrounds, crop controls, composition settings, and restrained effects. | Every preset works with representative assets at all four output ratios and produces matching preview/export frames. |
| 4. Motion polish | Improve looping, duration handling, direction, intensity, holds, and optional internal scrolling. | Default presets keep screenshots static; enabling the advanced toggle only moves valid content; loops have no visible reset. |
| 5. Export controls | Add format/quality dialog, maintained media adapter, encoder probing, cancellation, bounded queues, supported worker path, correct fallbacks, PNG export, and completed-video download. | Requested dimensions/FPS/duration and actual MIME type match downloaded output; cancellation/failure releases resources and returns to a usable editor. |
| 6. Persistence and finish | Add local autosave/restore, favorites, custom presets, title/logo options, accessibility polish, and setup documentation. | Refresh restores assets and composition; user saves and reapplies a personal preset; the complete workflow is verified with real website screenshots. |

After phase 2, the editor should already be useful with the original two layouts. Deliver further phases as working increments.

Defer multi-scene editing, audio, 3D device rotation, automatic website capture, cloud projects, and collaboration. These substantially expand the app beyond the requested screenshot presentation workflow.

## Validation

Add focused tests around image crop geometry, aspect-ratio layout, preset application, timestamp-based motion, loop boundaries, undo transactions, and actual export format metadata. Use browser tests for upload → preset → tweak → preview → export, including optional scrolling on/off and project restoration.

Fixtures should include one screenshot, many screenshots, tall pages, short images in phone frames, mixed desktop/mobile assets, unusually large files, corrupt files, and an empty project. Check supported browsers with the actual encoder settings rather than assuming codec support.

Compare frames at equivalent times and normalized geometry between preview and export, allowing for rasterization/encoding differences. Decode exported samples to inspect duration, dimensions, frame count, and first/last motion continuity. Exercise unavailable codecs, WebM fallback, export cancellation, and storage failures.

Baseline review completed:

- Reviewed all current source files, package/config files, and the public shots.so editor.
- Standard npm install fails because the declared esbuild range does not satisfy Vite's optional peer requirement. Dependencies were installed temporarily with `--legacy-peer-deps`, without changing the manifest or lockfile.
- `npm run lint` (currently TypeScript checking) and `npm run build` pass with that temporary setup. Vite warns about `__dirname` compatibility with a future config-loader default.
- Exercised preview entry, pause, style switching, output ratio switching, and a 390 × 844 mobile viewport. No horizontal document overflow at that viewport. The initial browser run had one resource 404; the export run had no HTTP failures or video decode error.
- A baseline screenshot-rows export produced a playable MP4 at 1920 × 1080 with a measured duration of 3 seconds.
- Browser review used temporary headless Chrome through Playwright because the in-app Browser skill was not available in this session. It did not inspect or modify the user's existing tab.

Implementation completed following this plan: persistent editor, eight presets, contextual controls, optional internal scrolling off by default, media management, undo/redo, local autosave, favorites/custom presets, branding, PNG export, and a maintained video exporter with codec probing, a worker path, cancellation, and correct format metadata. Ten unit tests and Chrome workflow checks pass. See README.md for setup and scope. The review baseline above describes the app before implementation.
