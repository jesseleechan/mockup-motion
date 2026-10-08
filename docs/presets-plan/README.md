# Presets plan: Mobile Slider, Desktop Slider, Frames

**Status: done.** P00–P05 are merged: [#22](https://github.com/jesseleechan/mockup-motion/pull/22), [#23](https://github.com/jesseleechan/mockup-motion/pull/23), [#27](https://github.com/jesseleechan/mockup-motion/pull/27), [#29](https://github.com/jesseleechan/mockup-motion/pull/29), [#24](https://github.com/jesseleechan/mockup-motion/pull/24) and [#30](https://github.com/jesseleechan/mockup-motion/pull/30). The owner signed off on the P05 contact sheet and approved the baselines on 8 October 2026. The loop checks are measured (unit tests and frame comparisons); no one has yet watched three loops of each preset as quality bar §8 asks. Three follow-ups the owner accepted as recommended in P05 (slider far-slot fade, no Camera section on sliders, a 30 s rule for Frames) are in `docs/plan/follow-ups.md`. Written 7 October 2026.

The owner wants three new presets that will be used far more than the current twelve. Each one copies the motion of a Rico Supply Jitter template. [`reference.md`](reference.md) has the measurements; read it before any task.

| Preset (working name) | What it does                                                                                                                                                                             | Reference                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Mobile Slider**     | A horizontal carousel of tall mobile cards. The centre card is full size; its neighbours are smaller and faded. Every 2 s the row steps one card to the left with a soft, decisive ease. | [Slider 5-02](https://rico.supply/products/slider-5-02) |
| **Desktop Slider**    | The same carousel turned vertical, with landscape desktop cards stepping up.                                                                                                             | [Slider 6-01](https://rico.supply/products/slider-6-01) |
| **Frames**            | A flat grid of desktop cards in three rows. Each row slides continuously, alternating left and right.                                                                                    | [Frames 1-01](https://rico.supply/products/frames-1-01) |

All three use flat cards with no device chrome, a flat light grey background, no tilt, and a still camera. The existing twelve templates stay.

## 1. What has to be built

The two sliders share one new layout. Frames is close to the existing `rows` layout.

- **A `slider` layout** (`src/motion/layouts/slider.ts`): a ring of cards on one axis that steps one slot per step period. The active card is at scale 1 and full opacity; the others are at scale 0.75 and opacity 0.65, interpolated with the step progress. It loops natively: after N steps (N = number of screenshots) the arrangement is back where it started, so a single looping shot with a `cut` wrap has frame(total) ≡ frame(0) and needs no crossfade.
- **A `slide` easing**, cubic-bezier(0.40, 0, 0.05, 1), fitted to the reference (max error 0.017).
- **Card shapes.** A portrait card shows a mobile screenshot at the phone screen aspect (0.4615) with a 7.5% corner radius. Today a `card` node gets the desktop aspect (1.6) for any tall image, which would crop a mobile screenshot to a landscape strip.
- **Whole-card fading** for the faded neighbours. `src/engine/devices/DeviceFade.ts` (`DeviceFadePass`, merged in #20) fades each device as one layer (screen, body, border, shadow). The slider builds on it.
- **Rows options for Frames:** card height and gap, and a loop mode where every row travels exactly one asset period per loop, so Frames loops natively instead of crossfading.
- **Three templates**, a light neutral palette, gallery order, editor controls for the new layout fields, lab fixtures, previews, contact sheets and visual baselines.

## 2. Decisions

The owner decided all eight on 8 October 2026: "D1. yes make them first", "D2. your recommended frames-only limit of 0.2 frame heights per second", "D3. one speed for all rows", and "D4-D8: whatever you recommend". So every row below is decided as written. P00 writes them into `quality-bar.md` and `contracts.md` before any code is written.

| #   | Decision                                                          | Decided (8 Oct 2026)                                                                                                                                                                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Gallery order and the default template                            | Put the three presets first in the gallery: Desktop Slider, Mobile Slider, Frames. `BUILTIN_TEMPLATES[0]` is also the first-run default, so Desktop Slider becomes the default.                                                                                                                                                                        |
| D2  | Frames speed vs quality bar §2.5 (marquees ≤ 0.12 frame widths/s) | Add a Frames-specific limit of **0.20 frame heights per second** and keep 0.12 frame widths/s for every other marquee. At 4:5 the reference runs at 0.15–0.245 frame widths/s. Under the current cap a 4-screenshot Frames loop at 9:16 needs more than 30 s, which is over the shot limit.                                                            |
| D3  | Frames row speeds                                                 | All rows move at the **same speed**, alternating direction, each travelling one asset period per loop. That gives a native, seamless loop. The reference's different row speeds (ratio 4 : 3 : 5) only loop because its cards are identical; with real screenshots they need a wrap crossfade, which F11 and the marquee speed fix found unattractive. |
| D4  | Slider step length                                                | **2.0 s per screenshot** as in the reference: a 1.85 s move, then 0.15 s of hold. The inspector offers 1.6–4.0 s; extra time becomes hold. A shot lasts N × step, so 4 screenshots make an 8 s loop.                                                                                                                                                   |
| D5  | Faded neighbours vs "screens are color-exact"                     | Allow it: the active card is exact; neighbours are a deliberate 65% fade with a 0.75 scale. Add this as a named exception in quality bar §3.1.                                                                                                                                                                                                         |
| D6  | Minimum screenshots                                               | Sliders need 3 and work best with 4–6. Frames needs 4. With fewer screenshots than visible slots, the far cards fade out instead of repeating a screenshot (quality bar §4).                                                                                                                                                                           |
| D7  | Background                                                        | A new solid palette, **Ash** `#DFE1E3`, sampled from the reference. Grain 0 and vignette 0, because a flat light fill can't band.                                                                                                                                                                                                                      |
| D8  | Names                                                             | "Mobile Slider" (`mobile-slider`), "Desktop Slider" (`desktop-slider`), "Frames" (`frames`).                                                                                                                                                                                                                                                           |

## 3. Tasks

| Task                                     | Title                                                                                   | Size | Depends on      | Status                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------- | ---- | --------------- | ------------------------------------------------------------------ |
| [P00](tasks/P00-decisions-and-rules.md)  | Record the decisions in the quality bar and contracts                                   | S    | —               | Done: [#22](https://github.com/jesseleechan/mockup-motion/pull/22) (docs only) |
| [P01](tasks/P01-slider-motion.md)        | `slide` easing and the `slider` layout (motion only)                                    | M    | P00             | Done: [#23](https://github.com/jesseleechan/mockup-motion/pull/23), [evidence](evidence/P01) |
| [P02](tasks/P02-slider-rendering.md)     | Portrait cards, faded neighbours, slider lab fixtures                                   | M    | P01, #20 merged | Done: [#27](https://github.com/jesseleechan/mockup-motion/pull/27), [evidence](evidence/P02) |
| [P03](tasks/P03-slider-templates.md)     | Mobile Slider and Desktop Slider templates, document and editor support                 | M    | P02             | Done: [#29](https://github.com/jesseleechan/mockup-motion/pull/29), [evidence](evidence/P03) |
| [P04](tasks/P04-frames.md)               | Frames: rows options, native loop, template                                             | M    | P00             | Done: [#24](https://github.com/jesseleechan/mockup-motion/pull/24), [evidence](evidence/P04) |
| [P05](tasks/P05-review-and-baselines.md) | Gallery order, previews, contact sheet review, visual baselines (**owner review gate**) | S    | P03, P04        | Done: [#30](https://github.com/jesseleechan/mockup-motion/pull/30), [evidence](evidence/P05) |

P01 → P02 → P03 is one lane. P04 is a second lane that can run alongside it after P00, because it only touches `rows`, `marquee.ts` and a new template. The two lanes meet in P05, along with the shared files: `registry.ts`, `tests/templates.test.ts` and `tests/visual/stills.spec.ts`. Keep each lane's edits to those files small so the second PR merges cleanly.

## 4. When to start

State on 8 October 2026: the fix branches are all merged: `fix/marquee-speed` (#18), `fix/camera-loop-seam` (#19), `fix/entrance-render` (#20, `DeviceFadePass`) and `fix/entrance-loop-hint` (#21; a looping shot 0 skips its entrance).

- P00, P01 and P04 can start now. P04 builds on the merged marquee speed fix.
- P02 needs `DeviceFade.ts` from #20, which is merged, so it can start once P01 is done.
- Two open follow-ups touch the same code; do them first only if the owner asks: "`fillSlots` reuses one asset across slots" (the templates here dedupe on their own, as phone-parade does) and "the Shot inspector's Layout select only switches between a single device and a title card".

Before P00, re-read `contracts.md` §4–§5 and `src/motion/layouts/marquee.ts` on the latest `main`. The loop and marquee rules were still changing when this plan was written.

## 5. Rules for the executor

The fix plan's rules (`docs/fix-plan/README.md` §3) apply unchanged: look at every still you render, prove each guarding test can fail, never weaken a test, no silent fallbacks, no placeholder assets, run every gate, evidence-based status, stay in scope. In addition:

1. **Match the reference, then judge it.** Each visual task commits side-by-side strips under `docs/presets-plan/evidence/Pxx/`: our 4:5 frame next to the reference at the same times (0, 0.25, 0.5, 0.75, 1.0, 1.5 s of a step for the sliders; 0, 5, 10 s for Frames). Capture the reference frames from the public preview yourself and keep them only in the evidence folder, at 540 px wide or less.
2. **Numbers come from `reference.md`.** If you change one, say why in the PR and update `reference.md` in the same PR.
3. **Every aspect.** Check all five aspects (16:9, 9:16, 1:1, 4:5, 4:3) on the contact sheet. The reference only shows 4:5, so the other four need the most care.
4. **Branches and commits:** one task per branch and PR, named `presets/Pxx-<slug>`. Commit messages start with `Pxx:`.
5. **Baselines:** every new or changed visual baseline needs the owner's written approval of the rendered diff (`tests/visual/README.md`). P05 is the only task that writes baselines.

## 6. Prompt for the executor

```
You are adding new presets to MockupMotion, a local-first web app (React + three.js + Mediabunny)
that turns website screenshots into presentation videos.

Read, in order: CLAUDE.md, docs/fix-plan/README.md §3 ("Rules for the executor"),
docs/presets-plan/README.md (all of it), docs/presets-plan/reference.md, docs/plan/contracts.md,
docs/plan/quality-bar.md, then docs/presets-plan/tasks/Pxx-*.md.

Do task Pxx only. Meet every acceptance criterion. Prove each guarding test fails when you revert
the change. Render and inspect the stills and reference strips the task asks for and commit them
under docs/presets-plan/evidence/Pxx/. Run all gates (typecheck, lint, test, build, test:e2e) and
report the pass/fail counts. Update the task's status in docs/presets-plan/README.md only when the
evidence exists. Open one PR named "Pxx: <title>" whose description lists every acceptance
criterion with its evidence.
```

## 7. Definition of done (whole plan)

- The three presets are first in the gallery (or wherever D1 put them), render at all five aspects, and loop seamlessly: frame(0) equals frame(total) in a unit test, and three watched loops show no pop.
- At 4:5 each preset matches its reference strip within the tolerances in its task.
- Slider steps follow the `slide` curve, nothing reverses, and no screenshot appears twice in view.
- The active slider card and every Frames card show their screenshot color-exact (ΔE < 1 at a frontal camera).
- The owner has signed off on the P05 contact sheet and approved the new baselines. CI's `unit`, `e2e` and `visual` jobs are green.
