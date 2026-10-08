# P02: each guarding test fails when its change is reverted

Each change below was reverted on its own, the guarding tests were run, and the file was restored byte for byte. E2E runs used a temporary Playwright config on port 3101 (`tests/e2e/slider.spec.ts`), unit runs `npx vitest run tests/devices.test.ts`. The output is trimmed to the failure.

## 1. Portrait corner radius (`src/engine/devices/card.ts`)

Reverted: `cardCornerRadius` returns `width * 0.016` for every card.

```
1) [chromium] › tests\e2e\slider.spec.ts › a portrait card's corners are rounded at 7.5% of its width
   Error: Expected RGB (223, 225, 227) ±3, received (55.7, 103.3, 202.8)
1 failed
```

```
FAIL tests/devices.test.ts > Portrait cards and slider fades (presets P02) > rounds portrait cards at 7.5% of their width and landscape cards at 1.6%
AssertionError: expected 0.00464 to be close to 0.02175, received difference is 0.01711, but expected 5e-7
Tests  1 failed | 9 passed (10)
```

## 2. Neighbours mixed in sRGB values (`src/engine/Engine.ts`)

Reverted: slider shots use the `linear` blend like entrances.

```
1) [chromium] › tests\e2e\slider.spec.ts › the active slider card is colour-exact and its neighbours are 65% over the background
   Error: Expected RGB (167.75, 98.25, 117.15) ±2, received (174.0, 142.0, 148.0)
2) [chromium] › tests\e2e\slider.spec.ts › a faded neighbour fades as one card: no body slab shows through a black screen
   Error: Expected RGB (78.05, 78.75, 79.45) ±2, received (139.0, 140.0, 142.0)
2 failed
```

## 3. The card fades as one object (`src/engine/devices/card.ts`)

Mutation: a faded card's screen is left out of its layer (`screenMesh.visible = opacity > 0.99`), as when the screen fades on its own and the body slab behind it shows.

```
1) [chromium] › tests\e2e\slider.spec.ts › a faded neighbour fades as one card: no body slab shows through a black screen
   Error: Expected RGB (78.05, 78.75, 79.45) ±2, received (196.0, 196.0, 197.0)
1 failed
```

## 4. Orientation and no horizontal crop (`src/engine/devices/card.ts`, `src/engine/materials/screen.ts`)

Mutation: the card's screen quad rotated upside down.

```
1) [chromium] › tests\e2e\slider.spec.ts › a portrait card shows the whole screenshot width, top row first
   Error: Expected RGB (255, 0, 0) ±3, received (204.0, 230.0, 230.0)
1 failed
```

Mutation: the screen compositor scales the screenshot to cover the viewport, cropping its sides, instead of fitting its width.

```
1) [chromium] › tests\e2e\slider.spec.ts › a portrait card shows the whole screenshot width, top row first
   Error: Expected RGB (255, 0, 0) ±3, received (255.0, 255.0, 255.0)
1 failed
```

The compositor already fitted the width and top-aligned the screenshot (task step 2), so P02 didn't change it. This test now guards it for portrait cards.

## 5. Fade targets allocated with the document (`src/engine/Engine.ts`)

Reverted: `prepare` is told the document needs no sRGB backdrop, so the first faded slider frame creates it. The test puts the slider second, because the warm-up render at t = 0 would otherwise allocate it.

```
1) [chromium] › tests\e2e\slider.spec.ts › slider frames create no GPU objects: the fade targets are allocated with the document
   Error: WebGL objects created while slider cards fade
   -   "framebuffer": 0,
   +   "framebuffer": 1,
   -   "texture": 0,
   +   "texture": 1,
1 failed
```

## 6. GPU resources are disposed (`src/engine/devices/card.ts`, `src/engine/devices/DeviceFade.ts`)

Mutation: the card's body geometry is not disposed.

```
FAIL tests/devices.test.ts > Portrait cards and slider fades (presets P02) > disposes every geometry, material and target of a portrait card
AssertionError: expected [ 'ExtrudeGeometry' ] to deeply equal []
Tests  1 failed | 9 passed (10)
```

Mutation: `DeviceFadePass.dispose()` doesn't dispose the backdrop.

```
FAIL tests/devices.test.ts > Portrait cards and slider fades (presets P02) > allocates the sRGB backdrop only for slider docs and frees it on dispose
AssertionError: expected [ 'backdrop', 'layer' ] to deeply equal [ 'backdrop', 'layer', …(1) ]
Tests  1 failed | 9 passed (10)
```
