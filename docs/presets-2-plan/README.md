# Presets plan, round two: Site Tour, Before & After, Page Columns, Responsive Tour

**Status: not started.** Written 26 October 2026.

On 26 October 2026 the owner reviewed a second shortlist with live previews ([shortlist](https://claude.ai/artifact/DEJpVekBeyHm97wU2SxhDU)). They chose four of the five proposals and skipped Filmstrip, and left every open question to the coordinator's recommendation ("Your recommendations"). The decisions below are those recommendations. Each preset is built in its own session. CLAUDE.md and fix plan §3 apply to every task.

| Preset                                             | What it does                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Desktop Site Tour · Mobile Site Tour**           | Pages of one site in a browser or a phone. Every step slides in the next page.                          |
| **Desktop Before & After · Mobile Before & After** | The new design sweeps across the old one, then holds. For redesigns.                                    |
| **Desktop Page Columns · Mobile Page Columns**     | Full pages side by side, drifting slowly through their whole length, neighbours in opposite directions. |
| **Responsive Tour**                                | Each page in desktop and mobile. Every step moves both to the next page.                                |

They fill three gaps in the gallery: several pages never appear in a browser or a phone, there is no way to show a redesign, and full-page captures only ever show one page at a time.

## 1. Decisions

D1 and D2 are the owner's (26 October 2026). D3–D15 are the coordinator's recommendations, which the owner accepted in advance; each was previewed on the shortlist.

| #   | Decision               | Decided                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | What to build          | Site Tour (desktop and mobile), Before & After (desktop and mobile), Page Columns (desktop and mobile) and Responsive Tour.                                                                                                                                                                                    |
| D2  | Filmstrip              | Not built: Frames already covers continuous motion.                                                                                                                                                                                                                                                            |
| D3  | Site Tour's step       | The next page slides in from the right as the current one leaves to the left, both clipped to the screen, on the sliders' step: 2.0 s per page, a 1.85 s move on `slide`, then a hold. N pages make a native N × 2.0 s loop with a cut wrap.                                                                   |
| D4  | Site Tour's URL        | One URL for the whole tour: the document's `browserUrl`, as today. A URL per page is a follow-up.                                                                                                                                                                                                              |
| D5  | Site Tour's look       | The browser at Scroll Story's size and the phone at Mobile Scroll Story's size (quality bar §4), Scroll Story's soft device shadow, Ash or Onyx through the Light/Dark switch, still camera. 3–6 screenshots of one size in Library order; the first 3 are required. A full page shows its top (fit to width). |
| D6  | Before & After labels  | A "Before" and an "After" label inside the screen, bottom right and bottom left, each clipped with its layer, set in Inter with the URL pill's rasterizer (`src/text/rasterize.ts`). Moved from the top corners after the T2 contact-sheet review: there they covered the site's logo.                         |
| D7  | Before & After divider | A plain white line with a soft shadow, no handle.                                                                                                                                                                                                                                                              |
| D8  | Before & After timing  | Left to right in both sizes. 1.0 s on the old design, a 2.0 s sweep on `smooth`, a hold on the new design, then the 0.8 s wrap crossfade back to the old one: 6.0 s at the Default pace. The sweep never reverses. Two screenshots of one size; the first in Library order is the old design.                  |
| D9  | Page Columns' motion   | Each column drifts through its page at a constant speed, neighbours in opposite directions (the middle column moves down), then the 0.8 s wrap crossfade.                                                                                                                                                      |
| D10 | Page Columns' speed    | At most 0.5 column heights per second, calmer than a scroll's 0.9 because it never stops. The loop is the shortest of 12–30 s at which the longest page keeps to that. Past 30 s, every column travels only as far as 0.5 column heights per second allows.                                                    |
| D11 | Page Columns' layout   | Mobile: 3 columns at 16:9, 4:3 and 1:1, 2 at 4:5 and 9:16. Desktop: 3 at 16:9 and 4:3, 2 at 1:1, 1 at 4:5 and 9:16, changed after the contact-sheet review because narrow columns left the pages static. Frameless cards, Ash or Onyx, no shadow. It says "Needs 2+ full-page screenshots" (one size).         |
| D12 | Responsive Tour's look | Frameless cards in Responsive Scroll's geometry (`src/motion/layouts/responsive.ts`). The mobile screen moves in step with the desktop one. Pages pair by order: the i-th desktop screenshot with the i-th mobile one. 3–5 pairs; the first 3 are required.                                                    |
| D13 | Pace                   | All four follow the Pace control: Calm, Default and Brisk set the tours' step (2.4, 2.0 and 1.6 s), and scale Before & After's timeline and Page Columns' loop by 1.2, 1 and 0.8, within their limits.                                                                                                         |
| D14 | Demo content           | Real demo pages, not stand-ins: Aurelia gets three more pages in both sizes for the tours, and an earlier design of its home page for Before & After. Existing captures don't change, so no current still changes.                                                                                             |
| D15 | Gallery order          | After the Orbit pair: the Site Tour, Before & After and Page Columns pairs, each desktop first, then the Scroll Story pair, Responsive Scroll and Responsive Tour. Desktop Slider stays first and the first-run default.                                                                                       |

Names and ids: `desktop-site-tour` "Desktop Site Tour", `mobile-site-tour` "Mobile Site Tour", `desktop-before-after` "Desktop Before & After", `mobile-before-after` "Mobile Before & After", `desktop-page-columns` "Desktop Page Columns", `mobile-page-columns` "Mobile Page Columns", `responsive-tour` "Responsive Tour". Gallery lines are the shortlist's.

## 2. Architecture

Each task chooses its own types, within these lines:

- **New layout kinds,** as Orbit added `orbit` (orbit plan §3): one for the tours' stepping screen, one for Before & After, one for Page Columns, one for Responsive Tour, unless a task finds an existing kind it can extend without changing what that kind does today. `contracts.md` §2 and §4 record each one.
- **A screen that draws two screenshots** (T1). During a step, Site Tour's screen draws the leaving page and the arriving one, each offset and clipped to the screen. Build it so Before & After (T2) can draw two screenshots split at a moving edge, and Responsive Tour (T4) can use it on frameless cards. T1 documents it for T2 and T4.
- **The tours are stepped shots:** they share the sliders' stepped rules through `isSteppedLayout` (duration N × step, still camera, no Camera section, the screenshot list).
- **Page Columns needs cards that scroll their own page.** Scroll only reaches `single` and `responsive` shots today.
- **Saved projects:** nothing to migrate; the layouts are new.

## 3. Tasks

| Task | Title                                                                    | Size | Depends on          | Status           |
| ---- | ------------------------------------------------------------------------ | ---- | ------------------- | ---------------- |
| T0   | Demo pages: Aurelia's extra pages in both sizes and an earlier home page | S–M  | —                   | Done (#118)      |
| T1   | Desktop and Mobile Site Tour, with the two-screenshot screen             | M–L  | T0 for demo content | In review (#119) |
| T2   | Desktop and Mobile Before & After                                        | M    | T1 (screen), T0     | In review (#121) |
| T3   | Desktop and Mobile Page Columns                                          | M    | —                   | In review (#117) |
| T4   | Responsive Tour                                                          | M    | T1 (screen), T0     | Not started      |

T1 is in review in [#119](https://github.com/jesseleechan/mockup-motion/pull/119), with its stills and contact sheet in [`evidence/T1`](evidence/T1). The owner approved its stills on 26 October 2026, and their baselines are committed.

T2 is in review in [#121](https://github.com/jesseleechan/mockup-motion/pull/121), with its stills and contact sheet in [`evidence/T2`](evidence/T2). The owner approved its stills on 26 October 2026, and their baselines are committed.

T0, T1 and T3 start together. T1 merges after T0, so its demo content uses T0's pages. T2 and T4 start once T1 has merged.

**T0.** Add pages to the Aurelia demo site in `demo-sites/` (for example Works, Journal and Contact), in the site's own design, and an earlier design of its home page (same content, an older style a designer would plausibly have replaced). Capture them in both sizes with `npm run demo:capture`, with section data, and add them to `public/demo` and the demo asset API (`src/lab/demo-assets.ts`) so a template can ask for a page by name. Existing files and their bytes stay as they are; `npm run test:visual` passes unchanged. Fonts and images stay self-hosted, and `public/demo/CREDITS.md` covers anything new.

**Every preset task (T1–T4):**

- The decisions above; the numbers go into quality bar §4 and `contracts.md` once the contact sheet is approved.
- Templates with slots, `missingRequiredSlots` messages, demo content (`src/templates/demo-preview.ts`), gallery order (D15), the size pairs in `pairs.ts`, and editor support: the screenshot list, Pace, and any Layout controls a stepped shot already shows.
- Lab fixtures, visual stills at every aspect where the look differs, gallery previews (`npm run template-previews`, only the new templates), and the contact sheet (`npm run contact-sheet`) in the PR.
- Unit tests for the motion (native loop: frame(total) equals frame(0) for the stepped presets; the wrap for the others; no reversal), the geometry per aspect, the slots and saved documents. No e2e test (CLAUDE.md § Tests: a new preset adds none).
- **Owner review gate:** the contact sheet and the new stills go to the owner before any baseline is committed. Baselines come from the Visual baselines workflow (`tests/visual/README.md`).
- Status: this table, `docs/plan/README.md`, and follow-ups in `docs/plan/follow-ups.md`.

## 4. Rules for the executor

The fix plan's rules (`docs/fix-plan/README.md` §3) apply unchanged: look at every still you render, prove each guarding test can fail, never weaken a test, no silent fallbacks, no placeholder assets, run every gate, evidence-based status, stay in scope. The shortlist's previews are the reference for each preset's look and timing: match them, then judge them on the contact sheet at all five aspects, and say in the PR where you changed a number and why.
