# F05: Stage sizing and preview playback loop

**Size:** M · **Depends on:** F03

## Bugs

1. **The preview is a ~300 px thumbnail** inside a 1,000 px stage (`../evidence/07-editor-tiny-upside-down-preview.webp`). `src/editor/stage/Stage.tsx:288-296` gives the wrapper `width`/`height: "auto"` with `aspect-ratio` and no definite size. The canvas inside falls back to its default 300×150 box, and the engine's `ResizeObserver` measures that box.
2. **Playback rebuilds the scene every frame.** In `src/engine/react/EngineCanvas.tsx`:
   - `:109-116`: the `setDocument` effect lists `playhead` as a dependency. While playing, `setPlayhead` changes every frame, so `setDocument` (dispose and rebuild every device, re-rasterize all text) runs every frame.
   - `:85-106`: the `ResizeObserver` effect is torn down and recreated every frame (also depends on `playhead`).
   - `:123-163`: the playback loop effect also depends on `playhead`. It is cancelled and restarted every frame, and `lastTime` is reset each time.
   - `:147`: the playhead always wraps with `% total`, ignoring `doc.loop`.
3. The DPR is uncapped. A 3× display creates huge targets on top of the 1.5× supersample.

## Required changes

1. **Stage fitting** (`Stage.tsx`)
   - Measure the stage area with a `ResizeObserver` and subtract 32 px padding on each side.
   - Compute `fitW = min(availW, availH × ratio)` and `fitH = fitW / ratio`, and set **explicit pixel** `width`/`height` on the canvas wrapper.
   - Zoom options are Fit, 75% and 50% of the fitted size. Remove the current "auto" logic.
2. **`EngineCanvas` refactor.** Keep the props the same and split the effects:
   - **Init** (runs once): create the engine at the measured size × `min(devicePixelRatio, 2)`.
   - **Resize:** a `ResizeObserver` on the container, with no `playhead` dependency. It calls `engine.resize`, then `renderAt(playheadRef.current)`.
   - **Document:** depends on `[doc, assets]` **only**. Call `setDocument`, then render at `playheadRef.current`. F03's generation guard handles overlapping calls.
   - **Paused rendering:** subscribe with `useUIStore.subscribe(s => s.playhead, …)` outside React's render cycle, and render on change while not playing.
   - **Playback:** one effect keyed on `[playing]`.
     - A `requestAnimationFrame` loop keeps `t` in a ref and reads the document from `docRef`.
     - Each tick: `t += dt`. If `t >= total`: when `doc.loop` is true, set `t -= total`; otherwise clamp to `total`, set `playing = false`, and stop.
     - Call `engine.renderAt(t)` every frame. Write `t` to the store at most every 33 ms. The store write must not retrigger this effect.
   - Keep adaptive quality: drop supersample after 30 slow frames, and restore it on pause.
3. **Counters:** use F03's `engine.debugInfo().setDocumentCalls` and `renderCalls`, and expose the engine on `window.__editorEngine` in dev builds.

## Tests

`tests/e2e/stage.spec.ts`:

1. At a 1600×1000 viewport with the default panels, after loading demo content, the canvas's bounding box is within ±2% of the computed fit for the stage, and its aspect ratio matches the document's aspect ±1%. Run this for 16:9, 9:16 and 4:3.
2. Resizing the viewport to 1280×800 re-fits the canvas (same assertion).
3. Play for 2 s: `setDocumentCalls` does not increase, and `renderCalls` increases by at least 30.
4. With loop off, playback stops at `total` and the transport shows the end time. With loop on, the playhead wraps past 0.
5. While paused, scrubbing the timeline triggers renders without `setDocument`.

## Acceptance criteria

- [ ] All stage tests pass. Restoring `playhead` in the document effect's dependencies fails test 3 (paste the output).
- [ ] Commit editor screenshots at 1600×1000 and 1280×800 under `docs/fix-plan/evidence/F05/`, with the preview filling the stage.
