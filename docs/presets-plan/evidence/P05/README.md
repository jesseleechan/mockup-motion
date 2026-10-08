# P05 evidence: gallery order, previews, contact sheet, baselines

All renders here are from `presets/P05-review-and-baselines` on Windows (SwiftShader). "Measured" means a script or test computed it; nothing here was watched as video by a human unless it says so.

## Gallery order (D1)

`BUILTIN_TEMPLATES` now starts with Desktop Slider, Mobile Slider and Frames, then the twelve earlier templates in their old order. The first entry is the first-run default ("Try with demo content") and the gallery's initial selection.

- `tests/templates.test.ts` checks the whole gallery order, not only that the ids exist.
- `tests/first-run.test.ts` ("Presets D1: first-run default") checks that a new project fills Desktop Slider, with exactly the five demo desktop heroes in order, a vertical (`axis: "y"`) slider over those screenshots, a 10 s loop, and one undo step.
- `tests/e2e/first-run.spec.ts` ("Presets D1: …") checks in the app that the gallery's first three cards are the presets, that Apply with no card picked applies Desktop Slider, and that "Try with demo content" builds Desktop Slider whose active card shows screenshot content (pixel standard deviation 54–69 per channel at the card centre; a flat card is near 0).

No earlier test pinned Quiet Hero as the default: the old first-run e2e test picks Responsive Pair by name, and "Try with demo content" was only checked for a visible canvas. The D1 tests are new and check more than before.

## Previews

`public/templates/frames.webm` and `frames.webp` are new. The two slider previews from P03 are unchanged, and so are the other twelve.

**Bitrate for long previews (owner decision 1).** At the web bitrate (310 kbps at 640×360, 24 fps), Frames' 18.5 s preview is 889,085 bytes. `scripts/template-previews.ts` now gives any preview whose web bitrate would pass 440 KiB the bitrate that fits it: budget × 8 / length to start, then, because VP9 overshoots on constant motion, a re-encode at bitrate × budget × 0.97 / written until the file fits (at most four tries). Shorter previews keep the web bitrate, so their files don't change. The limits stay at 500 KB (script) and 450 KB (test); all demo screenshots stay.

| Preview | Length | First try | Final bitrate | File |
| ------- | ------ | --------- | ------------- | ---- |
| frames  | 18.5 s | 610,254 bytes at 195 kbps | 140 kbps (45% of web) | 440,884 bytes |

**Does it break up?** Measured against a full-bitrate encode of the same render: mean PSNR 38.8 dB, lowest frame 32.2 dB (frame 289), SSIM 0.980. Looked at:

- `preview/frames-preview-frames.webp`: four full frames (0.5, 3.9, 7.9, 15.9 s; 7.9 s is the last frame before a keyframe). Clean at card size.
- `preview/frames-preview-worst-frame-vs-web-bitrate.webp`: the lowest-PSNR frame at 2× (top: 140 kbps, bottom: 310 kbps). The smallest body text turns into grey lines and the photo is a little softer; headlines stay readable, and there is no blocking or smearing.
- `preview/slider-previews-frames.webp`: Desktop and Mobile Slider previews at 1.9, 2.5, 3.0 and 3.9 s. Both step: rest, mid-step, the next card settled. Five different screenshots in each frame.
- The Frames poster (`public/templates/frames.webp`, 6.5 s) shows two rows of real screenshots.

## Contact sheet

`contact-sheet/index.html`: Desktop Slider, Mobile Slider and Frames × 16:9, 9:16, 1:1, 4:5, 4:3 × 3.9 s, 4.5 s, 5.2 s, from the gallery preview documents (five demo screenshots each).

```sh
npm run contact-sheet -- --out docs/presets-plan/evidence/P05/contact-sheet --templates desktop-slider,mobile-slider,frames --aspects 16:9,9:16,1:1,4:5,4:3 --times 3.9,4.5,5.2
```

The sliders step every 2.0 s, so 3.9 s is at rest (step 1 has settled and holds), 4.5 s is mid-step (step 2 started at 4.0 s; p ≈ 0.41) and 5.2 s is settling (p ≈ 0.95). Frames moves continuously, so the three times show 1.3 s of travel.

