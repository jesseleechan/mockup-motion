# Phone Frames plan: two effects, two sizes

**Status: proposed.** Written 8 October 2026 against the 7-template state of PR #32 (`presets/remove-unused-templates`). Nothing here is implemented yet. Section 2 lists the decisions; the ones marked **Owner** need an answer before the task that depends on them starts.

The owner wants the gallery cut to presets they will actually use. In their words:

> That way we have Desktop Slider and Mobile Slider. Which are the same effects just two different sized screenshots. And then we have Desktop Frames and Phone Frames.

So the end state is two effects, each in a desktop and a mobile size:

| Effect | Desktop                                                          | Mobile                                                           |
| ------ | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Slider | **Desktop Slider** (exists; vertical, landscape cards)           | **Mobile Slider** (exists; horizontal, portrait cards)           |
| Frames | **Desktop Frames** (today's Frames, renamed; rows move sideways) | **Phone Frames** (new; columns of mobile cards move up and down) |

Phone Parade (tilted columns of phone devices) and Portfolio Rows (tilted rows of browser windows) are removed. The owner first wrote "Portfolio Frames" and then confirmed they meant **Portfolio Rows**. Isometric Wall and Scroll Story were not mentioned. They stay unless the owner says otherwise (decision D2).

## 1. What has to be built

**Phone Frames** is Frames turned 90°: flat portrait cards with no device chrome, in columns that each move at one shared speed, with adjacent columns going in opposite directions (one up, the next down). Every column moves exactly one asset period per loop, so the loop is native with a `cut` wrap. It uses the same Ash background, no shadow, grain 0, vignette 0, no tilt and a still camera. The cards are the Mobile Slider's portrait card: phone screen aspect 0.4615 with a 7.5% corner radius (quality bar §3.4).

The engine already has everything except the column version of Frames' loop:

- `rows` (`src/motion/layouts/rows.ts`) has the Frames options from P04: `cardHeight`, `gap` and `travel: "period"`, plus `framesDuration` and `framesAssetIds` (the 0.20 frame heights per second limit and the 30 s cap).
- `columns` (`src/motion/layouts/columns.ts`) moves vertically but hard-codes a tilted `phone` device, its sizes and the `marqueeVelocity` crossfade loop. It has no card, no gap option and no native loop.
- The card device (`src/engine/devices/card.ts`) already rounds a portrait card at 7.5% of its width. A rows or columns node must pass `screenAspect: 0.4615` itself, as the slider does. `screenAspectFor("card", asset)` returns 1.6 for a tall image, which would crop a mobile screenshot to a landscape strip.

### Architecture (decision D5, recommended)

**Recommended: give `columns` the same optional Frames fields that `rows` has (`device`, `cardWidth`, `gap`, `travel`), and move the code for `travel: "period"` into one shared lane function that both layouts call.** The document keeps its two layout kinds. Unset fields render exactly as today.

- `src/motion/layouts/lanes.ts` (new): the period mode for one axis. It covers lane geometry (card size across and along, pitch, lane pitch), the ring, `r / lanes` of a period offsets, alternating directions, the speed `N × pitch / duration`, `lanesAssetIds` (the 30 s cap) and `lanesDuration` (the 0.20 limit, rounded up to 0.5 s).
- `rows.ts` calls it with `axis: "x"` when `travel === "period"`. `framesDuration` and `framesAssetIds` keep their names and signatures but accept a rows **or** columns layout, so the editor and templates need no second helper. `columns.ts` calls the same function with `axis: "y"`.
- The `steps` code paths of both layouts (today's tilted marquees, which saved projects still hold) stay untouched.

Why this and not the alternatives:

- **Not a new `frames` layout kind with `axis: "x" | "y"`** (the slider's model). It reads well, but every saved Frames project holds `{ kind: "rows", travel: "period" }`. A new kind needs a document migration, sanitizer and editor changes, and a re-baseline risk for Desktop Frames, all for no visible gain. The slider got one kind with an axis because it was new; Frames already shipped as `rows`.
- **Not a copy of the period code inside `columns.ts`.** Two copies of the loop maths drift apart. The point of "same effect, two sizes" is that a fix to one fixes the other.
- **Extraction risk.** Moving Desktop Frames onto `lanes.ts` must not change one pixel. PF02 locks it with a golden test: the Frames nodes for N = 4…6, all five aspects and six times, recorded before the refactor and compared exactly after it. The existing `frames-*` Linux baselines must also pass unchanged.

## 2. Decisions

The owner already decided two of them: "remove Phone Parade completely" and Portfolio Rows ("Yes, I meant Portfolio Rows not Portfolio Frames"). In-task design calls follow the owner's standing rule ("pick the recommended option and record why"). Items that change what ships or touch visual baselines are marked **Owner** and need an answer.

| #   | Decision                                                                                                                                   | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Who                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| D1  | Remove Phone Parade and Portfolio Rows                                                                                                     | Yes. Decided by the owner on 8 October 2026.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Decided                                  |
| D2  | Do Isometric Wall and Scroll Story stay?                                                                                                   | **Keep Scroll Story**: it is the only preset for one tall full-page screenshot, and its scroll is opt-in and calm. **Isometric Wall is your call.** It has a known flaw: its loop crossfade blends two camera poses (follow-ups). If you don't use it, PF01 removes it the same way as the other two. If both stay, the gallery has 6 presets.                                                                                                                                                                                                                                                        | **Owner**                                |
| D3  | Name of the new preset                                                                                                                     | **"Mobile Frames"** (`mobile-frames`), so the gallery reads as two matching pairs: Desktop Slider / Mobile Slider, Desktop Frames / Mobile Frames. It also matches the "Mobile" screenshot role in the library. If you prefer your wording, it is "Phone Frames" (`phone-frames`). This plan writes "Phone Frames" and `phone-frames` throughout; they stand for whatever you pick.                                                                                                                                                                                                                   | **Owner**                                |
| D4  | Renaming Frames                                                                                                                            | Display name **"Desktop Frames"**, and the id stays `frames`. Keeping the id means saved projects, the gallery preview files (`public/templates/frames.*`) and the four `frames-*` Linux baselines don't change. Only the gallery card text and the description change.                                                                                                                                                                                                                                                                                                                               | Recommended (ships a rename, so confirm) |
| D5  | Layout model for Phone Frames                                                                                                              | Add the Frames fields to `columns` and share one lane function with `rows` (§1, Architecture).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Recommended                              |
| D6  | Speed limit                                                                                                                                | The same **0.20 stage units per second** as Desktop Frames (`FRAMES_MAX_FRAME_HEIGHTS_PER_SECOND`), measured along the motion axis. For vertical motion that is 0.20 frame heights per second at every aspect. It is calmer, relative to the frame, than Desktop Frames' sideways motion at tall aspects: 0.20 frame heights/s is 0.36 frame widths/s at 9:16. One constant keeps the two sizes the same effect.                                                                                                                                                                                      | Recommended                              |
| D7  | Composition per aspect                                                                                                                     | The table in §3. Mirror Desktop Frames: at 4:5 three columns with the middle one centred and the outer ones cropped by the frame, as the reference crops its outer rows; elsewhere every column is fully visible with about 4.8% side margins, as Desktop Frames' two rows are at 16:9. Same 0.065 gap. Adjust on the contact sheet if a column looks sparse or repeats.                                                                                                                                                                                                                              | Recommended                              |
| D8  | Screenshot counts                                                                                                                          | Slots `mobile1`–`mobile6`, the first 4 required (Frames needs 4: quality bar §4). The 30 s cap at 0.20 per second shows the first 9 (16:9, 4:3, 1:1) or 10 (4:5, 9:16) screenshots. Shot duration is `max(15 s, framesDuration)`, as for Desktop Frames.                                                                                                                                                                                                                                                                                                                                              | Recommended                              |
| D9  | v1 presets that mapped to the removed templates                                                                                            | Drop the three entries from `LEGACY_PRESET_TO_TEMPLATE` (`phone-columns`, `midnight-rows`, `angled-gallery`), so those projects migrate with no template, as PR #32 did for its removed templates. The shots come from the v1 composition either way and keep rendering. Mapping them to Phone Frames or Desktop Frames would highlight a preset whose look the project doesn't have (tilted phones and browsers).                                                                                                                                                                                    | Recommended                              |
| D10 | Deleting the 8 Linux baselines of the removed templates (`phone-parade-*`, `portfolio-rows-*`, plus 4 `isometric-wall-*` if D2 removes it) | Approve the deletion in the PF01 PR. Nothing is re-rendered: the files and their entries in `tests/visual/stills.spec.ts` go. The tilted `rows` (browser) and `columns` (phone) looks keep unit and e2e coverage through lab fixtures; their stills become a follow-up, as PR #32 did for pair and trio.                                                                                                                                                                                                                                                                                              | **Owner** (baselines)                    |
| D11 | New Phone Frames baselines                                                                                                                 | 5 stills: 16:9 and 9:16 at t = 0.8 and 2.4 s, as for Desktop Frames, plus 4:5 at 0.8 s, because only 4:5 crops its outer columns. Written in PF04 after you approve the rendered stills.                                                                                                                                                                                                                                                                                                                                                                                                              | **Owner** (baselines)                    |
| D12 | Gallery order                                                                                                                              | Desktop Slider, Mobile Slider, Desktop Frames, Phone Frames, then Scroll Story (and Isometric Wall if it stays). Desktop Slider stays the first-run default.                                                                                                                                                                                                                                                                                                                                                                                                                                          | Recommended                              |
| D13 | Changing the aspect of a Frames project                                                                                                    | Re-fit the lanes. Today the aspect switcher (`TopBar.tsx`, `ExportModal.tsx`) only sets `doc.aspect`, so a Frames shot keeps the lane count and card size of the aspect it was made at. For Desktop Frames that is a mild mismatch: 2 rows of 0.42 at 9:16 instead of 3 of 0.32. For Phone Frames it is broken: 2 columns made for 9:16 sit in the middle of a 16:9 frame with wide empty sides. PF03 re-fits every Frames shot (`travel: "period"` on rows or columns) to the new aspect's lane count and card size, and re-clamps its duration, in the same undo step. Other layouts are untouched. | Recommended                              |

## 3. Phone Frames composition

Stage units as in `contracts.md` §3: frame height = 1, so a frame is W = width/height wide. Cards are portrait at the phone screen aspect 0.4615 (`h = w / 0.4615`). The gap is 0.065 between cards in a column and between columns, the same as Desktop Frames. Pitch along a column is `h + 0.065`.

| Aspect | W      | Columns | Card w × h    | Across the frame                                                   | Cards per frame height | Max screenshots in 30 s | Duration for N = 4 / 5 / 6 |
| ------ | ------ | ------- | ------------- | ------------------------------------------------------------------ | ---------------------- | ----------------------- | -------------------------- |
| 16:9   | 1.778  | 5       | 0.269 × 0.584 | all visible, 0.085 side margins (4.8% of W)                        | 1.54                   | 9                       | 15 / 16.5 / 19.5 s         |
| 4:3    | 1.333  | 4       | 0.253 × 0.547 | all visible, 0.064 margins                                         | 1.63                   | 9                       | 15 / 15.5 / 18.5 s         |
| 1:1    | 1      | 3       | 0.258 × 0.559 | all visible, 0.048 margins                                         | 1.60                   | 9                       | 15 / 16 / 19 s             |
| 4:5    | 0.8    | 3       | 0.246 × 0.534 | middle column centred, outer columns cropped by 14% of their width | 1.67                   | 10                      | 15 / 15 / 18 s             |
| 9:16   | 0.5625 | 2       | 0.222 × 0.480 | all visible, 0.027 margins                                         | 1.83                   | 10                      | 15 / 15 / 16.5 s           |

How the numbers were chosen:

- **Margins** are 4.8% of the frame width, which mirrors Desktop Frames at 16:9: two rows of 0.42 with a 0.065 gap leave 0.0475 above and below. So `cardWidth = (0.904 W − (columns − 1) × 0.065) / columns`.
- **4:5 crops** its outer columns by 14%, which mirrors the reference's outer rows at 4:5 (`docs/presets-plan/reference.md`, Frames 1-01): `cardWidth = (W − 2 × 0.065) / 2.72`.
- **Column counts** keep the cards between 0.48 and 0.58 frame heights tall, so a column shows 1.5–1.8 cards. That is a little busier than Desktop Frames' 1.4 cards per row window at 4:5, because a phone card is much taller than it is wide. Three columns at 9:16 would make the cards 0.34 tall (about 300 px wide at 1080 × 1920), too small to read. Five columns is quality bar §4's maximum.
- **No repeats.** A column window shows at most 1 + h ≈ 1.6 stage units of cards; four screenshots span at least 4 × 0.545 = 2.18, so no screenshot appears twice in a column at N ≥ 4.
- **Offsets.** Column c starts c / columns of a period along, as Desktop Frames' rows do. Columns that move together never line up the same screenshot. Adjacent columns pass each other in opposite directions and can, for a moment, stack the same screenshot in one row. That is the exception the owner allowed for Desktop Frames in P05, and it applies here too.
- **Direction.** Column 0 (left) moves up, column 1 down, and so on. Up first matches the Desktop Slider's upward step and reads as "scrolling through".

Exact values go into `quality-bar.md` §4 in PF00. If the contact sheet in PF04 shows a column that looks sparse or crowded, adjust the card width by at most ±10%, update §4 and this table in the same PR, and say why.

## 4. Tasks

| Task                                        | Title                                                                                   | Size | Depends on               | Status   |
| ------------------------------------------- | --------------------------------------------------------------------------------------- | ---- | ------------------------ | -------- |
| [PF00](tasks/PF00-decisions-and-rules.md)   | Record the decisions in the quality bar and contracts                                   | S    | Owner answers D2, D3, D4 | Proposed |
| [PF01](tasks/PF01-remove-templates.md)      | Remove Phone Parade and Portfolio Rows (and Isometric Wall if D2 says so)               | M    | PF00, PR #32 merged, D10 | Proposed |
| [PF02](tasks/PF02-lanes-and-columns.md)     | Shared lane function and the columns period mode (motion only)                          | M    | PF00                     | Proposed |
| [PF03](tasks/PF03-phone-frames-template.md) | Phone Frames template, portrait cards in columns, editor, Desktop Frames rename         | M    | PF02                     | Proposed |
| [PF04](tasks/PF04-review-and-baselines.md)  | Gallery order, previews, contact sheet review, visual baselines (**owner review gate**) | S    | PF01, PF03, D11          | Proposed |

PF01 is one lane. PF02 → PF03 is another, and both lanes can run in parallel once PF00 has merged. They share `src/templates/registry.ts`, `src/templates/index.ts`, `src/templates/slots.ts`, `src/templates/demo-preview.ts`, `scripts/template-previews.ts` and `tests/templates.test.ts`. Keep each lane's edits to those files small; whichever lands second rebases. PF04 is where they meet.

## 5. Rules for the executor

The fix plan's rules (`docs/fix-plan/README.md` §3) and the presets plan's additions (`docs/presets-plan/README.md` §5) apply unchanged. In particular:

1. **Look at every still you render** and commit it under `docs/phone-frames-plan/evidence/PFxx/`, with one sentence per image on what you checked.
2. **Prove each guarding test can fail**: revert the change, show the failure in the PR, restore it.
3. **Every aspect.** Check all five aspects on the contact sheet. There is no reference for Phone Frames, so §3 is the reference; Desktop Frames at the same aspect is the comparison to make ("is this the same effect?").
4. **Saved projects keep rendering.** No change may alter a `rows` or `columns` layout whose new fields are unset. The existing baselines that remain (sliders, Frames, Scroll Story, devices, backgrounds) must pass unchanged in every PR.
5. **Branches and commits:** one task per branch and PR, named `phone-frames/PFxx-<slug>`. Commit messages start with `PFxx:`. The owner merges; don't enable auto-merge.
6. **Baselines:** deleting baselines (PF01) and adding them (PF04) both need the owner's written approval, quoted in the PR. PF04 is the only task that writes baselines.
7. **E2E shards:** a new e2e spec goes in the lightest group in `scripts/e2e-shards.ts`; a deleted spec comes out of it.

## 6. Prompt for the executor

```
You are changing the presets of MockupMotion, a local-first web app (React + three.js + Mediabunny)
that turns website screenshots into presentation videos.

Read, in order: CLAUDE.md, docs/fix-plan/README.md §3 ("Rules for the executor"),
docs/presets-plan/README.md §5, docs/phone-frames-plan/README.md (all of it),
docs/presets-plan/reference.md (Frames 1-01), docs/plan/contracts.md, docs/plan/quality-bar.md,
then docs/phone-frames-plan/tasks/PFxx-*.md.

Do task PFxx only. Meet every acceptance criterion. Prove each guarding test fails when you revert
the change. Render and inspect the stills the task asks for and commit them under
docs/phone-frames-plan/evidence/PFxx/. Run all gates (typecheck, lint, test, build, test:e2e) and
report the pass/fail counts. Update the task's status in docs/phone-frames-plan/README.md only
when the evidence exists. Open one PR named "PFxx: <title>" whose description lists every
acceptance criterion with its evidence. Do not merge it.
```

## 7. Definition of done (whole plan)

- The gallery holds Desktop Slider, Mobile Slider, Desktop Frames and Phone Frames first, then the presets D2 keeps. Phone Parade and Portfolio Rows are gone from the source, the gallery, the previews, the demo content and the baselines.
- A saved project with a Phone Parade or Portfolio Rows shot (a tilted `columns` or `rows` layout) still opens, renders and exports. A unit test and an e2e test prove it.
- Phone Frames renders at all five aspects as in §3, and loops natively: frame(0) equals frame(total) in a unit test, and three watched loops show no pop.
- Desktop Frames renders exactly as before the refactor: the golden test passes and the `frames-*` baselines are unchanged.
- Every Phone Frames card shows its mobile screenshot color-exact (ΔE < 1), fitted to width and never cropped horizontally.
- The owner has signed off on the PF04 contact sheet and approved the baseline deletions and additions. CI's `unit`, `e2e` and `visual` jobs are green.

## 8. Suggestions

The owner asked for ideas. These are the ones that serve "presets I'll actually use". None is in the tasks above; each would be its own small task if wanted.

1. **Name the pairs alike (D3).** "Mobile Frames" next to "Mobile Slider" makes the gallery read as two effects in two sizes at a glance.
2. **Pick the size for the user.** When the library holds only mobile screenshots, the gallery could highlight the mobile variant of the effect the user is on (and the desktop one for desktop screenshots). With four presets in two pairs, that removes the most common wrong click: applying Desktop Frames to phone screenshots and getting "Needs 4+ desktop screenshots".
3. **A dark background option for all four.** Ash suits light sites. Many portfolios are dark, and a light grey frame around dark screenshots looks washed out. One more flat palette (a near-black such as Graphite's `#141417` as a solid) selectable on the four presets, with grain and vignette still 0, would cover most work. Today the template sets Ash and the user has to change the background by hand.
4. **Loop length chips for Frames.** Speed follows shot length, so the only speed control is the duration field. Three chips such as "15 s · 20 s · 30 s" (clamped to `framesDuration`) would make "calmer" a single click for both Frames presets.
5. **Watch the loops.** The presets plan still owes quality bar §8's three watched loops of each preset. PF04 does it for all four, so the set you keep has been looked at end to end.
