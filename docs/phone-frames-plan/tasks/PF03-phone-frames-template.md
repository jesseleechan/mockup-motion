# PF03: Phone Frames template, editor support, Desktop Frames rename

**Size:** M · **Depends on:** PF02 (and the owner's answers to D3 and D4)

## Why

PF02 gives `columns` the Frames loop. This task builds the template, makes the editor treat a columns Frames shot like a rows one, and renames Frames to Desktop Frames in the UI.

## Context

- `src/templates/frames.ts` (the model), `src/templates/slider-template.ts` (one factory for two sizes: the pattern to copy).
- `src/motion/layouts/duration.ts:70–73`: `minShotDuration` is the single hook the editor and store use for the Frames minimum. Today it only knows `rows` with `travel: "period"`.
- `src/editor/inspector/shot/LayoutSection.tsx`: lines 149–158 hold the rows period branch ("Speed follows shot length", "Shows the first N screenshots…"); lines 239–288 hold the columns controls.
- `src/editor/labels.ts:27` (`columns: "Phone columns"`, `shotSummary` at 178–184), `src/lab/LabPage.tsx:66–70` (the per-aspect `frames-*` fixtures).
- `quality-bar.md` §4 (Phone Frames) as written in PF00.

## Required changes

1. **One factory for both sizes.** Turn `frames.ts` into a `framesTemplate(spec)` factory in `src/templates/frames-template.ts`, like `slider-template.ts`, with a spec of `{ id, name, description, category, role: "desktop" | "mobile" }`.
   - The desktop spec builds exactly today's Frames document. The PF02 golden test and the `frames-*` baselines prove it.
   - The mobile spec builds a `columns` layout with `device: "card"`, tilt 0, `travel: "period"`, and the §3 column count and `cardWidth` for the aspect.
   - Both share the rest: Ash background, shadow none, grain 0, vignette 0, a `cut` wrap, entrance none, a static camera, `loop: true`, deduped slot assets, and duration `max(15, framesDuration(layout, aspect))`.
   - Export `framesLayout(aspect, ids)` (unchanged) and `phoneFramesLayout(aspect, ids)`.
2. **Templates.**
   - `src/templates/frames.ts` keeps `framesTemplate` with id `frames`, name "Desktop Frames" (D4) and description "Rows of desktop screens that glide past in alternating directions." (unchanged).
   - `src/templates/phone-frames.ts` (the id follows D3): name "Phone Frames", description "Columns of mobile screens that glide up and down in alternating directions.", category `mobile`, slots `mobile1`–`mobile6` with 4 required (D8).
   - Register it in `index.ts` and `registry.ts` after Desktop Frames.
3. **Slot rule.** Add Phone Frames to the multi-asset rule in `slots.ts`: needs 4 mobile screenshots, message "Needs 4+ mobile screenshots".
4. **Demo content.** Add a `DEMO_IDS_BY_TEMPLATE` entry: five mobile heroes from five different sites. Order them so the gallery poster frame shows a photographic hero in the middle column at 16:9.
5. **Editor.**
   - The columns section of `LayoutSection.tsx` gets the same period branch as rows: hide Speed, show "Speed follows shot length" and, when screenshots are left out, "Shows the first N screenshots, so the loop fits in 30 s."
   - Hide the Tilt control for a period layout of either kind. Tilt is 0 by design and a tilted Frames was never specified. This is the one visible change to Desktop Frames' inspector; say so in the PR.
   - The Columns count select stays, limited to 2–5 as today.
   - `labels.ts`: a columns shot with `device: "card"` is summarised as "Phone frames" (or "Mobile frames" per D3), not "Phone columns". A rows shot with `travel: "period"` reads "Desktop frames".
6. **Aspect change (D13).** Add `refitFramesLayout(layout, aspect)` next to the factory. For a rows or columns layout with `travel: "period"`, it returns the layout with the lane count and card size of `framesLayout` or `phoneFramesLayout` at that aspect, keeping `assetIds`. Anything else comes back unchanged. Call it for every shot from the aspect change in `TopBar.tsx:94–101` and `ExportModal.tsx:153–159`, then clamp each shot's duration to `[minShotDuration, 30]`, all in the one undo step that changes the aspect. Test: Phone Frames built at 9:16 and switched to 16:9 equals Phone Frames built at 16:9 with the same screenshots (layout and duration). Desktop Frames 16:9 → 4:5 gives 3 rows. A tilted `rows` or `columns` shot is unchanged. One undo restores both the aspect and the layouts.
7. **Lab fixtures.** Add `phone-frames-16x9`, `-9x16`, `-1x1`, `-4x5` and `-4x3` next to the `frames-*` fixtures in `LabPage.tsx`.
8. **Evidence** (`docs/phone-frames-plan/evidence/PF03/`).
   - One still per aspect at t = 0 from `/lab?still=1&fixture=phone-frames-<aspect>&w=1200`, each with one sentence on what you checked: column count, card size against §3, margins or crop, and the portrait card radius.
   - The same five for `frames-<aspect>`, side by side with Phone Frames, to show it is the same effect.
   - A 4:5 strip at t = 0, 5 and 10 s.

## Tests

- Template: Phone Frames builds at all five aspects with the §3 column count and card width, sanitizes with no warnings, has `schedule(doc).total` equal to the shot duration (≥ 15 s), and has `evaluate(doc, 0)` equal to `evaluate(doc, total)`.
- Every node is `device: "card"` with `screenAspect` 0.4615, including for a tall full-page mobile capture.
- Desktop Frames is unchanged: `frames` builds the same document as before (golden from PF02), and its gallery card shows "Desktop Frames".
- Slots: "Needs 4+ mobile screenshots" with 3 mobile assets; valid with 4. Desktop assets never fill a mobile slot.
- Store: setting a Phone Frames shot's duration below `framesDuration` clamps to it (copy the rows case in `tests/frames.test.ts:339–377`).
- Port `tests/first-run.test.ts:154` (one undo step) back to Phone Frames, expecting a `columns` layout, if PF01 moved it to Frames.
- `tests/demo-assets.test.ts`: Phone Frames shows 4+ different mobile sites.
- E2E `tests/e2e/frames.spec.ts`: add the columns case of "replaces the speed slider and keeps its minimum duration" and of "more screenshots than fit 30 s". Keep it in its current shard; if you add a new spec file, put it in the lightest group in `scripts/e2e-shards.ts`.
- E2E `tests/e2e/assets.spec.ts:44`: every Phone Frames screen loads a texture (the count rises by one).

## Acceptance criteria

- [ ] The tests above pass, and each guarding test fails when its change is reverted.
- [ ] At every aspect the Phone Frames still matches §3 within 3% (card size, margins or crop, gap), and no mobile screenshot is cropped horizontally.
- [ ] Each card's screenshot is color-exact (ΔE < 1 against the PNG at a frontal camera).
- [ ] A 4:5 export loops without a visible pop over three loops. Say in the PR that you watched it.
- [ ] The `frames-*` and all other existing baselines pass unchanged. No new baselines here; PF04 writes them.
- [ ] Gates pass: typecheck, lint, test, build, test:e2e.
