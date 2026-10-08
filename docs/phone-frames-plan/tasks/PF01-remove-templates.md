# PF01: Remove Phone Parade, Portfolio Rows and Isometric Wall

**Size:** M · **Depends on:** PF00 and PR #32 merged · **Lane:** independent of PF02–PF03

## Why

The owner wants the gallery cut to presets they will use (D1, D2). Phone Parade, Portfolio Rows and Isometric Wall go. The engine keeps the `rows`, `columns` and `wall` layouts, so saved projects and the shot card's Change layout menu still work. The owner approved deleting the 12 baselines on 8 October 2026 (D10); quote it in the PR.

## Context

Follow the shape of PR #32 (commit `9e2f22a`, "Cut the template gallery to seven presets"). It removed eight templates the same way and made the gallery fall back to the first template for a saved project whose template no longer exists.

## Required changes

Paths with line numbers are from the 8 October 2026 tree; re-check them on the latest `main`.

1. **Source.**
   - Delete `src/templates/phone-parade.ts`, `portfolio-rows.ts` and `isometric-wall.ts`.
   - Remove them from `src/templates/index.ts` (lines 5–7) and from `BUILTIN_TEMPLATES` in `src/templates/registry.ts`.
   - The gallery keeps Desktop Slider, Mobile Slider, Frames and Scroll Story until PF03 adds Mobile Frames.
2. **Slot rules.** In `src/templates/slots.ts`, remove the three ids from the multi-asset list, which leaves only `frames`. Rewrite the rule so it no longer hard-codes `template.id === "phone-parade"` for the mobile role: derive the role from the template's required slots. PF03 adds Mobile Frames to it.
3. **Demo content and previews.**
   - Remove the three entries from `DEMO_IDS_BY_TEMPLATE` (`src/templates/demo-preview.ts`).
   - Delete `public/templates/{phone-parade,portfolio-rows,isometric-wall}.{webm,webp}`.
   - `tests/template-previews.test.ts` requires exactly one pair of files per built-in template, and its count drops from 7 to 4.
4. **Migration (D9).** Remove `midnight-rows`, `angled-gallery`, `phone-columns` and `gallery-wall` from `LEGACY_PRESET_TO_TEMPLATE` (`src/doc/migrate.ts:109`). The map is then empty. Keep the export, the lookup and an empty-map test rather than deleting the mechanism, so a future template can be mapped again. Update the doc comment to list these four with the other presets that migrate without a template. Their shots still come from the v1 composition: tilted `rows` with browsers, `columns` with phones, and the `wall`.
5. **Saved projects keep rendering.** Add three lab fixtures to `src/lab/layout-fixtures.ts`. Build them the way the removed templates built their documents, as PR #32 did with `single-browser` and `pair`, and keep them as plain documents, not templates:
   - `rows-browser-tilted`: Portfolio Rows' look. 3 rows at 9:16, browser, tilt 8, speed 0.35, Graphite, wrap crossfade.
   - `columns-phone-tilted`: Phone Parade's look. 2 columns at 9:16, tilt 12, speed 0.4, Fog, graphite finish, wrap crossfade.
   - `wall-isometric`: Isometric Wall's look. 4 columns, speed 0.3, Bone, soft shadow, `isoDrift` camera at intensity 0.5, 8 s, wrap crossfade.

   Add a unit test that loads a saved v2 document of each removed template (`templateId` `"phone-parade"`, `"portfolio-rows"` and `"isometric-wall"`). Each must sanitize with no warnings and evaluate at t = 0 and t = total with every screen showing an asset. The gallery must open on `BUILTIN_TEMPLATES[0]`.

