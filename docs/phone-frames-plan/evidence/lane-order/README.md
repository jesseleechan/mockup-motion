# Frames lane order: evidence

Two follow-ups from the PF04 review (PR #39), approved by the owner ("go with your recommendations"):

1. Odd lanes show the screenshots in reverse order, so neighbouring lanes cross one card at a time instead of lining up as two copies of one lane twice per loop.
2. The Mobile Frames gallery poster (16:9, 35% of the loop) shows no demo site in more than two columns and keeps a photographic hero in view.

Everything here was rendered on Windows (SwiftShader) from the gallery preview documents (the five demo screenshots of each preset). "Before" is `frames/PF04-review-and-baselines` (a14b9e1); "after" is this branch. None of these files is a visual baseline.

## What changed

`resolveLanes` (`src/motion/layouts/lanes.ts`) is used only by `travel: "period"`, so only Desktop Frames and Mobile Frames change. On odd lanes, slot j shows screenshot `(1 − j) mod N` instead of `j mod N`: the ring runs 2, 1, N, N − 1, … Each lane keeps its start offset, direction, speed, node ids, positions and sizes. The PF02 golden shows this: of 6,135 recorded nodes, only `assetId` changed, on 960 nodes of odd Desktop Frames rows. The tilted steps rows and columns match their recording exactly.

### Why the reversed ring starts at the second screenshot

Neighbouring lanes slide past each other by two periods per loop, so the reversal's starting point only decides when matches happen, not how many there are. The task asked for a demo order that puts no site in more than two columns at the 16:9 poster. With the reversed ring starting at the first screenshot (`(N − j) mod N`), no order of the five demo sites does that. A different order only renames the ring slots, and at the poster one slot is in view in three columns. I checked all 120 orders. Starting at the second screenshot moves that slot, and every order then shows each site in two columns at most. `tests/lane-order.test.ts` checks this on the demo poster. It fails when the anchor goes back to the first screenshot.

### Demo order

The Mobile Frames demo order stays the same (Northwind, Maison Oak, Studio Kova, Field Notes, Aurelia). With the new lane order, the 16:9 poster shows each site once as a whole card and once as a half card. Aurelia's photographic hero is whole in the middle column, and Maison Oak's is whole in the left column.

## Images

| Image                                                           | What I checked                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sheet_frames_before-after.webp`                                | Desktop Frames at all five aspects at 0, 5 and 10 s, before and after. Even rows are unchanged, and odd rows show the reversed order. No screenshot repeats within a row, and no card is empty, flipped or tinted.                                                                                                                                                                                                            |
| `sheet_mobile-frames_before-after.webp`                         | Mobile Frames, the same layout: even columns are unchanged, odd columns are reversed, nothing repeats within a column and no card is empty or flipped. At 4:5 and 5 s, before, columns 2 and 3 were identical; after, they share no screenshot.                                                                                                                                                                               |
| `passing_frames_before-after.webp`                              | Desktop Frames at a moment when a pair of rows lined up exactly before (16:9 and 4:3 at 4.625 s; 1:1, 4:5 and 9:16 at 5 s). Before, the two rows were identical. After, at most one stacked pair matches (Kova at 16:9) and the others differ.                                                                                                                                                                                |
| `passing_mobile-frames_before-after.webp`                       | Mobile Frames at the same kind of moment (16:9 at 9.9 s, 4:3 at 9.69 s, 1:1 at 2.67 s, 4:5 at 5 s, 9:16 at 3.75 s). Before, whole columns were identical (at 9:16 the frame was one column twice). After, each neighbouring pair shares at most one card: Field Notes at the bottom at 9:16, and Field Notes and Kova in two different pairs at 16:9. This is the "one card at a time" crossing quality bar §4 now describes. |
| `posters_before-after.webp`                                     | The 16:9 gallery posters (35% of the loop). Mobile Frames before: Maison Oak in three columns. After: every site in two columns at most, and two photographic heroes whole. Desktop Frames changes only in its top row.                                                                                                                                                                                                       |
| `loop-seam_frames_4x5.webp`, `loop-seam_mobile-frames_4x5.webp` | The two frames on each side of the loop seam of the 4:5 export (1080 × 1350, 30 fps H.264). Every lane moves by the same small step across the seam.                                                                                                                                                                                                                                                                          |

## Watched loops

Each preset was exported at 4:5 through the lab's `exportWithEngine`, as in PF04. I joined three plays end to end and measured the mean absolute difference between consecutive frames (grey, 216 × 270).

| Preset         | Before: steps (min / median / max), seam (before / across / after) | After                                        |
| -------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| Desktop Frames | 8.10 / 10.45 / 11.60, 9.36 / 9.30 / 9.09                           | 8.31 / 10.58 / 11.79, 9.64 / 9.58 / 9.48     |
| Mobile Frames  | 17.47 / 19.08 / 20.46, 19.03 / 19.24 / 19.29                       | 17.57 / 19.11 / 20.55, 18.38 / 18.70 / 18.81 |

Frame 0 equals frame 450 exactly (difference 0.000) for both. The step across the seam lies between its neighbours and inside the loop's range, so there is no pop.

## Previews

`npm run template-previews -- frames mobile-frames`: `frames.webm` 446,147 bytes, `mobile-frames.webm` 445,823 bytes, both under the 450 KiB (460,800 bytes) limit, which is unchanged. The posters are 43,514 and 68,508 bytes.
