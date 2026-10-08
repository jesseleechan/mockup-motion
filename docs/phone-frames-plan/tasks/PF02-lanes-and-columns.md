# PF02: Shared lane function and the columns period mode (motion only)

**Size:** M · **Depends on:** PF00

## Why

Phone Frames is Desktop Frames turned 90°. Instead of copying the period loop into `columns.ts`, move it into one function that both layouts call (D5). This task changes no template and no pixel of Desktop Frames.

## Context

- `src/motion/layouts/rows.ts`: `rowsGeometry`, `framesAssetIds`, `framesDuration`, and the `travel === "period"` branch of `resolveRowsLayout`.
- `src/motion/layouts/columns.ts`: today's tilted phone marquee. Its `steps` behaviour must not change.
- `src/motion/layouts/marquee.ts`: `FRAMES_MAX_FRAME_HEIGHTS_PER_SECOND`. `limits.ts`: `MAX_SHOT_DURATION`.
- `src/doc/types.ts` (the `Layout` union) and the sanitizer in `src/doc/` that validates rows' `cardHeight`, `gap` and `travel`.
- `contracts.md` §2 and §5 and `quality-bar.md` §4 as updated in PF00.

## Required changes

1. **Golden first.** Before touching `rows.ts`, add a test that records the Desktop Frames nodes (`framesLayout(aspect, ids)` through `resolveRowsLayout`) for N = 4, 5, 6, all five aspects, at t = 0, 0.8, 2.4, duration/2, duration − 0.1 and duration. Commit the recorded JSON as a fixture under `tests/fixtures/`. The test compares node ids, transforms, sizes, opacity and depth order exactly (`toEqual`, no tolerance).
2. **`src/motion/layouts/lanes.ts`.** Move the period mode into it. One function resolves lanes on an axis (`"x"`: lanes are rows moving sideways; `"y"`: lanes are columns moving vertically). It takes the lane count, card size across and along, gap, device, screen aspect, asset ids, time and duration, and returns `LayoutNode[]`. It also provides the lane geometry, `lanesAssetIds` (30 s cap) and `lanesDuration` (0.20 limit, rounded up to 0.5 s). Keep the node ids `row{r}:item{j}` for rows; columns use `col{c}:item{j}`, as today.
3. **Rows on lanes.** `resolveRowsLayout` calls it for `travel: "period"`. `framesAssetIds(layout, aspect)` and `framesDuration(layout, aspect)` keep their names and accept a rows **or** columns layout, so callers don't change. The golden test passes unchanged.
4. **Columns fields.** Add `device?: "phone" | "card"`, `cardWidth?`, `gap?` and `travel?: "steps" | "period"` to the columns type in `src/doc/types.ts`. Unset fields keep today's tilted phone marquee exactly. Today the columns sanitizer (`src/doc/validate.ts:511–523`) keeps only `columns`, `tilt`, `speed` and `assetIds`, so it would strip the new fields. Extend it the way rows is handled at lines 490–510:
   - keep `device` only if it is `"card"`;
   - clamp `cardWidth` to 0.1–0.8 and `gap` to 0–0.5 when they are finite;
   - keep `travel` only if it is `"steps"` or `"period"`;
   - otherwise leave the field unset.
5. **Duration hook.** `minShotDuration` (`src/motion/layouts/duration.ts:70–73`) returns `framesDuration` for a columns layout with `travel: "period"`, as it does for rows. The store already clamps through it (`src/state/store.ts` at `assignAssetToSlot`, `addAssetToShot` and `setShotDuration`).
6. **Columns period mode.** With `travel: "period"`, `resolveColumnsLayout` calls the lane function with `axis: "y"`. Node ids and sizes must not depend on time: the device pool builds devices from the layout at t = 0 (`src/engine/devices/DevicePool.ts:52–73`, checked by `tests/doc-assets.test.ts:193`). Column c sits at x = (c − (columns − 1) / 2) × (cardWidth + gap), starts c / columns of a period along, and moves up when c is even and down when c is odd. With `device: "card"` every node has `device: "card"`, `screenAspect: 0.4615` and height `cardWidth / 0.4615`, whatever the image's own aspect. `screenAspectFor("card", tallImage)` would return 1.6 and crop the screenshot to a strip. Tilt is honoured as for rows, but Phone Frames passes 0.
7. **Speed.** Columns use the same 0.20 stage units per second as rows (D6). Do not add a second constant.

## Tests

- Golden: Desktop Frames nodes are identical before and after the refactor (step 1). Revert-proof: break the row offset by a hair and show it fails.
- Columns steps: a snapshot of today's `columns` output (Phone Parade's layout: 2 and 3 columns, tilt 12, speed 0.4, N = 3 and 5) taken before the change is identical after it.
- Loop seam: for columns with `travel: "period"`, N = 4…10 and all five aspects with the §3 counts and widths, the nodes at t = 0 and t = `framesDuration` are identical.
- Direction and linearity: column c's y moves up when c is even and down when c is odd, linear in t, never reversing.
- No repeats: within each column's visible window (height 1 plus one card), no asset appears twice at any sampled time, for N = 4…10 at every aspect.
- Speed: every column's speed is at or under 0.20 stage units per second, and `framesDuration` returns the values in the README §3 table (15 s floor applied in the template, not here).
- Cap: `framesAssetIds` keeps 9 screenshots at 16:9, 4:3 and 1:1 and 10 at 4:5 and 9:16 with the §3 widths.
- Portrait cards: with `device: "card"`, a tall mobile image (1170 × 5000) still gets `screenAspect` 0.4615.
- Sanitizer: invalid columns fields are dropped; a saved Phone Parade document (`columns`, no new fields) round-trips unchanged.

## Acceptance criteria

- [ ] The tests above pass, and each guarding test fails when its change is reverted (pasted in the PR).
- [ ] The four `frames-*` and the remaining Linux baselines pass unchanged (`visual` green with no baseline change).
- [ ] `src/motion/` stays pure: no DOM, three.js or React imports, and no `Date.now()`, `performance.now()` or unseeded `Math.random()`.
- [ ] `rows.ts`, `columns.ts` and `lanes.ts` are each under about 400 lines.
- [ ] Gates pass: typecheck, lint, test, build, test:e2e.
