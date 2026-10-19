# iPhone plan: a realistic phone device

**Status: done.** Written 18 October 2026. One PR. The owner approved the 8 new baselines on 18 October 2026 ("Approved").

The owner reviewed Mobile Scroll Story (PR #48) and asked for a more realistic phone: "We need to use a more realistic model of the iPhone if we go for the phone instead of the flat card." A search for premade assets found no fit: Apple's bezels may only market your own App Store apps and may not be animated, tilted, shadowed or rendered in 3D, and free 3D iPhones are fan-made (CC BY at best, Apple's design either way). The owner chose to rebuild our own phone and, since MockupMotion is for presenting their own work, to make it look exactly like an iPhone: "This is just for my own personal use to show off my work, so let's just go with 1 but make it look exactly like it."

## 1. What changes

The phone is still built from three.js primitives (no downloaded model), now measured from a current iPhone Pro (quality bar §3.3, `src/motion/phone-spec.ts`):

| Part       | Before                                                   | After                                                                                                   |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Body       | Aspect 0.488, 15.5% corners, 0.008 deep                  | Aspect 0.481 (71.9 × 150 mm), concentric corners, 8.75 mm deep (capped at 0.036 stage units)            |
| Border     | 3.2% of the width, all body-coloured metal               | 3.7%: a 1.2% metal frame with an edge highlight and a dark seam, then black glass                       |
| Camera     | A grey pill with two lenses, drawn over the page         | The Dynamic Island: black, 31.3% × 9.2% of the screen width, one lens at its right end                  |
| Status bar | None: the page started at the screen top, under the pill | "9:41", signal, Wi-Fi and battery over the page's top colour, in the iOS tone; the page starts below it |
| Buttons    | Three boxes at arbitrary heights                         | Action button and volume buttons on the left, side button on the right, at the iPhone's positions       |
| Finishes   | The shared device colours                                | Black Titanium, black, Silver and Desert Titanium frame colours                                         |

A screenshot that already has a status bar (`assets/roles.ts` detects it) fills the whole screen and keeps its own bar pinned while scrolling, as before (now 7.1% tall, the real bar, instead of 5.5%). Scroll speed limits are measured against the viewport below the status bar (`scrollableFramesFor`).

This also fixes Mobile Scroll Story decision MS3: the island no longer covers page content, because the page starts below the status bar.

## 2. Effects on other code

- `PHONE_BODY_ASPECT` replaces the four copies of 0.488 in the single, pair, trio and columns layouts. Only phone devices change size; cards keep the 0.4615 screen aspect, so Mobile Slider and both Frames presets are unchanged.
- The lane goldens (PF02) record the tilted phone columns' node sizes, so they were re-recorded with `npx tsx tests/fixtures/record-lane-goldens.ts`. Only the `columnsSteps` group changed; `frames` and `rowsSteps` are byte-identical.
- The status bar's "9:41" is Inter's outline at weight 600 stored as an SVG path (`src/engine/devices/status-bar.ts`), so it needs no font loading and every frame is identical.

## 3. Visual baselines

Eight stills change, all because of the phone: `device-phone-frontal`, `device-phone-tilted`, `orient-phone` and the five `transition-*` stills (their scene has a phone over a browser). The other 48 are unchanged. The owner approved the rendered stills (`evidence/baselines-before-after.png`) in writing on 18 October 2026, and they are committed as the Visual baselines workflow wrote them.

## 4. After review

- A scrolled page drew over the status bar: the screen target has no depth buffer and three.js draws opaque meshes front to back. The bar now has a higher `renderOrder`, and `tests/e2e/color.spec.ts` checks its colour at the end of a scroll (it failed before the fix).
- `thumbnails.spec.ts` "a card plays its preview on hover…" failed twice on this PR's CI with the Desktop Frames preview still paused after a fixed 10 s wait, while the same code passed on #48. The owner chose the recommendation: the first wait now scales with `ciTimeout` like the test's next one, and a rejected `play()` fails the test with its error instead of a timeout.

## 5. Evidence

`evidence/`: before and after at 16:9 for the frontal and tilted phone, the F01 orientation quadrants, the browser-and-phone pair and the tilted phone columns.
