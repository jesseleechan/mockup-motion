# P05 follow-ups: balanced sliders, still slider camera, Frames in 30 s

The owner judged three open follow-ups on the P05 contact sheet and chose the recommended fix for each ("lets go with your recommendations", 8 October 2026, [#30](https://github.com/jesseleechan/mockup-motion/pull/30)). Renders are from this branch on Windows (SwiftShader). Nothing here was watched as video.

## 1. A slider with an even number of screenshots is balanced

When there are fewer screenshots than slots the frame can show, the slider lights only a window of slots. That window used to be N slots, so with 4 screenshots at 16:9 and 4:3 Mobile Slider showed one card left of the active one and two right of it. The window is now centred on the active card: N slots, or N − 1 when N is even (and more than 2), so 4 screenshots show one card each side at rest. The fourth screenshot waits off the window and fades in as its slot enters, as the far cards already did. No screenshot shows twice, and the loop is unchanged (frame(total) ≡ frame(0)).

- `mobile-slider_4-screenshots_balanced_16x9-top_4x3-bottom_t0-t1.webp`: the `slider-x` fixture (4 screenshots) at 16:9 (top) and 4:3 (bottom), at rest (0 s, left) and at 1.0 s (right). At rest: Field Notes, Aurelia (active), Northwind. At 1.0 s Field Notes has faded out on the left and Maison Oak fades in on the right. Compare `../P05/follow-ups/mobile-slider_4-screenshots_16x9-left_4x3-right_t0.webp`.
- `desktop-slider_4-screenshots_16x9-top_4x3-bottom_t0-t1.webp`: the `slider-y` fixture (4 screenshots). The vertical slider shows one card above and one below at these aspects, as before.

With 5 screenshots (the gallery previews, the contact sheet and the visual baselines) nothing changes, so the approved baselines stay valid.

## 2. A slider shot has no camera controls

The Shot inspector no longer shows the Camera section for a slider. `fixedShotCamera` (`src/motion/layouts/duration.ts`) keeps a slider's camera still (`static`, intensity 0, float 0); the editor store applies it after every edit and `sanitizeDoc` on load, so a document that had a camera move on a slider shot loops natively again. Other layouts keep their camera.

## 3. A Frames shot fits in 30 s

`framesAssetIds` (`src/motion/layouts/rows.ts`) is the first screenshots whose period fits 30 s at 0.20 frame heights per second: 10 with the 3-row cards (4:5, 9:16, 1:1) and 8 with the 2-row cards (16:9, 4:3). The layout draws only those, and `framesDuration` counts only those, so it is at most 30 s and the speed stays under the limit. The inspector says "Shows the first 10 screenshots, so the loop fits in 30 s." when some are left out, as the slider does past 18.

## Tests and mutation runs

Each run reverts one change, runs its guard, and restores the file from git. Every guard failed as expected and passed after the restore.

| Change reverted | Guard | Result |
| --------------- | ----- | ------ |
| Lit window back to N slots | `layouts.test.ts` "is balanced at rest" | `16 unbalanced frames: expected [ 'x 16:9 N=4 t=0.00: 1 \| 2', …(9) ] to deeply equal []` |
| Store doesn't keep the slider camera still | `slider-presets.test.ts` "a camera move is undone" | `expected { Object (preset, intensity, ...) } to deeply equal { preset: 'static', …(3) }` |
| Still camera reassigned on every edit | `slider-presets.test.ts` "an edit that changes nothing stays a no-op" | `expected { version: 2, …(10) } to be { version: 2, …(10) } // Object.is equality` |
| `sanitizeDoc` keeps the loaded camera | `slider-presets.test.ts` "a loaded slider with a camera move gets a still camera" | `expected { preset: 'orbitLeft', …(3) } to deeply equal { preset: 'static', …(3) }` |
| Frames shows every screenshot | `frames.test.ts` "Frames fits a 30 s shot" (3 tests) | `16:9: expected [ 'd1', …(15) ] to deeply equal [ 'd1', …(3) ]`; `16:9: expected [ { id: 'row0:item8', …(9) }, …(23) ] to deeply equal []`; `expected 30 to be 32` |
| Camera section shown for sliders; Frames note removed | `slider.spec.ts` "a slider shot has no camera controls", `frames.spec.ts` "more screenshots than fit 30 s" | `getByRole('group', { name: 'Camera move' })` expected 0, received 1; `getByText('Shows the first 10 screenshots, so the loop fits in 30 s.')` not visible |
