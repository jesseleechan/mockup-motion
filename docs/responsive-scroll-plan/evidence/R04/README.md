# R04 evidence: Responsive Scroll rendering

Lab fixtures `responsive-scroll` (Aurelia's desktop and mobile full pages with their capture sections) and `responsive-scroll-fallback` (the same pages without sections), in `src/lab/responsive-fixtures.ts`. Stills from `/lab?still=1&fixture=…&aspect=…&t=…&w=1200` (Chromium, SwiftShader), checked by eye.

![contact sheet](contact-sheet.webp)

Rows: 16:9, 4:3, 1:1, 4:5, 9:16. Columns:

1. t = 0.5 s, top hold: both screens show the top of the page (header and hero).
2. t = 2.05 s, mid-move (top → works): both screens between sections, moving together.
3. t = 3.6 s, works hold: both screens have "Selected Works" at the top of the screen.
4. t = 8.45 s, monograph hold: both screens have the "Matter & Silence" monograph section at the top.
5. t = 8.9 s, the wrap crossfade (8.58–9.38 s of the 9.38 s loop): the monograph frame dissolving into the top of the page. This is the loop's seam, inside the last hold.
6. Fallback, t = 3.6 s: no section data, so each screen stops at the same fraction of its own page and they show different sections. That is expected (decision D5).

Checked against `quality-bar.md`:

- §3.1 Fit to width: no screenshot is cropped horizontally; overflow scrolls at the bottom. The screens show the source colours on flat cards (no tint, no faded neighbours).
- §3.4 Cards: hairline border, landscape radius on the desktop card, 7.5% radius on the portrait card.
- §4 Responsive Scroll: side by side at 16:9, 4:3 and 1:1, stacked at 4:5 and 9:16, the pair centred inside the 7% safe margin.
- §5 and §6: Ash background, no shadow, grain 0, vignette 0.
- §2.5: one move (the scroll), still camera, no reversal.

`works-hold_<aspect>.webp` are the column-3 stills at full width.

## Tests

The stills cover the look (CLAUDE.md, Tests: "Visual stills show the look"): R06 adds Linux baselines for the works hold at all five aspects and 16:9 mid-move. An e2e pixel test written for this task (both screens show the page and scroll between t = 0.5 s and 3.6 s; it failed with the `evaluate` scroll wiring removed) was removed on 19 October 2026 under the new rule. The unit tests in `tests/responsive-scroll.test.ts` guard the scroll positions.
