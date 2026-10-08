# P04 evidence: Frames

Stills are rendered from `/lab?still=1&fixture=frames-<aspect>&aspect=<aspect>&t=<t>&w=1200` (SwiftShader, Windows, 7 October 2026) and stored as lossless WebP. The preview document uses the five demo desktop heroes. The reference frames come from the public Frames 1-01 preview MP4, scaled to 540 px wide; they are kept only here.

| File | What I checked |
| --- | --- |
| `strip_4x5_ours-left_reference-right_t0-5-10.webp` | Ours (left) next to the reference (right) at t = 0, 5 and 10 s: three rows, middle row centred, outer rows cropped by the top and bottom edges, card size, gaps and row spacing match by eye, and the measured values in `tests/frames.test.ts` are within 3% (card 0.512 × 0.32 vs 0.52 × 0.315, pitch 0.577 vs 0.585, gap 0.065, row pitch 0.385 vs 0.38). Our rows all move at one speed (decision D3), so their phase differs from the reference's. |
| `frames_4x5_t0.webp` | Three rows, flat Ash background, no shadow, grain or vignette; no screenshot repeats within a row or lines up in the same column of the two outer rows; nothing is cropped sideways except by the frame edge. |
| `frames_9x16_t0.webp` | Three rows of 0.32-tall cards; each row shows one card and parts of its neighbours, the middle row is centred, and the outer rows show different screenshots. |
| `frames_1x1_t0.webp` | Three rows, about two cards per row, staggered by a third of a period, so no column shows the same screenshot twice. |
| `frames_16x9_t0.webp` | Two rows of 0.42-tall cards, at most four cards per row window, rows half a period apart; the block is centred with an even margin above and below. |
| `frames_4x3_t0.webp` | Two rows, three cards per row window; the block nearly fills the height (4.8% margin top and bottom) but stays inside the frame. |
| `loop-seam_frame0-left_frame449-right.webp` | The first (0 s) and last (14.967 s) frames of a 1080 × 1350, 30 fps WebM export: the same cards, one frame of travel apart. |
| `known-issue_card-zfight_4x5_t10_crop.webp` | A crop of the 4:5 still at t = 10 s: a dotted diagonal across a card screen. It was first read as z-fighting between the screen and its body slab, but it is the screen shader discarding pixel quads on its rounded box's medial axis, where `fwidth` is 0 (`src/engine/materials/screen.ts`). Fixed on `fix/card-zfight`; see `docs/fix-plan/evidence/card-screen-seam/`. |

## Loop check (4:5 export)

The 4:5 shot (15 s, 450 frames at 30 fps, WebM from the lab's export path) was played three times back to back (`ffmpeg -stream_loop 2`) and every pair of consecutive frames compared at 270 × 338 (mean absolute RGB difference, 0–255):

| Measure | Value |
| --- | --- |
| Median change between consecutive frames | 11.01 |
| 99th percentile | 12.07 |
| Largest change away from the loop points | 12.14 |
| Change across each loop point (frame 449 → 0) | 9.86, 9.86 |

The step across the loop point is an ordinary one-frame step, so there is no pop. This is a measurement; I did not watch the export in real time, so it still needs a human viewing (quality bar §8).
