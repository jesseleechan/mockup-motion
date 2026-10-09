# PF03 evidence: Mobile Frames

Rendered on Windows (SwiftShader) from this branch with the lab's still mode, `/lab?still=1&fixture=<fixture>&aspect=<aspect>&t=<t>&w=1200`, and saved as WebP. The fixtures are the template preview documents: the five demo mobile heroes at each aspect (`mobile-frames-<aspect>`), next to Desktop Frames (`frames-<aspect>`). None of these files is a visual baseline; PF04 writes those after the owner approves them.

## Stills at t = 0, one per aspect

| Image                        | What I checked                                                                                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mobile-frames_16x9_t0.webp` | Five columns of portrait cards 0.270 wide (§3: 0.269), every column fully visible with 4.83% side margins (§3: 4.8%), 7.5% rounded corners, no device chrome, flat Ash background.                       |
| `mobile-frames_4x3_t0.webp`  | Four columns of cards 0.254 wide (§3: 0.253), all visible with 4.71% side margins, columns staggered by a quarter period so no row of cards lines up.                                                    |
| `mobile-frames_1x1_t0.webp`  | Three columns of cards 0.259 wide (§3: 0.258), all visible with 4.75% side margins; the gaps between columns read the same as the gaps between cards.                                                    |
| `mobile-frames_4x5_t0.webp`  | Three columns of cards 0.247 wide (§3: 0.246), the middle one centred and the outer two cropped by 13.8% of their width (§3: 14%), as the reference crops its outer rows.                                |
| `mobile-frames_9x16_t0.webp` | Two columns of cards 0.223 wide (§3: 0.222), all visible with 4.71% side margins; each card is about 475 px wide in this 1200 × 2133 still (about 426 px in a 1080 × 1920 export), large enough to read. |

Every card shows its screenshot fitted to the card's width: the left and right edges of each site's header and body sit on the card's edges, and only the bottom of the capture is cut off. `tests/e2e/mobile-frames.spec.ts` proves the same with a marked 780 × 3000 capture.

## Same effect, two sizes

Desktop Frames on the left, Mobile Frames on the right, at t = 0, each scaled to 600 px wide.

| Image                                         | What I checked                                                                                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pair_16x9_desktop-left_mobile-right_t0.webp` | Two rows of landscape cards against five columns of portrait cards: same background, gap, corner style and margins, so the pair reads as one effect turned 90°. |
| `pair_4x3_desktop-left_mobile-right_t0.webp`  | Two rows against four columns; both fill the frame with the same 0.065 gap, and neither leaves an empty lane or a wide empty side.                              |
| `pair_1x1_desktop-left_mobile-right_t0.webp`  | Three rows against three columns; Desktop Frames crops its outer rows while Mobile Frames keeps every column visible, as §3 specifies for 1:1.                  |
| `pair_4x5_desktop-left_mobile-right_t0.webp`  | Three cropped rows against three columns with cropped outer columns: the closest match of the five, as both mirror the reference at 4:5.                        |
| `pair_9x16_desktop-left_mobile-right_t0.webp` | Three rows against two columns; Mobile Frames' cards stay readable at 9:16 instead of shrinking to a third column, which is why §3 uses two columns there.      |

## Motion and loop

| Image                                  | What I checked                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strip_4x5_t0-5-10.webp`               | Mobile Frames at 4:5 at t = 0, 5 and 10 s of its 15 s loop: every column has moved one third of a period at each step, so each frame shows the previous frame's columns shifted one place sideways, as Desktop Frames' rows do; the cards keep their size, gap and crop throughout (the direction of each column is covered by PF02's unit tests). |
| `loop-seam_4x5_frames448-449-0-1.webp` | Frames 448, 449, 0 and 1 of the 1080 × 1350, 30 fps MP4 export (450 frames, 15 s): the step from 449 to 0 is the same small step as the ones beside it, with no jump in any column.                                                                                                                                                                |

### Watching the 4:5 loop three times

I exported the Mobile Frames preview document at 4:5 as a 1080 × 1350, 30 fps H.264 MP4 (450 frames, 15.000 s) through the lab's `exportWithEngine`, joined three copies end to end with `ffmpeg -stream_loop 2` (1350 frames), measured the step between every pair of consecutive frames, and looked at the frames on both sides of each seam. The mean absolute difference between consecutive frames (grey, scaled to 270 × 338) is 17.9–21.0 over all 1349 steps (median 19.5). Across the seams it is 19.61 into frame 450 and 19.61 into frame 900, between its neighbours (19.55 before, 19.68 after), so the loop point moves exactly like any other frame. The three plays are the same encoded file, so frames 0, 450 and 900 are identical (difference 0.000) and the second seam behaves exactly like the first.

## Composition measured from the pixels

Measured on stills rendered at 2400 px wide (not committed), by finding the card columns' edges against the Ash background. Stage units: frame height = 1. All within 3% of quality bar §4 and README §3.

| Aspect | Columns | Card width (§3)       | Gaps between columns (0.065) | Margins (4.8% of W) or crop (14%) |
| ------ | ------- | --------------------- | ---------------------------- | --------------------------------- |
| 16:9   | 5       | 0.2702 (0.269, +0.5%) | 0.0637 (−2.0%)               | 4.83% / 4.83% (+0.7%)             |
| 4:3    | 4       | 0.2540 (0.253, +0.4%) | 0.0633–0.0644 (≤ −2.6%)      | 4.71% / 4.71% (−1.9%)             |
| 1:1    | 3       | 0.2592 (0.258, +0.5%) | 0.0638 (−1.9%)               | 4.75% / 4.75% (−1.0%)             |
| 4:5    | 3       | 0.2467 (0.246, +0.3%) | 0.0640 (−1.5%)               | crop 13.8% / 13.8% (−1.4%)        |
| 9:16   | 2       | 0.2226 (0.222, +0.3%) | 0.0642 (−1.2%)               | 4.71% / 4.71% (−1.9%)             |

The pixel edges include the cards' anti-aliased rim, which makes cards about a pixel wider and gaps about a pixel narrower than the layout. `tests/mobile-frames.test.ts` checks the layout's own numbers, which match §4 exactly.
