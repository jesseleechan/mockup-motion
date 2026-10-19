# Polish plan: first run, the template gallery and the Media library

**Status: in progress.** Written 19 October 2026. The owner approved the editor audit's recommendations the same day ([audit](https://claude.ai/artifact/ANtzprpDcoTPmiCdxH22Db)) and asked for polish sessions. The owner then confirmed this plan's decisions in this session: option A for item 1, the item 3 proposal, and the coordinating session as reviewer and merge-queue owner for the polish PRs. This session covers six items, one PR each. Three other polish sessions cover the stage, transport, timeline and window sizes; the Video and Shot inspectors; and the export dialog.

Rules: `CLAUDE.md` (hard rules, "Tests", definition of done) and `docs/fix-plan/README.md` §3. Each PR carries before and after screenshots of the editor at 1440 × 900 and 1280 × 800, checks the UI overflow guard (`tests/e2e/ui-overflow.spec.ts`), and merges in its turn of the merge queue after the coordinating session's review. Visual stills whose pixels change need the owner's written approval of the rendered diff.

## Items

| #   | Item                                                                                      | Waits for                                | Status                                                       |
| --- | ----------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| 1   | First run: open on something that moves                                                   | Nothing (option A decided)               | [#90](https://github.com/jesseleechan/mockup-motion/pull/90) |
| 2   | Empty-project defaults: the preset look                                                   | Nothing                                  | [#77](https://github.com/jesseleechan/mockup-motion/pull/77) |
| 3   | One gallery: the dialog stays, the Library leads to it                                    | Brand-kit cut (#75), dead-code cut (#66) | Waiting                                                      |
| 4   | Card copy: "Needs 3+ desktop screenshots" instead of "3 slots"                            | Nothing                                  | [#92](https://github.com/jesseleechan/mockup-motion/pull/92) |
| 5   | Scroll Story with demo content uses the full-page capture; "Needs a full-page screenshot" | #92                                      | [#93](https://github.com/jesseleechan/mockup-motion/pull/93) |
| 6   | Media tab: real thumbnails, full name on hover, a Desktop / Mobile role badge             | Brand-kit cut (#75), dead-code cut (#66) | Hook on `polish/media-tab`                                   |

Polish what remains, not what is being deleted: each waiting item starts from a `main` that already has the cuts and presets it depends on. `main` is merged before each push.

## 1. First run

Before, a new visitor landed on an empty stage ("Create a presentation") and had to choose before anything moved ([before](evidence/01-first-run/before-1440.png)).

**Decided: option A, open on the gallery.** The other option was to start on the Desktop Slider demo.

- The editor reopens the most recent saved project on load. The gallery opens only when there is none (a first visit), or when the saved projects can't be read, over the new, empty project. Returning users land on their last project.
- The selected card's preview plays as soon as the gallery opens, and focus starts on it. Other cards play on hover or focus, so only one preview video downloads up front.
- While the selected template is missing screenshots, the footer offers "Choose screenshots" and "Try with demo content" next to "Apply template". "Choose screenshots" applies the template and opens the file picker; the uploads fill it. "Try with demo content" applies the template and fills its empty slots with demo screenshots in one undo step. The close button and Escape cancel.
- Closing the gallery leaves the empty state, whose "Start with a template" opens it again.
- The gallery the editor opened steps aside once the project has content or another project is opened. A gallery the user opened stays until they close it.

## 2. Empty-project defaults

The empty project is built by `createDoc()` with `defaultStyle()`: Bone gradient, soft shadow, 25% grain, 6% vignette, and a "Browser · Push in" shot. A new project takes the preset look instead: Ash solid, no shadow, no grain, no vignette, and a still browser shot whose screen fills with the first screenshot added.

`defaultStyle()` and `createDoc()` stay as they are: the sanitizer and the migration use them to fill gaps in saved projects, and the lab and visual fixtures build on them. A new `newProjectDoc()` is what the editor opens and what "New project" creates. Saved projects are unaffected.

## 3. One gallery

The Library's Templates tab (`LibraryPanel.tsx`) repeats the gallery dialog (`TemplateGalleryModal.tsx`) in a narrow column, and applies on click without the dialog's size hint.

**Decided:** the dialog stays, because it has room for the previews, the Desktop / Mobile tabs, the size hint and Responsive Scroll's two-size card (R05). The Library loses its Templates tab and keeps Media; a "Templates" button in the Library header and the empty state open the dialog. User templates ("Save as template", `UserTemplatesSection`) move into the dialog as a "Yours" tab, shown when there is at least one.

## 4. Card copy

Cards say what they need: "Needs 3+ desktop screenshots", "Needs 4+ mobile screenshots", "Needs a full-page screenshot", and for Responsive Scroll "Needs a desktop and a mobile full-page screenshot". The text comes from the template's slots, so a new preset needs no copy of its own.

## 5. Scroll Story with demo content

"Try with demo content" on Scroll Story takes a hero screenshot, so the page never scrolls. The demo content of Scroll Story and Mobile Scroll Story uses the full-page captures (`public/demo/<site>/desktop-full.webp`, `mobile-full.webp`). When the library has no tall screenshot, the card and the fill overlay say "Needs a full-page screenshot".

## 6. Media tab

Every card shows a generic image icon, so five desktop screenshots look identical (listed in `docs/plan/follow-ups.md`). Cards show the screenshot itself (top-aligned, never cropped horizontally), the full file name on hover, and a role badge the user can switch between Desktop and Mobile (`setAssetRole`).

The thumbnails come from a shared hook, `src/editor/assets/useAssetUrls.ts`, which the Shot inspector's screenshot list (#89) uses too. The change stays on the cards: the "Add: getting screenshots in" session owns the import path (paste and drop, "Use my screenshots").

## Follow-ups

Items found on the way that are out of scope go to `docs/plan/follow-ups.md` and the PR's "Follow-ups" section.