6. **Gallery tabs.** After the cut there are four templates: Single shot (Scroll Story), Mobile (Mobile Slider; PF03 adds Mobile Frames) and Portfolio (Desktop Slider, Frames). No tab is empty, so the tabs stay as they are.
7. **Tests.** Port, don't delete, every test that used a removed template as a sample. Keep each assertion as strict as before.

   | Test                                                                                                               | Today                                                         | After                                                                                                                                                                                                          |
   | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `tests/templates.test.ts:103`                                                                                      | 7 templates in order                                          | 4 in order                                                                                                                                                                                                     |
   | `tests/templates.test.ts:129` (role correctness: no desktop asset in a mobile slot)                                | phone-parade                                                  | Mobile Slider                                                                                                                                                                                                  |
   | `tests/templates.test.ts:160` (minimum screenshots for marquee and wall layouts)                                   | isometric-wall and phone-parade ("Needs 3+ …")                | Frames with 3 desktop assets ("Needs 4+ desktop screenshots"). PF03 adds the mobile case with Mobile Frames. Mobile Slider isn't in the multi-asset rule, so it would give a different message.                |
   | `tests/templates.test.ts:277–297` (`MARQUEE_TEMPLATES`, "covers every looping single-shot template")               | portfolio-rows, phone-parade, isometric-wall                  | `MARQUEE_TEMPLATES` becomes empty. Keep the coverage check: every looping single-shot template is in `NATIVE_MARQUEE_TEMPLATES` or the slider list.                                                            |
   | `tests/templates.test.ts:306, :423–430` (loop seam; cards stay in place during the wrap crossfade; `UNREGISTERED`) | the three templates                                           | Run the same checks on the three lab fixtures, so a tilted marquee's wrap crossfade and the wall's isoDrift loop are still checked. Keep `UNREGISTERED` for the cases it lists today, renamed to the fixtures. |
   | `tests/wall.test.ts` ("F11 isometric wall")                                                                        | the template's camera, copied as a constant                   | Unchanged; update the comment to name the `wall-isometric` fixture                                                                                                                                             |
   | `tests/first-run.test.ts:154` (one undo step)                                                                      | phone-parade, expects `columns`                               | Frames, expects `rows`. PF03 switches it to Mobile Frames and `columns`.                                                                                                                                       |
   | `tests/demo-assets.test.ts:154, :159`                                                                              | portfolio-rows, isometric-wall and phone-parade show 4+ sites | Frames shows 4+ desktop sites and Mobile Slider shows 4+ mobile sites                                                                                                                                          |
   | `tests/doc.test.ts:183, :190, :237`                                                                                | map values are built-in; v1 presets migrate                   | Still pass. The four presets now assert `templateId` is undefined and still assert their layout kind.                                                                                                          |
   | `tests/e2e/demo-assets.spec.ts:43` (F04)                                                                           | `__fixtures["portfolio-rows"]`                                | `frames-16x9` (rows layout)                                                                                                                                                                                    |
   | `tests/e2e/assets.spec.ts:143` and `:177` (GPU memory flat; stale document)                                        | `fixtures["isometric-wall"]`                                  | `wall-isometric`                                                                                                                                                                                               |
   | `tests/e2e/assets.spec.ts:44`, `tests/e2e/first-run.spec.ts:207`                                                   | 7 fixtures / 7 cards                                          | 4                                                                                                                                                                                                              |
   | `tests/e2e/thumbnails.spec.ts:201, :258, :292, :304`                                                               | applies phone-parade; counts 7                                | applies Mobile Slider; counts 4                                                                                                                                                                                |
   | `tests/e2e/ui-overflow.spec.ts:285` (human labels over `row1:item0`)                                               | applies portfolio-rows                                        | applies Frames (same `row{r}:item{j}` node ids)                                                                                                                                                                |
   | `tests/e2e/wave5.spec.ts:51` (pick a card and apply it)                                                            | Isometric Wall                                                | Frames                                                                                                                                                                                                         |
   | `tests/visual/stills.spec.ts:8`                                                                                    | `TEMPLATES` lists all three                                   | `["scroll-story"]`                                                                                                                                                                                             |

8. **Baselines (D10, approved).** Delete the 12 Linux baselines `phone-parade-*`, `portfolio-rows-*` and `isometric-wall-*` from `tests/visual/stills.spec.ts-snapshots/`. Quote the owner's approval in the PR. Don't add stills for the new lab fixtures here; log that as a follow-up (step 9).
9. **Docs.**
   - Update `README.md`: line 33 (the template list) and line 37 (the known issue about Portfolio rows, Phone parade and Isometric wall).
   - Update `docs/plan/README.md`: D4 at line 291, and the WP-09 and WP-11 notes at lines 196–198.
   - Update `docs/plan/wp/WP-11-templates-and-gallery.md`, `docs/plan/wp/WP-01-document-model-state-storage.md` (the migration map), `docs/plan/browser-matrix.md` (line 65 applies Phone Parade and Isometric Wall; use Desktop Frames and Mobile Slider) and `docs/plan/quality-review.md`.
   - Use "since-removed" wording, as PR #32 did.
   - In `docs/plan/follow-ups.md`, go through the rows about the removed templates: lines 26, 27, 30, 31 and 36, and the QA flake at 81. Reword each to name the layout and its lab fixture instead of the template. Remove a row if it only mattered for the template.
   - Add these follow-ups:
     - Tilted rows, tilted columns and the isometric wall have had no stills since the cut. Add stills of `rows-browser-tilted`, `columns-phone-tilted` and `wall-isometric`, which needs the owner's approval.
     - No template builds the tilted rows, phone columns or wall layouts any more; only saved projects and the Change layout menu do. Decide whether that menu keeps offering them, as was asked for stack after PR #32.
     - The pre-existing `Stage.tsx:177` edge: a project whose template was removed and that has no assets shows neither the empty state nor the fill overlay.

## Acceptance criteria

- [ ] No source, test, script or doc names `phone-parade`, `portfolio-rows` or `isometric-wall`, except `docs/archive/`, the evidence folders, the "since-removed" notes and the saved-document tests from step 5. Show the `git grep`.
- [ ] A saved document of each removed template opens, renders and exports: the unit test from step 5, plus an e2e test that loads `columns-phone-tilted` and `wall-isometric` and checks every screen has a texture.
- [ ] v1 `phone-columns`, `midnight-rows`, `angled-gallery` and `gallery-wall` projects migrate with no template and the same layout as before.
- [ ] Every ported test is at least as strict as the one it replaced, and the PR lists each port.
- [ ] The remaining baselines pass unchanged, and the owner's approval of the 12 deletions is quoted.
- [ ] Gates pass: typecheck, lint, test, build, and test:e2e (the full suite, since `src/` changes).
