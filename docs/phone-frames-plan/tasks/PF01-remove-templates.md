# PF01: Remove Phone Parade and Portfolio Rows

**Size:** M · **Depends on:** PF00, PR #32 merged, the owner's approval of the baseline deletions (D10) · **Lane:** independent of PF02–PF03

## Why

The owner wants the gallery cut to presets they will use (D1). Phone Parade and Portfolio Rows go, and Isometric Wall goes too if D2 says so. The engine keeps the `rows` and `columns` layouts, so saved projects and the shot card's Change layout menu still work.

## Context

Follow the shape of PR #32 (commit `9e2f22a`, "Cut the template gallery to seven presets"). It removed eight templates the same way and made the gallery fall back to the first template for a saved project whose template no longer exists.

## Required changes

Paths with line numbers are from the 8 October 2026 tree; re-check them on the latest `main`.

1. **Source.** Delete `src/templates/phone-parade.ts` and `src/templates/portfolio-rows.ts`. Remove them from `src/templates/index.ts` (lines 5–6) and `BUILTIN_TEMPLATES` in `src/templates/registry.ts`.
2. **Slot rules.** In `src/templates/slots.ts`, remove both ids from the multi-asset list. Write the rule so it no longer depends on `template.id === "phone-parade"` for the mobile role: derive the role from the template's required slots. PF03 adds Phone Frames to it.
3. **Demo content and previews.** Remove the `phone-parade` and `portfolio-rows` entries from `DEMO_IDS_BY_TEMPLATE` (`src/templates/demo-preview.ts`). Delete `public/templates/phone-parade.{webm,webp}` and `portfolio-rows.{webm,webp}`. `tests/template-previews.test.ts` requires exactly one pair of files per built-in template, and its count drops from 7 to 5 (or 4).
4. **Migration (D9).** Remove `midnight-rows`, `angled-gallery` and `phone-columns` from `LEGACY_PRESET_TO_TEMPLATE` (`src/doc/migrate.ts:109`). Update the doc comment above it to list them with the other presets that migrate without a template. Their shots still come from the v1 composition: tilted `rows` with browsers, and `columns` with phones.
5. **Saved projects keep rendering.** Add two lab fixtures to `src/lab/layout-fixtures.ts`, built the way the removed templates built their documents (as PR #32 did with `single-browser` and `pair`):
   - `rows-browser-tilted`: Portfolio Rows' layout and style: 3 rows at 9:16, browser, tilt 8, speed 0.35, Graphite, wrap crossfade.
   - `columns-phone-tilted`: Phone Parade's layout and style: 2 columns at 9:16, tilt 12, speed 0.4, Fog, graphite finish, wrap crossfade.

   Keep the fixtures as plain documents, not templates. Add a unit test that loads a saved v2 document for each (with `templateId: "phone-parade"` and `"portfolio-rows"`). Each must sanitize with no warnings, evaluate at t = 0 and t = total with every screen showing an asset, and open in the gallery on `BUILTIN_TEMPLATES[0]`.

6. **Isometric Wall (only if D2 removes it).** Do the same for `isometric-wall`: its source, its registry entry, its slot rule, its demo ids and previews, its 4 baselines, `gallery-wall` in the migration map (it then migrates without a template), and a `wall-isometric` lab fixture. If D2 keeps it, leave it untouched.
7. **Gallery tabs.** After the cut, the gallery's Mobile tab holds only Mobile Slider until PF03. That's fine. If D2 also removes Scroll Story, the Single shot tab is empty: remove it from `TemplateGalleryModal.tsx` (lines 35–40) and from `LibraryPanel.tsx` (line 34), and update `tests/e2e/wave5.spec.ts`. Never ship an empty tab.
8. **Tests.** Port, don't delete, every test that used a removed template as a sample. Keep each assertion as strict as before:

   | Test                                                                                | Today                                         | After                                                                                                                                                                                          |
   | ----------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `tests/templates.test.ts:103`                                                       | 7 templates in order                          | the new count and order                                                                                                                                                                        |
   | `tests/templates.test.ts:129` (role correctness: no desktop asset in a mobile slot) | phone-parade                                  | Mobile Slider                                                                                                                                                                                  |
   | `tests/templates.test.ts:160` ("Needs 3+ mobile screenshots")                       | phone-parade                                  | Frames with 3 desktop assets ("Needs 4+ desktop screenshots"); PF03 adds the mobile case with Phone Frames. Mobile Slider is not in the multi-asset rule, so it would give a different message |
   | `tests/templates.test.ts:277–280, :423–430` (`MARQUEE_TEMPLATES`, `UNREGISTERED`)   | lists both                                    | drop them; if the crossfade-in-place test loses every case, move it onto the two new lab fixtures so the wrap crossfade of a tilted marquee is still checked                                   |
   | `tests/first-run.test.ts:154` (one undo step)                                       | phone-parade, expects `columns`               | Frames, expects `rows` (PF03 can switch it to Phone Frames and `columns`)                                                                                                                      |
   | `tests/demo-assets.test.ts:154, :159`                                               | portfolio-rows and phone-parade show 4+ sites | Frames shows 4+ desktop sites and Mobile Slider shows 4+ mobile sites                                                                                                                          |
   | `tests/doc.test.ts:183, :190`                                                       | map values are built-in; v1 presets migrate   | still pass; the three presets now assert `templateId` is undefined and still assert their layout kind                                                                                          |
   | `tests/e2e/demo-assets.spec.ts:43` (F04)                                            | `__fixtures["portfolio-rows"]`                | `frames-16x9` (rows layout)                                                                                                                                                                    |
   | `tests/e2e/thumbnails.spec.ts:201, :258, :292, :304`                                | applies phone-parade; counts 7                | applies Mobile Slider; new counts                                                                                                                                                              |
   | `tests/e2e/ui-overflow.spec.ts:285` (human labels over `row1:item0`)                | applies portfolio-rows                        | applies Frames (same `row{r}:item{j}` node ids)                                                                                                                                                |
   | `tests/e2e/first-run.spec.ts:207`, `tests/e2e/assets.spec.ts:44`                    | 7 cards / 7 fixtures                          | new counts                                                                                                                                                                                     |
   | `tests/visual/stills.spec.ts:8`                                                     | `TEMPLATES` lists both                        | remove them                                                                                                                                                                                    |

9. **Baselines (D10).** Delete the 8 Linux baselines `phone-parade-*` and `portfolio-rows-*` from `tests/visual/stills.spec.ts-snapshots/` (12 if Isometric Wall goes). Quote the owner's approval in the PR. Don't add stills for the new lab fixtures here; log that as a follow-up (step 10).
10. **Docs.**
    - Update `README.md` (lines 33 and 37: the template list and the Portfolio rows / Phone parade known issue), `docs/plan/README.md` (D4 at line 291, and the WP-09 and WP-11 notes at 196–198), `docs/plan/wp/WP-11-templates-and-gallery.md`, `docs/plan/wp/WP-01-document-model-state-storage.md` (the migration map) and `docs/plan/quality-review.md`. Use "since-removed" wording as PR #32 did.
    - In `docs/plan/follow-ups.md`, reword the rows about the removed templates (lines 26, 30, 31, 36 and the QA flake at 81) to name the layout and the lab fixture instead of the template, or remove the rows that only mattered for the template.
    - Add these follow-ups:
      - Tilted rows and columns have no stills since the cut; add `rows-browser-tilted` and `columns-phone-tilted` stills, which needs approval.
      - The pre-existing `Stage.tsx:177` edge: a project whose template was removed and that has no assets shows neither the empty state nor the fill overlay.

## Acceptance criteria

- [ ] No source, test, script or doc outside `docs/archive/`, the evidence folders and the "since-removed" notes names `phone-parade` or `portfolio-rows` (show the `git grep`).
- [ ] A saved document of each removed template opens, renders and exports: the unit test from step 5, plus one e2e test that loads `columns-phone-tilted` and checks every screen has a texture.
- [ ] v1 `phone-columns`, `midnight-rows` and `angled-gallery` projects migrate with no template and the same layout as before.
- [ ] Every ported test is at least as strict as the one it replaced; the PR lists each port.
- [ ] The remaining baselines pass unchanged; the deletions are approved in writing and quoted.
- [ ] Gates pass: typecheck, lint, test, build, test:e2e (full suite, since `src/` changes).
