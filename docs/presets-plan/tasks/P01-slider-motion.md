# P01: `slide` easing and the `slider` layout (motion only)

**Size:** M · **Depends on:** P00

## Why

Both sliders are one layout on two axes. Everything about their motion is a pure function of `(layout, aspect, assets, t)`, so it belongs in `src/motion/`, where it can be unit-tested in Node without rendering.

## Context

- `reference.md`: slider sizes, spacing, emphasis and the step timing table.
- `src/motion/easing.ts`, `src/motion/layouts/index.ts`, `rows.ts` (a ring layout to compare with), `types.ts` (`LayoutNode`, `screenAspectFor`).
- `contracts.md` §4–§5 as updated in P00.

## Required changes

1. **Easing.** Add `slide` to `EasingId` and `BEZIER_PRESETS` in `easing.ts`.
2. **Layout.** Add `src/motion/layouts/slider.ts` with `resolveSliderLayout` and wire it into `resolveLayout`.
   - Step timing: step `k` runs over `[k × step, k × step + 1.85]`, with progress `p = ease("slide", (t − k × step) / 1.85)` clamped to [0, 1]. If `step < 1.85`, the move takes the whole step.
   - Slot positions: slot `s` (0 = active) sits at `s × spacing` along the axis. Moving to the next screenshot shifts every card by one slot in the negative direction (left for `x`; up for `y`, so the next card comes from below).
   - Per card, with `d` = its distance in slots from the active position at the current progress: `scale = 1 − 0.25 × min(1, |d|)` and `opacity = 1 − 0.35 × min(1, |d|)`. Position, scale and opacity all use the same `p`.
   - Sizes come from the frame. For `x`/mobile: active card height 0.63 of the frame, width = height × 0.4615, capped so the card is at most 0.52 of the frame width at 9:16. For `y`/desktop: active card width 0.84 of the frame width, capped so its height is at most 0.50 of the frame height at 16:9 and 4:3. Spacing (centre to centre) = half the active size along the axis + gap + half the neighbour size, with gap = 0.128 (x) or 0.115 (y) stage units scaled with the card. These reproduce `reference.md` at 4:5; check the other aspects on the P02 contact sheet.
   - Card screens: `device: "card"`, `screenAspect` 0.4615 for `mobile` and `screenAspectFor("card", asset)` for `desktop`.
   - `depthOrder`: the card nearest the active slot is drawn last.
3. **No repeats.** Render only the slots that can intersect the frame. When N is too small for all of them to show distinct screenshots during a step (a step shows the visible slots plus the one entering), give the far slots opacity 0 and fade them in or out with the step progress, so a screenshot never appears twice in view. With N = 1, show only the active card, still.
4. **Document model.** Add the `slider` variant to `Layout` in `src/doc/types.ts`. Handle it in the non-UI switches that the compiler flags: `src/doc/validate.ts` (sanitize `axis`, `shape`, and clamp `step` to 1.6–4.0), `src/doc/assets.ts` (its asset ids) and `src/motion/evaluate.ts`. Editor switches get the smallest case that compiles; P03 builds the real UI.
5. **Duration.** Export a helper `sliderDuration(layout)` = `max(1, assetIds.length) × step`, for templates and the editor to keep `Shot.duration` in sync.

## Tests (in `tests/layouts.test.ts` and `tests/motion.test.ts`)

- `slide` matches the reference table in `reference.md` within 0.03 at every listed time, starts at 0, ends at 1, and is monotonic.
- At t = 0 and at every step boundary, the active card is centred, at scale 1 and opacity 1, and its neighbours are at 0.75 and 0.65.
- At 4:5, sizes and spacing match `reference.md` within 3% for both axes.
- Loop seam: `resolveSliderLayout` at t = 0 and at t = N × step give the same set of `(assetId, transform, opacity)` for N = 1…6, both axes, all five aspects.
- No reversal: along the axis, every card's position is non-increasing over a whole loop, sampled at 1/120 s.
- No repeats: at every sampled time and aspect, no asset id appears twice among nodes that have opacity > 0.01 and intersect the frame, for N = 3…6.
- Safe margin: the active card keeps at least 7% of the shortest frame side clear at every aspect (quality bar §4).
- Determinism: the same inputs give identical nodes (no `Date.now`, no unseeded random).

## Acceptance criteria

- [ ] All tests above pass, and each fails when its guarded behaviour is reverted (paste the failures in the PR).
- [ ] `src/motion/` still has no DOM, three.js or React imports (lint passes).
- [ ] No engine changes and no visible editor changes in this PR. No template uses the layout yet.
- [ ] `sanitizeDoc` keeps a valid slider layout unchanged and repairs an invalid one (unit test).
- [ ] Gates pass: typecheck, lint, test, build.
