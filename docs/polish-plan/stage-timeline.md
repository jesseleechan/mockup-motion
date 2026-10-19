# Polish: stage transport, timeline and smaller windows

Approved by the owner on 19 October 2026 from the editor audit. One pull request per item. Each PR shows the editor at 1440×900, 1280×800 and 1100×760 before and after, and keeps `tests/e2e/ui-overflow.spec.ts` green.

## Order and dependencies

| Item                 | Waits for                                                                                                                           | Status      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 3. Smaller windows   | Nothing (editor shell)                                                                                                              | Merged: #78 |
| 1. One transport bar | The audio cut (#63), which removes "Add music" and the music lane                                                                   | Merged: #79 |
| 2. A slim timeline   | The reels cut (second PR of "Cut: Legacy layouts, laptop/tablet and reels"), which removes Add shot, split, reorder and transitions | Merged: #88 |

## 3. Smaller windows

At 1100 px both side panels keep their full width (280 + 304 px), which leaves the stage about 516 px.

- **Auto-collapse.** Below 1280 px the Library collapses: on load, and when the window shrinks past 1280 px. When it grows back past 1280 px, a Library that collapsed on its own opens again; one the user closed stays closed. The user can still open it at any width.
- **A way back.** A collapsed side panel leaves a slim rail with one button ("Show library", "Show inspector"). Today the only way back is the `[` and `]` shortcuts.
- **Resizable panels.** A handle on each panel's inner edge: drag it, use the arrow keys when it has focus, or double-click it to reset. Library 240–420 px (default 280), Inspector 304–420 px (default 304, the narrowest its selects fit). Both minimums are the narrowest widths at which the overflow guard passes. The stage keeps at least 480 px: a panel never grows past what leaves that, and when the window narrows, panels render narrower without changing the saved width.
- **Remembered per browser.** The widths are a UI preference, kept in `localStorage` (`mockupmotion_panel_widths`), never in the project document.
- The clamping and auto-collapse rules are pure functions in `src/editor/shell/panel-layout.ts`, covered by unit tests. No new e2e test: the overflow guard covers the panels' content.

## 1. One transport bar

The stage bar (`src/editor/transport/TransportBar.tsx`) and the timeline header (`src/editor/timeline/TimelineContainer.tsx`) both have play, timecode, loop and zoom. Keep the stage bar. The timeline header keeps only its zoom. Update the e2e selectors that pointed at the timeline's transport, keeping what they check.

## 2. A slim timeline

Once reels are cut, a single-shot loop does not need a shot card, a ruler and an "Add shot" tile (about 150 px). Replace them with a slim scrubber that shows:

- the loop length;
- the steps where a preset has them: one tick per screenshot for Slider, Stack and Orbit, and the loop point for Frames.

The tick positions come from a pure function of the document, unit-tested against each preset's timing.

## Follow-ups

Noted in each PR and in `docs/plan/follow-ups.md`.
