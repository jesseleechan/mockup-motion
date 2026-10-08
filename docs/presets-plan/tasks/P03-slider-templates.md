# P03: Mobile Slider and Desktop Slider templates, document and editor support

**Size:** M · **Depends on:** P02

## Why

This turns the slider into two presets and makes it editable: users can add screenshots, change the step length, and switch axis without breaking the loop.

## Context

- `src/templates/phone-parade.ts` (dedupes its slots), `portfolio-rows.ts`, `looks.ts`, `registry.ts`, `demo-preview.ts`.
- Places that switch on `layout.kind` (P01 gave them a minimal case): `src/editor/inspector/shot/LayoutSection.tsx`, `src/editor/timeline/ShotCard.tsx`, `src/editor/library/MediaTab.tsx`, `src/state/store.ts`, `src/storage/user-templates.ts`.

## Required changes

1. **Palette.** Add Ash (`#DFE1E3`, solid) to the palettes in `src/templates/looks.ts` and wherever the editor lists palettes (D7). Done in P04, which needed it for Frames: Ash is in `BUILTIN_PALETTES` (`src/doc/palettes.ts`, so the Video inspector lists it) and in `PaletteId`.
2. **Templates.** Add `src/templates/mobile-slider.ts` and `desktop-slider.ts`:
   - Mobile Slider: category `mobile`; slots `mobile1`–`mobile3` required and `mobile4`–`mobile6` optional; layout `{ kind: "slider", axis: "x", shape: "mobile", step: 2.0 }`.
   - Desktop Slider: category `portfolio`; slots `desktop1`–`desktop3` required and `desktop4`–`desktop6` optional; layout `{ kind: "slider", axis: "y", shape: "desktop", step: 2.0 }`.
   - Both: dedupe slot assets (as phone-parade does), duration = `sliderDuration(layout)`, `loop: true`, `transitionIn` a `cut` (the loop is native), camera `static` with intensity 0 and float 0, entrance `none`, Ash background, shadow off, grain 0, vignette 0, light frame appearance.
   - Descriptions: one calm line each, for example "A horizontal carousel of mobile screens that steps from one to the next."
3. **Editor.**
   - The Layout section shows, for a slider: Direction (Horizontal / Vertical), Card shape (Mobile / Desktop) and Step length (1.6–4.0 s, 0.1 s steps).
   - Changing the step length or the screenshot count updates `Shot.duration` to `sliderDuration`, so the loop stays seamless. While the layout is a slider, the shot duration control is read-only and explains why in one short line, for example "Set by step length × screenshots".
   - Dropping a screenshot on the stage or adding one from the Media tab adds it to `assetIds` (as for rows and wall). Removing one takes it out and updates the duration.
   - Shot cards in the timeline show a slider thumbnail.
4. **User templates.** `src/storage/user-templates.ts` saves and restores slider layouts with their asset slots.

## Tests

- `tests/templates.test.ts`: the template count and ids include both sliders, and both build at all five aspects with 3, 4 and 6 screenshots. The built doc's duration equals N × step, and `schedule(doc).total` equals the duration (native loop, no wrap crossfade).
- Loop seam, end to end: `evaluate(doc, 0)` and `evaluate(doc, total)` give the same frame for both templates.
- e2e: apply Mobile Slider from the gallery with demo content, change the step length to 3.0 s, and check that the shot duration becomes N × 3.0 and that undo restores both.
- e2e: add a screenshot to a slider shot from the Media tab, and check that it appears in `assetIds` and the duration grows by one step.

## Acceptance criteria

- [ ] The tests above pass and each fails when its change is reverted.
- [ ] A 4:5 export of each template (WebM on Linux CI, MP4 locally) loops without a visible pop over three loops. Say in the PR that you watched it.
- [ ] UI copy follows CLAUDE.md: short, calm, sentence case.
- [ ] Gates pass, including `test:e2e`. Visual baselines are not touched (P05 does that).