Grids of the sheet, one per preset (rows 16:9, 4:3, 1:1, 4:5, 9:16; columns 3.9, 4.5, 5.2 s): `sheet_desktop-slider.webp`, `sheet_mobile-slider.webp`, `sheet_frames.webp`.

What I checked on every frame (quality bar §2.2, §3.1, §4):

- **Desktop Slider.** At rest the active card is centred at full size with 0.75, 65% neighbours above and below; mid-step every card travels up together; at 5.2 s the next card has nearly settled. At 16:9, 4:3 and 1:1 the card is capped at half the frame height, as §4 says. No screenshot twice in view.
- **Mobile Slider.** Five cards at 16:9 with five screenshots: the card leaving on the left fades out mid-step and comes back on the right as the step settles, never shown twice. At 9:16 the active card fills most of the width and the neighbours are cropped by the frame, as §4 allows.
- **Frames.** 2 rows at 16:9 and 4:3, 3 rows at 1:1, 4:5 and 9:16, the middle row centred and the outer rows cropped by the frame. No screenshot repeats within a row. With five screenshots and about seven cards in view, a screenshot can show in two rows at once (Field Notes at 9:16, 3.9 s: middle row, and partly at the bottom right). §4's rule covers a row or a column window, and this is two rows in different columns, so it passes; I flag it because it's visible.

## Open follow-ups judged on the sheet

The owner decides these; P05 doesn't fix them.

1. **Mobile Slider with 4 screenshots at 16:9 and 4:3 is right-heavy** (`follow-ups/mobile-slider_4-screenshots_16x9-left_4x3-right_t0.webp`, from P02). With 4 screenshots the active card has one neighbour on the left and two on the right. With 5 or more (the sheet) it's balanced. Recommendation: at 16:9 and 4:3 with fewer screenshots than slots, fade the outermost slot on the heavy side too, so the frame shows active ± 1; or leave it, since templates already ask for 4–6 and work best with 5.
2. **Slider shots still show the Camera section.** A camera move breaks the native loop. Recommendation: hide the Camera section for slider shots (quality bar §4 already says still camera), as Frames hides its speed slider.
3. **Frames past 10 screenshots at 4:5 (8 at 16:9) needs more than 30 s.** Recommendation: the slider rule's counterpart, show at most the screenshots that fit 30 s at 0.20 frame heights per second, with a short inspector note.

## Visual baselines (waiting for the owner's approval)

The [Visual baselines run 37834212234](https://github.com/jesseleechan/mockup-motion/actions/runs/37834212234) on this branch wrote 91 Linux stills: the 79 committed ones unchanged byte for byte, plus 12 new ones. They are not committed yet.

- `baselines-review/new-baselines_16x9_rows-desktop-mobile-frames.webp` (lossless): rows Desktop Slider, Mobile Slider, Frames; left the rest pose (1.9 s; Frames 0.8 s), right mid-step (2.5 s; Frames 2.4 s).
- `baselines-review/new-baselines_9x16_desktop-mobile-frames.webp` (lossless): the same six at 9:16, left to right.

All 12 show real screenshots, the right way up, at the expected poses: the sliders settled at 1.9 s (Aurelia active for Desktop Slider, Northwind for Mobile Slider) and moving at 2.5 s; Frames with 2 rows at 16:9 and 3 at 9:16.

**Found while checking them:** in `frames-9x16-t2-4`, the top and middle rows show the same two screenshots in the same columns (Field Notes over Field Notes, Studio Kova over Studio Kova). Adjacent rows move in opposite directions over the same screenshots, so they pass each other and, for a moment, line up the same screenshot. With every row sharing one set of screenshots this happens for any order of the rows, so it can't be fixed by reordering. Quality bar §4 says no asset appears twice in a column window. P04 fixed the outer rows, which move together; this is the adjacent pair. The owner decides: an exception in §4 for rows passing each other, or a design change (for example, rows offset so that crossings happen off-screen where possible).
