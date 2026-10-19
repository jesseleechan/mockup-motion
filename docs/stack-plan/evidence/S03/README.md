# S03 evidence: Desktop Stack and Mobile Stack templates

Gallery previews from `npm run template-previews -- desktop-stack mobile-stack` (18 October 2026, Linux Chromium 1194 with SwiftShader): 10.0 s loops (5 demo screenshots × 2.0 s), 640 × 360 WebM at 310 kbps (326 KB and 294 KB) and 1280 × 720 posters at 35% (3.5 s). No other template's preview was re-rendered.

| File                        | What I checked                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `poster-desktop-stack.webp` | Maison Oak in front with Aurelia and Studio Kova peeking out below at full colour, the deck centred on Ash; Field Notes has left the frame. |
| `poster-mobile-stack.webp`  | Aurelia in front with Field Notes and Studio Kova peeking out to the right on 7.5% portrait cards; the deck centred.                        |

## Tests

- Unit: `npm test` 42 files, 549 tests passed. New or changed: gallery order and categories (`templates.test.ts`), the loop seam for both Stack presets at all five aspects (the frame just before the loop point draws the same cards as the first), the pair (`template-pairs.test.ts`), the tone switch (`preset-tone.test.ts`), demo sites (`demo-assets.test.ts`), shot labels (`labels.test.ts`) and previews (`template-previews.test.ts`).
- e2e (local, Linux Chromium 1194): `first-run`, `wave5`, `assets`, `thumbnails` and `stack` pass (27 tests). Following the test rules added to CLAUDE.md in #60 (19 October 2026), this PR adds no e2e test for the presets: the stills and the specs that cover every built-in template exercise them, and those specs now read the template count and tab lists from the registry instead of literals.

## Failing when reverted

- The leaving card stays drawn after it leaves the frame: `the frame just before the loop point is the first frame` fails ("desktop-stack 16:9: cards drawn at the loop point: expected 4 to be 3") and so does the deck exit test.
- The Stack pair removed from `pairs.ts`: `pairs Desktop Stack with Mobile Stack (stack plan D5)` fails.
