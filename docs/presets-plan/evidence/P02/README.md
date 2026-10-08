# P02 evidence: portrait cards, faded neighbours, slider lab fixtures

Stills are rendered from `/lab?still=1&fixture=<slider-x|slider-y>&aspect=<aspect>&t=<t>&w=1200` (Playwright Chromium, Windows, 8 October 2026) and stored as lossless WebP. `slider-x` shows the four demo mobile heroes (Aurelia, Northwind, Maison Oak, Field Notes) as mobile cards on the x axis. `slider-y` shows the same four sites' desktop heroes as desktop cards on the y axis. Both use the Ash background with no shadow, grain or vignette (D7). The reference frames come from the public Slider 5-02 and Slider 6-01 preview MP4s, captured with ffmpeg at 540 px wide (shown at 270 px in the strips). They are kept only here.

## Reference strips (4:5)

| File                                                                       | What I checked                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strip_slider-x_4x5_ours-top_reference-bottom_t0-0.25-0.5-0.75-1-1.5.webp` | Ours on top, the reference below, at t = 0, 0.25, 0.5, 0.75, 1.0 and 1.5 s. At every time the cards sit in the same places: still at 0 and 0.25 s, about 40% of the way at 0.5 s, most of the way at 0.75 s with a fourth card entering on the right, and settled by 1.5 s. Neighbours are smaller and faded like the reference's. |
| `strip_slider-y_4x5_ours-top_reference-bottom_t0-0.25-0.5-0.75-1-1.5.webp` | The same for the vertical slider: the next card comes up from below on the same timing, and the top and bottom neighbours are cropped by the frame at the same heights.                                                                                                                                                            |

Card size and spacing measured on the t = 0 frames, in stage units (frame height = 1), along the frame's centre line:

| Measure                                                          | Ours          | Reference     | Difference |
| ---------------------------------------------------------------- | ------------- | ------------- | ---------- |
| x: active card width × height                                    | 0.292 × 0.631 | 0.293 × 0.632 | 0.3%, 0.2% |
| x: gap, active edge to neighbour edge                            | 0.127         | 0.121         |            |
| x: centre-to-centre spacing (half active + gap + half neighbour) | 0.383         | 0.378         | 1.3%       |
| y: active card width × height                                    | 0.673 × 0.421 | 0.669 × 0.420 | 0.6%, 0.2% |
| y: gap                                                           | 0.113         | 0.108         |            |
| y: centre-to-centre spacing                                      | 0.482         | 0.476         | 1.3%       |

Both are within the task's 3%. Our gaps follow `reference.md` (0.128 and 0.115); measured on these 540 px frames, the reference gaps come out about 0.006 smaller, which still keeps the spacing within 1.3%.

## Every aspect at t = 0

| File                    | What I checked                                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slider-x_4x5_t0.webp`  | Active mobile card centred at 0.29 × 0.63 with 7.5% corners, colour-exact; neighbours at 0.75 scale and 65% fade, cropped by the side edges; nothing is cropped sideways inside a card.                                                                 |
| `slider-x_9x16_t0.webp` | The width cap holds: the active card is 0.52 of the frame width, and only slivers of the neighbours show at the edges.                                                                                                                                  |
| `slider-x_1x1_t0.webp`  | Three cards; both neighbours are fully inside the frame, the active card has a clear margin above and below.                                                                                                                                            |
| `slider-x_16x9_t0.webp` | All four screenshots show, and one slot on the left stays empty, because there are fewer screenshots than slots and a screenshot never repeats (quality bar §4). The frame is right-heavy, which I logged in `follow-ups.md` for the P05 contact sheet. |
| `slider-x_4x3_t0.webp`  | Three cards plus the edge of the fourth on the right; same empty slot on the left as 16:9, much less visible.                                                                                                                                           |
| `slider-y_4x5_t0.webp`  | Active desktop card 0.67 × 0.42 with 1.6% corners; the neighbours above and below are cropped by the frame and faded.                                                                                                                                   |
| `slider-y_9x16_t0.webp` | Full-width active card (0.84 of the frame width), both neighbours fully visible above and below.                                                                                                                                                        |
| `slider-y_1x1_t0.webp`  | The height cap (0.50) holds. The active card shows the card screen seam (below).                                                                                                                                                                        |
| `slider-y_16x9_t0.webp` | The height cap holds; neighbours are thin strips at the top and bottom edges.                                                                                                                                                                           |
| `slider-y_4x3_t0.webp`  | The height cap holds; the card keeps a clear margin to the side edges.                                                                                                                                                                                  |

## Known issue: card screen seam (fixed)

`known-issue_card-zfight_slider-y_1x1_t0_crop.webp` is a crop of the 1:1 still: a dotted diagonal across the active card. It was first read as the card screen z-fighting with its body slab. The cause is the screen shader: on its rounded box's medial axis `fwidth` is 0 and the screen discarded those pixel quads, so the slab showed through. Fixed on `fix/card-zfight`; see `docs/fix-plan/evidence/card-screen-seam/`.

## Frame time at 1080p

Measured in `/lab` with Chrome on an NVIDIA GeForce RTX 5060 (ANGLE, Direct3D 11): `engine.renderAt(t)` plus a 1-pixel `readPixels` so the GPU work is included, 5 rounds over each set of times after one warm-up pass.

| Document                                              | Median  | 95th percentile | Max     |
| ----------------------------------------------------- | ------- | --------------- | ------- |
| `card-hero` 16:9, one card, no fades (for comparison) | 2.30 ms | 3.10 ms         | 3.60 ms |
| `slider-x` 16:9 at rest (two opacities)               | 3.20 ms | 3.80 ms         | 3.90 ms |
| `slider-x` 16:9 during a step (up to five opacities)  | 4.50 ms | 5.40 ms         | 6.10 ms |
| `slider-y` 16:9 during a step                         | 5.10 ms | 6.00 ms         | 6.20 ms |
| `slider-x` 9:16 (1080 × 1920) during a step           | 5.00 ms | 5.60 ms         | 6.40 ms |

The preview budget is 55 fps for a single shot (18.2 ms, WP-18), and WP-03 drops quality above 20 ms. The slowest slider frame took 6.4 ms, so no batching was needed. Each faded run costs one layer render, one copy of the shot target and one composite pass.

## Fade colour space

The engine's fade pass (`DeviceFadePass`) blends entrances in linear light. The reference fades its neighbours as encoded sRGB values: a dark pixel of 15 at 65% over the 223 background shows 88, where linear light would give about 139. Slider shots therefore use an `srgb` blend: each faded run is drawn over a copy of the target as if opaque, then mixed with it in sRGB values. Entrances are unchanged. The owner chose this ("just do it however which way you recommend", 8 October 2026).

The tests and the failing output for each reverted change are in `mutations.md`.
