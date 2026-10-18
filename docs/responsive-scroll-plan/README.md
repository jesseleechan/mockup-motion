# Responsive Scroll plan

**Status: in progress.** Written 18 October 2026. The owner decided D1–D6 the same day: "go with your recommendations" (§3). The plan is [#45](https://github.com/jesseleechan/mockup-motion/pull/45); R01 is [#47](https://github.com/jesseleechan/mockup-motion/pull/47).

On 18 October 2026 the owner approved four preset proposals from a shortlist with live previews. Each one is built in its own session. This plan covers **Responsive Scroll** only: the desktop and mobile versions of one page scroll together, section by section, and stop on the same sections.

Why it matters: every flat preset needs 3–4 screenshots, so a designer with one site only has Scroll Story today. `npm run capture` (`scripts/capture.ts`) already writes a desktop full page (1440 px) and a mobile full page (390 px at 2×) of one URL, each with a JSON file of section positions. Responsive Scroll turns that one capture into a video.

## 1. The approved design

From the preview the owner approved (18 October 2026):

- **Look.** The house style of the flat presets: Ash `#DFE1E3` or Onyx `#141417` solid background through the Light / Dark switch (`toneSwitch`), frameless cards (quality bar §3.4), shadow none, grain 0, vignette 0, still camera. A landscape card at the 1.6 desktop screen aspect and a portrait card at the 0.4615 phone screen aspect with a 7.5% radius.
- **Side by side at 16:9, 4:3 and 1:1.** Desktop left, mobile right, a 0.05 stage-unit gap. Card height = min(0.66, (0.86 × W − 0.05) / (1.6 + 0.4615)), where W is the frame width in stage units. The pair is centred.
- **Stacked at 4:5 and 9:16.** Desktop on top, 0.86 × W wide; mobile below, a 0.04 gap, mobile height = min(0.86 − desktop height − 0.04, 0.6). The pair is centred.
- **Stops are sections, not 0–1 fractions.** Both screens hold with the same section at the top of their screen at the same time. Each segment takes the time the screen that travels further needs at 0.9 screen heights per second (the average rate of `src/motion/scroll.ts`), with 1.0 s holds and `smooth` easing.
- **Loop.** A scroll can't reverse (quality bar §2.5), so the loop uses the 0.8 s wrap crossfade back to the top (`contracts.md` §5). The crossfade falls inside the last 1.0 s hold, so nothing moves while it fades.

Card sizes per aspect (stage units, frame height 1):

| Aspect | W     | Arrangement  | Desktop card (w × h) | Mobile card (w × h) | Group (w × h) |
| ------ | ----- | ------------ | -------------------- | ------------------- | ------------- |
| 16:9   | 1.778 | side by side | 1.056 × 0.660        | 0.305 × 0.660       | 1.411 × 0.660 |
| 4:3    | 1.333 | side by side | 0.851 × 0.532        | 0.246 × 0.532       | 1.147 × 0.532 |
| 1:1    | 1     | side by side | 0.629 × 0.393        | 0.181 × 0.393       | 0.860 × 0.393 |
| 4:5    | 0.8   | stacked      | 0.688 × 0.430        | 0.180 × 0.390       | 0.688 × 0.860 |
| 9:16   | 0.563 | stacked      | 0.484 × 0.302        | 0.239 × 0.518       | 0.484 × 0.860 |

Every group stays inside the 7% safe margin (quality bar §4): at most 0.86 of the frame width and of the frame height.

### Demo timing (Aurelia)

Measured on 18 October 2026 with Playwright from `demo-sites/aurelia` (`recordSectionBoundaries`, 1440 px at 1×, 390 px at 2×). The desktop numbers match `public/demo/aurelia/sections.json` exactly; the mobile page height matches `mobile-full.webp` (780 × 11436 at 2× = 5718 CSS px).

A desktop screen shows 1440 / 1.6 = 900 CSS px of page; a phone screen 390 / 0.4615 = 845 px.

| Segment               | Desktop travel (screens) | Mobile travel (screens) | Time at 0.9 screens/s |
| --------------------- | ------------------------ | ----------------------- | --------------------- |
| top → works           | 1664 px (1.85)           | 1602 px (1.90)          | 2.11 s                |
| works → materials     | 745 px (0.83)            | 1431 px (1.69)          | 1.88 s                |
| materials → monograph | 679 px (0.75)            | 1056 px (1.25)          | 1.39 s                |

Moves 5.38 s + four 1.0 s holds = a **9.4 s** loop. The shot itself lasts 10.2 s: a looping single shot shows `duration − 0.8` s and its wrap crossfade covers the 0.8 s before the loop point, so the extra 0.8 s puts the fade inside the last hold instead of the last move (R03).

Mobile sections of the five demo sites (CSS px, same measurement; R01 commits them as `public/demo/<site>/sections-mobile.json`):

| Site        | Mobile page | Sections (top)                                                                                     |
| ----------- | ----------- | -------------------------------------------------------------------------------------------------- |
| aurelia     | 5718        | header 0, hero 71, statement 832, works 1602, materials 3033, monograph 4089, footer 5044          |
| northwind   | 6477        | header 0, hero 66, dashboard 726, features 1948, code 3056, social 3760, pricing 4011, footer 5702 |
| maison-oak  | 5017        | header 54, hero 126, collection 1015, spotlight 1803, workshop 2672, reviews 3205, footer 4348     |
| field-notes | 6297        | header 213, hero 287, article 1260, dispatch 2983, photo-essay 3832, related 4663, footer 5436     |
| studio-kova | 4893        | header 0, hero 66, works 694, manifesto 2374, clients 3270, awards 3852, footer 4469               |

Every site has the same section ids at both widths, so matching stops by section id works for all five.

## 2. What has to be built

The engine already scrolls any screen: `LayoutNode.scroll` (0..1 of the scrollable range) reaches the screen compositor for every device (`src/engine/materials/screen.ts`), and the `card-scroll` lab fixture scrolls a card. The new work is in the document model, motion and templates:

1. **Section data on the asset.** Nothing in the app reads a capture's JSON today: the media import accepts images only. Import has to accept the capture JSON next to its screenshot, match the two, and store the sections on the asset.
2. **A two-screen layout that scrolls.** `ScrollSpec` is "honoured only for single-device layouts" (`src/doc/types.ts`, `evaluateNodes` in `src/motion/evaluate.ts`). The `pair` layout draws a browser and a phone (`arrangement: "overlap" | "side"`) with sizes from quality bar §4 "Responsive pair", which don't match the approved cards or the stacked arrangement.
3. **Section-keyed stops** shared by both screens, with the timing rule in §1 and a fallback when section data is missing.
4. **Slot pairing**: both screenshots must be of the same page.
5. **The template**, gallery placement, inspector controls, lab fixtures, previews, contact sheet and baselines.

## 3. Decisions (decided 18 October 2026)

The owner answered "go with your recommendations", so every row below is decided as written, and so are the smaller choices after the table. R00 records them in `quality-bar.md` and `contracts.md`.

| #   | Decision                           | Decided                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Gallery home                       | **Both the Desktop and the Mobile tab** (and All), last in the gallery order. A third tab with one preset in it is a lot of chrome for one card, and a designer filtering by either size should find it. The card's chip reads "Desktop + mobile". It joins no size pair, so the "fits your screenshots" hint (`fittingTemplateId`) leaves it alone.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D2  | Flat cards or devices              | **Flat cards, as previewed.** They match the other flat presets and give the screenshots more room. Scroll Story stays the preset with a browser and a phone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D3  | Side by side or stacked per aspect | **As previewed:** side by side at 16:9, 4:3 and 1:1, stacked at 4:5 and 9:16, with the sizes in §1. 1:1 is the closest call: side by side gives a 0.63 × 0.39 desktop card and a 0.18 × 0.39 phone; stacked would give a larger desktop card (0.86 × 0.54) but a 0.13 × 0.28 phone, too small to read.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D4  | Slot pairing (same page)           | **Pair by capture, then by name, then by role.** Two required slots, "Desktop full page" and "Mobile full page", both preferring tall screenshots. `fillSlots` first picks a desktop and a mobile screenshot whose capture JSON has the same URL, then whose file names share a stem once the size suffix is removed (`site-desktop-1440-full.png` / `site-mobile-390@2x-full.png`), and only then falls back to the first of each role. When the two screens share no section, the inspector says so in one line ("These pages share no sections, so stops are spaced evenly."). No hard block: the user may want two pages on purpose.                                                                                                                                 |
| D5  | Fallback without section data      | **Proportional stops**, the same fractions of each page's scrollable range on both screens: top, ⅓, ⅔ and the bottom, so the shot is never broken. The inspector says "Add the capture's JSON file to stop on sections." `detectSections` stays out of it: it finds different boundaries at 1440 and 390 px, so the two screens would stop on different content, which is what the preset promises not to do.                                                                                                                                                                                                                                                                                                                                                            |
| D6  | Document model                     | **A new layout, `{ kind: "responsive"; desktopId; mobileId }`,** rather than a third `pair` arrangement: the cards, the stacked arrangement and the sizes share nothing with `pair`'s browser and phone. **`ScrollSpec` gains one optional field, `sections?: string[]`**: the section ids to stop at after the top, in page order. `stops` stays and is the fallback (D5). `Shot.scroll` is honoured for `single` and `responsive`. **`AssetRef.meta` gains `sections?: { id: string; top: number }[]`** (top in image px, so a 2× mobile capture is already scaled) and **`page?: string`** (the capture URL, for D4). All three are optional and additive, so `version` stays 2 and no migration runs; `validate.ts` learns to keep them and drops malformed entries. |

Smaller choices this plan makes unless the owner says otherwise:

- **Default stops**: the top plus three sections, chosen so the stops are spread out. Candidates are the sections both pages share, minus `header` and `footer`, whose top the screen can still reach. The next stop is always the candidate farthest from every stop chosen so far, where distance is the larger of the two screens' travel in screen heights. For Aurelia this picks works, materials and monograph, the stops of the preview.
- **Section matching**: by `id`; a section without an id is matched by its tag and class (`section.works-section`). Sections that only one page has are not offered as stops.
- **A stop beyond the end**: a screen whose page can't scroll a section to its top stops at the bottom of the page instead.
- **Duration**: set by the layout, like the slider (`fixedShotDuration`): holds plus moves plus the 0.8 s wrap crossfade overlap. The inspector offers the hold (0.6–1.2 s, quality bar §2.2) and which sections to stop at, not the duration. A shot fits in 30 s: stops past that are left out and the inspector says so.
- **Camera**: still (`fixedShotCamera`), as on the sliders.
- **Name and id**: "Responsive Scroll", `responsive-scroll`. Gallery order: last, after Mobile Scroll Story.

## 4. Tasks

| Task | Title                                                                                        | Size | Depends on       | Status                                                                  |
| ---- | -------------------------------------------------------------------------------------------- | ---- | ---------------- | ----------------------------------------------------------------------- |
| R00  | This plan; decisions recorded in `quality-bar.md` and `contracts.md` once answered           | S    | —                | Done: [#45](https://github.com/jesseleechan/mockup-motion/pull/45)      |
| R01  | Demo section data: `sections-mobile.json` for the five demo sites, `demo:capture` writes it  | S    | —                | In review: [#47](https://github.com/jesseleechan/mockup-motion/pull/47) |
| R02  | Section data on assets: `AssetRef.meta.sections` and `page`, capture JSON import, validation | M    | R00 (D4, D6)     | Not started                                                             |
| R03  | Motion: the `responsive` layout, section stops, shared timing, fallback, duration            | M    | R00 (D3, D5, D6) | Not started                                                             |
| R04  | Rendering: lab fixtures and stills at five aspects                                           | S    | R03              | Not started                                                             |
| R05  | Template, gallery placement, slot pairing, inspector                                         | M    | R02, R03, R04    | Not started                                                             |
| R06  | Previews, contact sheet, owner review, visual baselines (**owner review gate**)              | S    | R05              | Not started                                                             |

R01 needs no decision and runs while the owner answers. R02 and R03 can run side by side once the decisions are in.

### R01: demo section data

- `scripts/demo-capture.ts` records the mobile sections (390 px at 2×) next to the desktop ones and writes `public/demo/<site>/sections-mobile.json` in the same format (`CaptureMetadata`).
- Commit the five files, produced by the same `recordSectionBoundaries` call without recapturing the screenshots (the webp files stay byte-identical).
- Acceptance: a unit test reads every demo site's two JSON files and checks the page heights against `manifest.json` (desktop height × 1, mobile height × 2) and that both share their section ids.

### R02: section data on assets

- `AssetRef.meta.sections` and `meta.page` (D6); `validate.ts` keeps well-formed ones and drops the rest.
- `src/assets/capture-json.ts` (pure): parse a capture JSON, match it to an image (same file stem once `-full` is removed, or `viewportWidth × scale` = image width and `pageHeight × scale` = image height within 2 px), and convert section tops to image px.
- Media import (`MediaTab.tsx`, the stage drop) accepts `.json` next to images. A JSON that matches no image in the drop or the library is reported in one line, never dropped silently.
- The demo asset refs for the full pages carry their sections (`src/lab/demo-assets.ts`).
- Acceptance: unit tests for parsing, matching (both rules, and a mismatch), scaling and validation; an e2e test drops `aurelia` desktop and mobile full pages with their JSON files and reads the sections off the stored assets.

### R03: motion

- `src/motion/layouts/responsive.ts`: card nodes for both screens with the sizes in §1, entrances like `pair`.
- `src/motion/responsive-scroll.ts`: resolve the stops (section ids → per-screen scroll positions, clamped to each page's end; proportional fallback), segment durations (larger travel / 0.9 screens per second), holds, `smooth` easing, and the default stop picker (§3).
- `evaluateNodes` honours `Shot.scroll` for `responsive`; `fixedShotDuration` and `fixedShotCamera` cover it; `sanitizeDoc` keeps its duration in step.
- Acceptance: unit tests that both screens hold the same section at the top at the same time; Aurelia gives top, works, materials, monograph and a 9.4 s shot; no segment beats 0.9 screens per second on average; scroll never decreases within the shot; the fallback gives evenly spaced stops; frame(total) ≡ frame(0) through the wrap; module boundaries hold (no DOM in `src/motion`). Each guarding test is shown failing with the change reverted.

### R04: rendering

- Lab fixtures `responsive-scroll` (Aurelia) and `responsive-scroll-fallback` (no section data).
- Stills from `/lab?still=1` at 1200 px wide, five aspects, at a hold and mid-move, committed under `evidence/R04/` with one sentence each on what was checked: no horizontal crop, colour-exact screens, both screens on the same section during holds, radii and safe margins.

### R05: template

- `src/templates/responsive-scroll.ts`, registry entry last in the gallery order, `toneSwitch`, demo assets (Aurelia full pages), gallery placement (D1), slot pairing (D4).
- Inspector: hold, the section stops as toggles, the D4 and D5 notes.
- e2e: apply the preset with the demo content and see both screens scroll; the gallery shows it in both tabs.
- Shared files (`registry.ts`, `index.ts`, `tests/templates.test.ts`, `scripts/e2e-shards.ts`, `README.md`) get small, additive edits only (three other preset sessions edit them too).

### R06: review and baselines

- `npm run template-previews` for the new preview; `npm run contact-sheet` for Responsive Scroll at all five aspects and three times.
- The owner reviews the contact sheet. Visual baselines for the new stills land only with the owner's written approval of the rendered stills (`tests/visual/README.md`).
- `docs/plan/README.md`, `contracts.md` §8 and `README.md` list the preset.

## 5. Rules for the executor

The fix plan's rules (`docs/fix-plan/README.md` §3) apply: look at every still, prove each guarding test can fail, never weaken a test, no silent fallbacks, no placeholder assets, run every gate, evidence-based status, stay in scope. Evidence goes under `docs/responsive-scroll-plan/evidence/Rxx/`. Branches are named `responsive-scroll/Rxx-<slug>` and commit messages start with `Rxx:`. Merge the latest `main` before each push and keep both sides of any conflict in the shared files.

## 6. Definition of done

- Responsive Scroll is in the gallery, renders at all five aspects, and both screens hold on the same sections at the same time with capture data, and on evenly spaced stops without it.
- The loop is seamless through the wrap crossfade (unit test, and three watched loops with no pop).
- Screens are colour-exact and never cropped horizontally.
- The owner has signed off on the contact sheet and approved the baselines. CI's `unit`, `e2e` and `visual` checks are green.
