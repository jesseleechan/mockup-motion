# S01: The deck arrangement (motion only)

**Size:** M · **Depends on:** S00

## Required changes

1. `src/doc/types.ts`: the D4 field (recommended: `arrangement?: "carousel" | "deck"` on `slider`). `validate.ts` keeps a valid value, drops an invalid one; `user-templates.ts` round-trips it.
2. `src/motion/layouts/deck.ts`: `resolveDeckLayout(layout, aspect, assets, t)`, called from `resolveSliderLayout` when `arrangement === "deck"`. Pure TypeScript, timing from `sliderStep`.
   - Node ids and sizes are time-independent (`deck:{j}`); scale and position move through `transform`; `depthOrder` draws the front card last.
   - Slot r (0 = front) at scale `1 − 0.06 r`, offset `r × peek` along the peek direction (down for `y`, right for `x`); the leaving card goes from slot 0 to 0.03 past the frame edge (up for `y`, left for `x`) on the same progress.
   - The card entering slot `depth − 1` fades in with progress; every other card in view is at opacity 1. No other card shows.
3. Card sizes and centring from README §1 (or as decided).

## Tests

- Loop seam: nodes at t = 0 and t = N × step are identical for N = 1…6, both axes, five aspects.
- No reversal: along the axis every card's position is monotonic over a loop (1/120 s samples), and its scale never decreases.
- No repeats: no asset twice among nodes with opacity > 0.01 that intersect the frame, N = 3…6.
- At rest: the front card is at scale 1, opacity 1; slot r at `1 − 0.06 r`; the deck's box is centred.
- Safe margin: the deck at rest keeps 7% of the shortest frame side clear at every aspect.
- A saved slider without the field gives the same nodes as before (golden for N = 4…6, five aspects, six times).
- Determinism.

## Acceptance criteria

- [ ] Tests pass and each fails when its guarded behaviour is reverted (failures pasted in the PR).
- [ ] No engine or visible editor changes.
