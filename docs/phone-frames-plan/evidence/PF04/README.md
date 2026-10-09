# PF04 evidence: gallery order, preview, contact sheet, watched loops, baselines

Everything here was rendered on Windows (SwiftShader) from this branch, from the gallery preview documents (the five demo screenshots of each preset). None of these files is a visual baseline.

## Gallery order (D12)

`BUILTIN_TEMPLATES` was already Desktop Slider, Mobile Slider, Desktop Frames, Mobile Frames, Scroll Story after PF03, so PF04 changes no order. `tests/templates.test.ts` already pins all five ids. The e2e gallery test (`tests/e2e/first-run.spec.ts`, "the gallery leads with the presets") pinned only the first four cards and now pins all five. Swapping Mobile Frames and Scroll Story in the registry makes it fail, and the first-run test still checks that a new project starts on Desktop Slider.

## Mobile Frames preview

`public/templates/mobile-frames.webm` (432,652 bytes, under the 450 KiB limit) and `.webp` (67,302 bytes) are PF03's files, unchanged. Nothing in this review changed the template, so I didn't regenerate them. The clip is 640 × 360 at 24 fps and lasts 16.5 s, the whole 16:9 loop with five screenshots.

| Image                                 | What I checked                                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preview_mobile-frames_every-3s.webp` | Frames 0, 72, 144, 216, 288 and 360 of the WebM (every 3 s): all five columns move between frames, alternating up and down, with no still or empty card. |

The poster (the frame at 35%) shows five columns of settled, readable cards. Maison Oak shows in three of them at once, as PF03 noted: five screenshots fill about eight visible slots.

## Contact sheet

```sh
npm run contact-sheet -- --out <scratch>/sheet-frames --templates frames,mobile-frames --aspects 16:9,4:3,1:1,4:5,9:16 --times 0,5,10
npm run contact-sheet -- --out <scratch>/sheet-sliders --templates desktop-slider,mobile-slider --aspects 16:9,4:3,1:1,4:5,9:16 --times 3.9,4.5,5.2
```

The 60 frames (960 px wide each) are combined into four grids, with one row per aspect (16:9, 4:3, 1:1, 4:5, 9:16):

- `sheet_desktop-frames_mobile-frames.webp`: Desktop Frames and Mobile Frames side by side at 0, 5 and 10 s.
- `sheet_mobile-frames.webp`: Mobile Frames alone, larger (600 px per frame).
- `sheet_desktop-slider.webp` and `sheet_mobile-slider.webp`: the sliders at their usual times, 3.9 s (rest), 4.5 s (mid-step) and 5.2 s (settling), as in P05. They look as they did in P05.

### Mobile Frames, one sentence per aspect

Card sizes are quality bar §4's, which PF03 measured from the pixels to within 0.5%. The template is unchanged since then.

- **16:9:** five columns of 0.269-wide cards (1.5 cards per column) fill the frame with even 4.8% side margins, the same density as Desktop Frames' two rows next to them. No column is sparse, and no screenshot repeats within a column. With five screenshots in about eight visible slots, one site often shows in two or three columns at once (Maison Oak in columns 1 and 4 at 5 s).
- **4:3:** four columns of 0.253-wide cards, all visible with even margins, balanced and neither sparse nor crowded. No screenshot repeats within a column. At 10 s, columns 1–2 and 3–4 are both close to passing, so the frame reads briefly as two pairs of matching columns.
- **1:1:** three columns of 0.258-wide cards, all visible with 4.8% margins. This is the calmest and most legible of the five, and no column is sparse. No screenshot repeats within a column.
- **4:5:** three columns of 0.246-wide cards. The middle column is centred and the outer two are cropped by about 14% of their width, the same crop as Desktop Frames' outer rows beside them. No screenshot repeats within a column. At 5 s columns 2–3, and at 10 s columns 1–2, are exactly passing, so they show the same screenshots side by side.
- **9:16:** two columns of 0.222-wide cards (about 426 px wide in a 1080 × 1920 export), readable, with 4.8% margins and neither sparse nor crowded. No screenshot repeats within a column.

### Passing lanes

Lane r starts r/lanes of a period along, and adjacent lanes move in opposite directions. Each adjacent pair therefore lines up exactly twice per loop, at t/T = 1/(2·lanes) and 1/(2·lanes) + ½ for a pair whose first lane has an even index, and ½ − 1/(2·lanes) and 1 − 1/(2·lanes) for the others. At those instants the pair shows the same screenshots at the same heights.

| Image                        | What I checked                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `passing-lanes_moments.webp` | The predicted moments, rendered: Mobile Frames at 9:16 (3.75 s; the two columns are identical), 4:3 (9.69 s; columns 1–2 and 3–4) and 16:9 (9.9 s; columns 1–2 and 3–4), and Desktop Frames at 16:9 (4.625 s; both rows identical). Desktop Frames does the same, so the effects match. Quality bar §4 allows this (P05, 8 October 2026). |

It is a moment in continuous motion, not a hold. It shows most with few lanes: at 9:16 the whole frame is one column twice. See the suggestion in the PR.

## Watched loops (quality bar §8)

Each preset was exported at 4:5 as 1080 × 1350, 30 fps H.264 MP4 through the lab's `exportWithEngine`, from its preview document built at 4:5. I joined three plays end to end (`ffmpeg -stream_loop 2 -c copy`) and measured the mean absolute difference between every pair of consecutive frames (grey, 216 × 270). I also looked at the two frames on each side of every seam. The three plays are the same file, so the second seam is identical to the first, and frame 0 equals frame `total` exactly (difference 0.000) for all four.

| Preset         | Length           | Steps over the 3 plays (min / median / max) | Before / across / after the seam | Image                               |
| -------------- | ---------------- | ------------------------------------------- | -------------------------------- | ----------------------------------- |
| Desktop Slider | 10 s, 300 frames | 0.00 / 7.22 / 29.13                         | 0.00 / 0.08 / 0.69               | `loop-seam_desktop-slider_4x5.webp` |
| Mobile Slider  | 10 s, 300 frames | 0.00 / 4.27 / 20.36                         | 0.00 / 0.06 / 0.51               | `loop-seam_mobile-slider_4x5.webp`  |
| Desktop Frames | 15 s, 450 frames | 8.10 / 10.45 / 11.60                        | 9.36 / 9.30 / 9.09               | `loop-seam_frames_4x5.webp`         |
| Mobile Frames  | 15 s, 450 frames | 17.47 / 19.08 / 20.46                       | 19.03 / 19.24 / 19.29            | `loop-seam_mobile-frames_4x5.webp`  |

- **Sliders:** the loop ends at rest on the first card. Across the seam the step is 0.06–0.08, the first frame of the next step easing out, and the step after it is 0.5–0.7. There is no pop: the largest steps of the loop (20–29) fall mid-step, 0.45 s after each step starts.
- **Frames (both):** the motion is continuous, and the step across the seam lies between its neighbours and within the loop's range. In the seam strips frames 448, 449, 0 and 1 differ by the same small shift in every lane.

The four MP4s and their three-play versions are kept outside the repo (19–64 MB each).
