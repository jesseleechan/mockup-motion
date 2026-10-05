# F09: Export dialog and export correctness

**Size:** M · **Depends on:** F03 (and F01/F02 for correct pixels)

## Problems

1. **Broken dialog layout** (`../evidence/09-export-dialog-layout.webp`). The settings sit in a cramped 4-column grid. Select values wrap onto 2–3 lines ("MP4 (H.264)", "30 fps (Web)", "High (16 Mbps)"), and labels overlap their controls ("Resolution" over its select, "Motion Blur" over "Anti-Aliasing").
2. **The summary contradicts the warning.** The summary line says "MP4" while the warning above it says "exporting WebM (VP9)". The summary prints the requested format, not the probed one (`ExportModal.tsx:474`).
3. **Motion blur** uses 4 samples (`engine-worker.ts:132`); the spec is 8 samples at a 180° shutter. `Engine.renderAccumulated` renders only `layers[0]`, so transitions disappear while motion blur is on.
4. `engine-worker.ts:40-58` duplicates `calculateBitrate` and `keyframeIntervalFor` instead of importing them from `destinations.ts`, and the two copies already differ in signature.
5. `tests/e2e/text.spec.ts:93` fails where H.264 is unavailable instead of using the probe.
6. The lab export spec (`lab.spec.ts:104`) times out at 45 s under SwiftShader.

## Required changes

1. **Dialog layout** (`src/editor/export/`). Split `ExportModal.tsx` into `DestinationPicker`, `EncodingSettings`, `ExportSummary`, `ExportProgress` and `ExportResult`, each under 250 lines.
   - Settings use a 2-column grid of stacked fields (label above control). The minimum control width fits its longest option on one line.
   - The dialog is 600 px wide.
2. **Truthful summary:** after the probe resolves, the summary shows the **actual** container and codec ("WebM · VP9"), dimensions, fps, duration, and the size estimate from the actual bitrate. While probing it shows "Checking encoder…". The download filename extension matches the container.
3. **Composite before accumulation** (`src/engine/Engine.ts`)
   - Add `renderComposite(t, target)`. It renders the active layers and the transition blend into a linear target, without vignette, encoding or grain.
   - `renderAt` becomes `renderComposite` + `finalPass(target)`.
   - `renderAccumulated(t, shutter, samples)` accumulates `renderComposite` results for each sample, then runs the final pass once.
   - The export worker uses 8 samples and a 0.5/fps shutter (quality-bar §5 and WP-08).
4. Import the bitrate helpers from `destinations.ts` in the worker and delete the duplicates.
5. Make sure `verify.ts` runs after every export. Show its warnings in the result view.
6. **Cancel:** `worker.terminate()`, revoke any object URLs, return to the settings view. No leftover worker; check with a counter in a dev build.
7. **Tests:**
   - `text.spec.ts:93`: probe `canEncodeVideo("avc", …)` at runtime and `test.skip(true, "H.264 encoder unavailable in this Chromium build")` when it is false. This is the only allowed skip (README §3, rule 3).
   - `lab.spec.ts:104`: export 1 s at 640×360 (not 2 s at 1080p), so the test measures correctness rather than SwiftShader speed. Keep the dimension and duration assertions.

## Tests

- For each destination preset, an e2e export runs (WebM where MP4 is unavailable), and Mediabunny reports the expected dimensions and duration (±1 frame).
- A decoded frame from a `responsive-pair` export is right side up (F01 quadrant helper) and its phone screen is not the empty fill colour (F03).
- **Motion blur with a transition:** a 2-shot doc with a 0.6 s fade, exported with motion blur on. The decoded frame at the transition midpoint differs from both the frame 0.3 s before and the frame 0.3 s after (mean absolute difference > 2), which proves the transition is present.
- **Layout guard:** in the export dialog at a 1280×800 viewport, no control has `scrollWidth > clientWidth + 1` and no label's box intersects its control's box.

## Acceptance criteria

- [ ] All tests pass. Reverting the composite-accumulation change fails the motion-blur test (paste the output).
- [ ] Commit a dialog screenshot (settings, progress and result) under `docs/fix-plan/evidence/F09/`, plus the verify output for one MP4 export (where available) and one WebM export.
