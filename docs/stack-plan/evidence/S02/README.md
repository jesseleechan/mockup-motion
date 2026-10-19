# S02 evidence: deck rendering

Stills rendered on 18 October 2026 through the lab's export path (`exportFrames`, the same frames an export writes) at 1200 px wide, Playwright Chromium 1194 with SwiftShader on Linux, stored as lossless WebP. `deck-y` is the `slider-y` fixture (four demo desktop heroes: Aurelia, Northwind, Maison Oak, Field Notes) with `arrangement: "deck"`; `deck-x` is `slider-x` (the same sites' mobile heroes) the same way. Both are Ash with no shadow, grain or vignette; `-dark` is Onyx. With 4 screenshots the deck shows 3 cards at rest. `t0` is the rest pose; `t1` is 1.0 s into the first step (progress 0.62 on `slide`).

| File                                                   | What I checked                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deck-y_16x9_t0.webp`                                  | Front card 0.645 tall (the 0.8 deck-height cap binds), two cards peeking below at 0.94 and 0.88 scale, full colour; the deck is centred. The front card spans 58% of the frame width, under the 62–74% a single desktop device gets at 16:9 (§4): a candidate for tuning on the S04 contact sheet. |
| `deck-y_16x9_t1.webp`                                  | The front card is most of the way out of the top edge; Northwind moves into front and the next cards move up and grow; the entering card shows faintly at the bottom. Nothing is cropped sideways.                                                                                                 |
| `deck-y_9x16_t0.webp`                                  | Front card 0.84 of the frame width; peeks below; the deck sits in the middle with wide margins above and below.                                                                                                                                                                                    |
| `deck-y_9x16_t1.webp`                                  | The leaving card crosses the top edge while the deck steps up; one dominant move.                                                                                                                                                                                                                  |
| `deck-y_1x1_t0.webp`                                   | Front card 0.84 of the width, deck centred, 7% margins hold.                                                                                                                                                                                                                                       |
| `deck-y_1x1_t1.webp`                                   | Mid-step, as at 16:9.                                                                                                                                                                                                                                                                              |
| `deck-y_4x5_t0.webp`                                   | Front card 0.672 × 0.42, as the preview; peeks below.                                                                                                                                                                                                                                              |
| `deck-y_4x5_t1.webp`                                   | Mid-step; the leaving card's bottom edge passes the next card's top.                                                                                                                                                                                                                               |
| `deck-y_4x3_t0.webp`                                   | Front card 0.645 tall, 77% of the frame width; deck centred.                                                                                                                                                                                                                                       |
| `deck-y_4x3_t1.webp`                                   | Mid-step.                                                                                                                                                                                                                                                                                          |
| `deck-x_16x9_t0.webp`                                  | Mobile cards 0.70 tall at the phone aspect with 7.5% corners; two cards peek out to the right at full colour; the deck is centred.                                                                                                                                                                 |
| `deck-x_16x9_t1.webp`                                  | The front card is leaving left; the deck moves left; the entering card fades in on the right.                                                                                                                                                                                                      |
| `deck-x_9x16_t0.webp`                                  | Front card 0.323 wide (57% of the frame width), peeks right; the deck fills the width within the margins.                                                                                                                                                                                          |
| `deck-x_9x16_t1.webp`                                  | The leaving card is past the left edge; no screenshot repeats.                                                                                                                                                                                                                                     |
| `deck-x_1x1_t0.webp`                                   | As at 16:9, larger in the frame.                                                                                                                                                                                                                                                                   |
| `deck-x_1x1_t1.webp`                                   | Mid-step.                                                                                                                                                                                                                                                                                          |
| `deck-x_4x5_t0.webp`                                   | As the preview: 0.323 × 0.70 front card and two peeks.                                                                                                                                                                                                                                             |
| `deck-x_4x5_t1.webp`                                   | Mid-step.                                                                                                                                                                                                                                                                                          |
| `deck-x_4x3_t0.webp`                                   | Deck centred, margins hold.                                                                                                                                                                                                                                                                        |
| `deck-x_4x3_t1.webp`                                   | Mid-step.                                                                                                                                                                                                                                                                                          |
| `deck-y-dark_16x9_t0.webp`, `deck-y-dark_16x9_t1.webp` | Onyx: the white 8% hairline keeps the near-black Aurelia and Northwind cards' edges visible.                                                                                                                                                                                                       |
| `deck-x-dark_16x9_t0.webp`, `deck-x-dark_16x9_t1.webp` | The same for mobile cards.                                                                                                                                                                                                                                                                         |

## Colour and order (`tests/e2e/stack.spec.ts`)

Flat-colour screenshots in a 4:5 deck: the front card's centre (where the two cards behind overlap it) and the strips the two back cards show are each within ΔE 1 of their source colour, and the entering card at 1.0 s is within ΔE 2 of a linear-light mix at its opacity over Ash. Each test fails when its fix is reverted:

```
### no z offset between slots
  ✘  1 [chromium] › tests/e2e/stack.spec.ts:138:1 › every settled deck card is colour-exact, and the front card covers the ones behind (14.0s)
  ✓  2 [chromium] › tests/e2e/stack.spec.ts:157:1 › the card entering the deck fades in linear light, like an entrance (15.1s)
  1) [chromium] › tests/e2e/stack.spec.ts:138:1 › every settled deck card is colour-exact, and the front card covers the ones behind
    Error: front 40.0,140.0,90.0
    Expected: < 1
    Received:   45.157097188675394
  1 failed
    [chromium] › tests/e2e/stack.spec.ts:138:1 › every settled deck card is colour-exact, and the front card covers the ones behind
  1 passed (32.1s)
### deck fades in sRGB like the carousel
  ✓  1 [chromium] › tests/e2e/stack.spec.ts:138:1 › every settled deck card is colour-exact, and the front card covers the ones behind (13.2s)
  ✘  2 [chromium] › tests/e2e/stack.spec.ts:157:1 › the card entering the deck fades in linear light, like an entrance (14.1s)
  1) [chromium] › tests/e2e/stack.spec.ts:157:1 › the card entering the deck fades in linear light, like an entrance
    Error: entering 45.0,45.0,49.0 vs 87.8,88.7,90.3
    Expected: < 2
    Received:   14.544977003392512
  1 failed
    [chromium] › tests/e2e/stack.spec.ts:157:1 › the card entering the deck fades in linear light, like an entrance
  1 passed (29.6s)
### back to front order reversed
  ✘  1 [chromium] › tests/e2e/stack.spec.ts:138:1 › every settled deck card is colour-exact, and the front card covers the ones behind (13.4s)
  ✓  2 [chromium] › tests/e2e/stack.spec.ts:157:1 › the card entering the deck fades in linear light, like an entrance (14.5s)
  1) [chromium] › tests/e2e/stack.spec.ts:138:1 › every settled deck card is colour-exact, and the front card covers the ones behind
    Error: front 40.0,140.0,90.0
    Expected: < 1
    Received:   45.157097188675394
  1 failed
    [chromium] › tests/e2e/stack.spec.ts:138:1 › every settled deck card is colour-exact, and the front card covers the ones behind
  1 passed (31.2s)
```
