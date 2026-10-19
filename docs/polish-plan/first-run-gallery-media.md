# Polish plan: first run, the template gallery and the Media library

**Status: in progress.** Written 19 October 2026. The owner approved the editor audit's recommendations the same day ([audit](https://claude.ai/artifact/ANtzprpDcoTPmiCdxH22Db)) and asked for polish sessions. This session covers six items, one PR each. Three other polish sessions cover the stage, transport, timeline and window sizes; the Video and Shot inspectors; and the export dialog.

Rules: `CLAUDE.md` (hard rules, "Tests", definition of done) and `docs/fix-plan/README.md` §3. Each PR carries before and after screenshots of the editor at 1440 × 900 and 1280 × 800, checks the UI overflow guard (`tests/e2e/ui-overflow.spec.ts`), and merges only after the owner's go-ahead on those screenshots. Visual stills whose pixels change need the owner's written approval of the rendered diff.

## Items

| #   | Item                                                                                      | Waits for                                            | Status   |
| --- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------- |
| 1   | First run: open on something that moves                                                   | The owner's choice between options A and B (below)   | Proposed |
| 2   | Empty-project defaults: the preset look                                                   | Nothing                                              | Building |
| 3   | One gallery: the dialog stays, the Library leads to it                                    | #48, Responsive Scroll (#52–#59), brand-kit cut, #66 | Waiting  |
| 4   | Card copy: "Needs 3+ desktop screenshots" instead of "3 slots"                            | #48, Responsive Scroll (#52–#59)                     | Waiting  |
| 5   | Scroll Story with demo content uses the full-page capture; "Needs a full-page screenshot" | #48, Responsive Scroll (#52–#59)                     | Waiting  |
| 6   | Media tab: real thumbnails, full name on hover, a Desktop / Mobile role badge             | Brand-kit cut, #66                                   | Waiting  |

Polish what remains, not what is being deleted: each waiting item starts from a `main` that already has the cuts and presets it depends on. `main` is merged before each push.

## 1. First run

Today a new visitor lands on an empty stage ("Create a presentation") and has to choose before anything moves.

- **Option A (recommended): open on the gallery.** The template gallery opens over the empty project with its previews playing. Its footer offers "Try with demo content", which applies the selected preset with the demo screenshots, and "Choose screenshots". Closing it leaves today's empty state. It opens only when there is no saved project, so returning users land on their last project.
- **Option B: start on Desktop Slider with the demo.** A new visitor lands on the Desktop Slider demo, already playing. The Library and the gallery offer the other presets. The demo stays until the user adds screenshots (the "Use my screenshots" follow-up).

The owner picks one from screenshots of both before anything is built.

## 2. Empty-project defaults

The empty project is built by `createDoc()` with `defaultStyle()`: Bone gradient, soft shadow, 25% grain, 6% vignette, and a "Browser · Push in" shot. A new project takes the preset look instead: Ash solid, no shadow, no grain, no vignette, and a still browser shot whose screen fills with the first screenshot added.

`defaultStyle()` and `createDoc()` stay as they are: the sanitizer and the migration use them to fill gaps in saved projects, and the lab and visual fixtures build on them. A new `newProjectDoc()` is what the editor opens and what "New project" creates. Saved projects are unaffected.

## 3. One gallery

The Library's Templates tab (`LibraryPanel.tsx`) repeats the gallery dialog (`TemplateGalleryModal.tsx`) in a narrow column, and applies on click without the dialog's size hint.

Proposal: the dialog stays, because it has room for the previews, the Desktop / Mobile tabs, the size hint and Responsive Scroll's two-size card (R05). The Library loses its Templates tab and keeps Media; a "Templates" button in the Library header and the empty state open the dialog. User templates ("Save as template", `UserTemplatesSection`) move into the dialog as a "Yours" tab, shown when there is at least one. The owner confirms before it is built.

## 4. Card copy

Cards say what they need: "Needs 3+ desktop screenshots", "Needs 4+ mobile screenshots", "Needs a full-page screenshot", and for Responsive Scroll "Needs a desktop and a mobile full-page screenshot". The text comes from the template's slots, so a new preset needs no copy of its own.

## 5. Scroll Story with demo content

"Try with demo content" on Scroll Story takes a hero screenshot, so the page never scrolls. The demo content of Scroll Story and Mobile Scroll Story uses the full-page captures (`public/demo/<site>/desktop-full.webp`, `mobile-full.webp`). When the library has no tall screenshot, the card and the fill overlay say "Needs a full-page screenshot".

## 6. Media tab

Every card shows a generic image icon, so five desktop screenshots look identical (listed in `docs/plan/follow-ups.md`). Cards show the screenshot itself (top-aligned, never cropped horizontally), the full file name on hover, and a role badge the user can switch between Desktop and Mobile (`setAssetRole`).

## Follow-ups

Items found on the way that are out of scope go to `docs/plan/follow-ups.md` and the PR's "Follow-ups" section.
