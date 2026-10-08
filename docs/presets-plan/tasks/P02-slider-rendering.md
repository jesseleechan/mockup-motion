# P02: Portrait cards, faded neighbours, slider lab fixtures

**Size:** M · **Depends on:** P01, and `fix/entrance-render` (#20, merged; it adds `DeviceFade.ts`)

## Why

P01 produces the right nodes, but two things don't render yet. A card node with a mobile screenshot needs a portrait screen and a larger radius. Faded neighbours need the whole card to fade (screen, body slab, hairline and shadow); fading the screen alone shows the opaque body slab through it.

## Context

- `src/engine/devices/card.ts`: the radius is fixed at 1.6% of width, and an opaque body slab sits behind the screen.
- `src/engine/devices/DeviceFade.ts` (`DeviceFadePass`, from #20): draws each run of devices that share an opacity into a layer and composites it back to front by `depthOrder`.
- `src/lab/fixtures/`, `/lab?still=1&fixture=…&w=…` (memory: non-still `/lab` renders at supersample 1.5, so pixel tests use `still=1`).

## Required changes

1. **Card radius.** Use 7.5% of width when `node.screenAspect < 1` (portrait) and 1.6% otherwise (quality bar §3.4 after P00). Keep the hairline border.
2. **Mobile screen fit.** A portrait card shows a mobile screenshot fitted to width and top-aligned, with the overflow cropped at the bottom (quality bar §3.1). It must never be cropped horizontally. Check that the screen compositor already does this for `card` with `screenAspect` 0.4615; fix it if not.
3. **Faded cards.** Slider neighbours at opacity 0.65 go through the `DeviceFade` path, so the card fades as one object over the background. During a step, up to five cards have different opacities at once. Measure the frame time at 1080p in `/lab` and keep it within the WP-03 frame budget (`tests/perf`). If it isn't, batch cards with equal opacity, or draw faded cards with a single pass that blends toward the background.
4. **Lab fixtures.** Add `slider-x.json` (mobile shape, 4 demo mobile screenshots) and `slider-y.json` (desktop shape, 4 demo desktop screenshots) under `src/lab/fixtures/`, using the Ash background, no shadow, grain 0 and vignette 0 (D7).

## Tests

- Pixel test (`tests/e2e`): in `slider-x` at t = 0, the active card's centre region matches the source PNG within ΔE < 1. The neighbour's centre equals `0.65 × source + 0.35 × background` within 2/255 per channel. Use generated pixel fixtures (`lab-test-bands-…`) so the expected colours are known.
- Pixel test: a portrait card's top edge shows the screenshot's top row (orientation), and its width shows the full screenshot width (no horizontal crop).
- Pixel test: the corner of a portrait card is background-coloured inside a 7.5%-radius corner, and card-coloured just inside it.
- Test that the faded neighbour shows no body-slab colour: sample a neighbour pixel over a pure-black screenshot band and compare it with `0.35 × background`.

## Evidence (`docs/presets-plan/evidence/P02/`)

- For each fixture, a 4:5 strip at t = 0, 0.25, 0.5, 0.75, 1.0 and 1.5 s next to the reference at the same times (plan README §5 rule 1).
- One still per aspect at t = 0 for each fixture (10 stills), each with one sentence on what you checked.

## Acceptance criteria

- [ ] The tests above pass and each fails when its fix is reverted.
- [ ] At 4:5, the strips match the reference: active card size and neighbour spacing within 3%, and step progress visually in step with the reference at each sampled time.
- [ ] The frame-time measurement is in the PR and within budget.
- [ ] GPU resources for the new card variant are disposed when the scene changes (the existing dispose test covers the card, or a new one does).
- [ ] Gates pass, including `test:e2e`.
