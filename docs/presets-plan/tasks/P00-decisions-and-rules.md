# P00: Record the decisions in the quality bar and contracts

**Size:** S · **Depends on:** nothing (the owner decided D1–D8 on 8 October 2026) · **Docs only**

## Why

The presets break three rules on purpose: a new easing, faded neighbour screens, and (for Frames) a faster marquee. Reviewers reject work that breaks `quality-bar.md`, so the rules have to change before the code does. Each later task then implements a written rule.

## Required changes

1. The owner's answers are already in the plan README's Decisions table (§2). Read them; this task turns them into rules.
2. `docs/plan/quality-bar.md`:
   - §2.1: add `slide`, cubic-bezier(0.40, 0, 0.05, 1), "Carousel steps (slider layout)".
   - §2.2: add a "Carousel steps" bullet: one step per screenshot, 1.6–4.0 s per step (default 2.0 s), a 1.85 s move then a hold. The step starts on the step boundary.
   - §2.5: apply D2. Frames gets its own limit of 0.20 frame heights per second; every other marquee keeps 0.12 frame widths per second.
   - §3.1: apply D5. Faded slider neighbours are the only allowed exception to color-exact screens, and the active card stays exact.
   - §3.4: card radius is 1.6% of width for landscape cards and 7.5% for portrait (mobile) cards.
   - §4: add a "Slider" composition bullet with the active card size and spacing rules from P01, and a "Frames" bullet with the row count per aspect from P04. Use the 4:5 numbers in `reference.md` as the anchor.
   - §6: add the Ash palette (D7).
3. `docs/plan/contracts.md`:
   - §2: the new `Layout` variant (below), the new rows fields, and `EasingId` gaining `"slide"`.
   - §5: sliders loop natively with a `cut` wrap. Frames loops natively when `travel` is `"period"`.

```ts
| { kind: "slider"; assetIds: string[]; axis: "x" | "y"; shape: "mobile" | "desktop"; step: number }
// axis x: cards move left, the next comes in from the right. axis y: cards move up.
// shape: mobile = portrait cards at the phone screen aspect; desktop = landscape cards.
// step: seconds per screenshot, 1.6..4.0. Shot duration = assetIds.length × step.

| { kind: "rows"; …existing fields…; cardHeight?: number; gap?: number; travel?: "steps" | "period" }
// cardHeight: stage units (default: today's per-row-count value). gap: stage units between cards
// and rows (default: today's 0.14 × width across, 0.06 down). travel "steps" is today's behaviour;
// "period" moves every row exactly one asset period per loop, so speed follows shot duration.
```

## Acceptance criteria

- [ ] `quality-bar.md` and `contracts.md` contain every rule above, and none of the text contradicts the decisions.
- [ ] `npm run format` leaves the files unchanged.
