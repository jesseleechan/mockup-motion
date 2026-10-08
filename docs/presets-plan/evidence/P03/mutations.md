# P03: each guarding test fails when its change is reverted

Each change below was reverted on its own, the guarding tests were run, and the file was restored byte for byte. Unit runs use `npx vitest run`; e2e runs use `tests/e2e/slider.spec.ts` through a temporary Playwright config on a spare port. Output is trimmed to the failure.

## Templates

**Registered.** Mobile Slider and Desktop Slider removed from `BUILTIN_TEMPLATES`.

```
AssertionError: expected [ 'quiet-hero', …(11) ] to include 'mobile-slider'
AssertionError: expected 12 to be 14 // Object.is equality
Tests  3 failed | 81 passed (84)
```

**Duration = N × step.** `slider-template.ts` sets `shot.duration = 8`.

```
AssertionError: mobile-slider 16:9 N=3: expected 8 to be 6 // Object.is equality
```

**Native loop, no wrap crossfade.** The template's `transitionIn` is an 0.8 s fade instead of a cut.

```
AssertionError: mobile-slider 16:9 N=3: expected 'fade' to be 'cut' // Object.is equality
```

**No repeated screenshot.** The template keeps `fillSlots`' repeats instead of deduping.

```
AssertionError: mobile-slider 16:9 N=3: expected { kind: 'slider', …(4) } to deeply equal { kind: 'slider', …(4) }
AssertionError: expected [ 'mobile-0', 'mobile-1', …(4) ] to deeply equal [ 'mobile-0', 'mobile-1', 'mobile-2' ]
```

**Loop seam (`tests/templates.test.ts`).** Before the slider comparison existed, the existing seam test compared slider frames node by node and failed. A slider's ring holds more cards than screenshots, so after one loop a different ring card with the same screenshot sits in each slot:

```
AssertionError: mobile-slider 16:9: slider:0 opacity: expected +0 to be close to 1
```

The new `expectSameSliderCards` matches every drawn card by screenshot, size, place, scale and opacity in both directions, and passes.

## The 30 s rule (`src/motion/layouts/duration.ts`)

**Step limit.** `sliderStepMax` always returns 4.0.

```
AssertionError: expected 4 to be 2 // Object.is equality
Tests  3 failed | 11 passed (14)
```

**18 screenshots at most.** `sliderAssetIds` returns every screenshot.

```
AssertionError: expected [ 'mobile-0', 'mobile-1', …(17) ] to deeply equal [ 'mobile-0', 'mobile-1', …(16) ]
AssertionError: expected 30.400000000000002 to be close to 28.8, received difference is 1.6000000000000014
```

**`sanitizeDoc` sets a slider's length.** The validator keeps the stored duration.

```
AssertionError: expected 12 to be 30 // Object.is equality
```

## Editor store (`src/state/store.ts`)

**Every edit keeps a slider loop-safe.** `fitSliderShots` removed from `apply`.

```
AssertionError: expected 8 to be 12 // Object.is equality
AssertionError: expected 8 to be 10 // Object.is equality
Tests  4 failed | 10 passed (14)
```

```
1) [chromium] › tests\e2e\slider.spec.ts › slider editing › changing the step length sets the shot length, and undo restores both
   Error: expect(received).toBe(expected) // Object.is equality
   Expected: 15
   Received: 10
```

**A hand-set duration leaves no undo step.** The early return in `setShotDuration` removed.

```
AssertionError: expected [ { version: 2, …(10) } ] to have a length of +0 but got 1
```

**A screenshot dropped on a card is added.** The slider branch of `assignAssetToSlot` doesn't insert.

```
AssertionError: expected [ 'mobile-0', 'mobile-1', …(2) ] to deeply equal [ 'mobile-0', 'mobile-1', …(3) ]
```

**Add from the Media tab.** `addAssetToShot` doesn't push the screenshot.

```
1) [chromium] › tests\e2e\slider.spec.ts › slider editing › a screenshot added from the Media tab joins the slider and adds one step
   Error: expect(received).toEqual(expected) // deep equality
   -   "002a4a79-9b28-446c-9e29-36c211db7749",
```

## Editor UI

**The duration control is read-only for a slider.** `disabled={fixed}` removed from the Duration slider.

```
1) [chromium] › tests\e2e\slider.spec.ts › slider editing › changing the step length sets the shot length, and undo restores both
   Error: expect(locator).toHaveAttribute(expected) failed
   Locator:  getByRole('slider', { name: 'Duration' })
   Expected: ""
   - unexpected value "null"
```

## User templates (`src/storage/user-templates.ts`)

**Slider screenshots are saved as slots.** The `slider` case removed from `convertDocToUserTemplate`.

```
AssertionError: expected [ 'mobile-0', 'mobile-1', …(2) ] to deeply equal [ 'slot:mobile:0', …(3) ]
```
