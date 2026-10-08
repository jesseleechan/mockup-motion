# P05 mutation runs

Each section reverts one guarded change, runs the tests that guard it, and restores the file from git. Every guard failed as expected and passed again after the restore. Run on 8 October 2026 on `presets/P05-review-and-baselines` (Windows, SwiftShader for e2e).

## 1. Gallery order reverted: the presets back at the end of `BUILTIN_TEMPLATES`

Mutated `src/templates/registry.ts` (Quiet Hero first; Mobile Slider, Desktop Slider and Frames last).

`npx vitest run tests/templates.test.ts tests/first-run.test.ts`: FAILED as expected.

```
 FAIL  tests/first-run.test.ts > Presets D1: first-run default > fills Desktop Slider on first run and keeps a project's own template
AssertionError: expected 'quiet-hero' to be 'desktop-slider' // Object.is equality
 FAIL  tests/first-run.test.ts > Presets D1: first-run default > builds a vertical slider of the demo desktop screenshots in one undo step
AssertionError: expected 'quiet-hero' to be 'desktop-slider' // Object.is equality
 FAIL  tests/templates.test.ts > WP-11 & WP-12: Templates, Slot Filling, and Quality Bar > exports all 15 built-in templates with unique IDs, categories, and slots
AssertionError: expected [ 'quiet-hero', …(14) ] to deeply equal [ 'desktop-slider', …(14) ]
      Tests  3 failed | 93 passed (96)
```

`npx playwright test tests/e2e/first-run.spec.ts -g "Presets D1"`: FAILED as expected.

```
  x  1 [chromium] › tests\e2e\first-run.spec.ts:251:1 › Presets D1: the gallery leads with the presets and starts on Desktop Slider
  x  2 [chromium] › tests\e2e\first-run.spec.ts:276:1 › Presets D1: first run → demo content builds Desktop Slider
    Error: expect(received).toEqual(expected) // deep equality
    - Expected  - 3
    + Received  + 3
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 5
    Received: 1
  2 failed
```

(Test 2 waits for the five Desktop Slider screenshots; Quiet Hero's demo adds one.)

## 2. Frames left out of `BUILTIN_TEMPLATES`

Mutated `src/templates/registry.ts` (removed `framesTemplate`).

`npx vitest run tests/templates.test.ts tests/template-previews.test.ts`: FAILED as expected.

```
 FAIL  tests/template-previews.test.ts > F07: template previews > covers all 15 built-in templates
AssertionError: expected [ …(14) ] to have a length of 15 but got 14
 FAIL  tests/templates.test.ts > WP-11 & WP-12: Templates, Slot Filling, and Quality Bar > exports all 15 built-in templates with unique IDs, categories, and slots
AssertionError: expected 14 to be 15 // Object.is equality
 FAIL  tests/templates.test.ts > Template loop seam > covers every looping single-shot template
AssertionError: expected [ 'cascade-stack', …(10) ] to deeply equal [ 'cascade-stack', …(11) ]
      Tests  3 failed | 106 passed (109)
```

## 3. Frames preview at the web bitrate (no size budget)

Replaced `public/templates/frames.webm` with the same render encoded at the web bitrate (889,085 bytes; see `README.md`).

`npx vitest run tests/template-previews.test.ts -t frames`: FAILED as expected.

```
 FAIL  tests/template-previews.test.ts > F07: template previews > frames > has a WebM preview that matches the preview document
AssertionError: expected 889085 to be less than or equal to 460800
      Tests  1 failed | 1 passed | 29 skipped (31)
```

Restored with `git checkout`; `cmp` confirmed the file is byte-identical to the committed one.

## 4. Frames without period travel (rows move at the marquee speed)

Mutated `src/templates/frames.ts` (commented out `travel: "period"`). This checks that the loop-seam test now covers Frames.

`npx vitest run tests/templates.test.ts -t "loop point"`: FAILED as expected.

```
 FAIL  tests/templates.test.ts > Template loop seam > the frame just before the loop point is the first frame
AssertionError: frames 16:9: row0:item6 (demo-aurelia-desktop-hero) at the start: expected undefined to be defined
      Tests  1 failed | 84 skipped (85)
```

## 5. e2e specs that depended on the old default

These failed in the full local e2e run before their fixes, which shows each fix is needed. The run with the fixes passes them (see `README.md`).

| Spec | Failure with Desktop Slider as the default | Fix |
| ---- | ------------------------------------------ | --- |
| `audio.spec.ts:220` and `:289` (MP4) | The helper's 2 s shot is reset to 10 s, because a slider's length follows its screenshots. The loop never wraps in the window; the 1080p MP4 export ran out of time (4.1 min). I stopped that run there, so the WebM variant didn't run. | The short-doc helper gives the shot one browser showing the first screenshot. |
| `export-dialog.spec.ts`, `export.spec.ts` (`useOneSecondDoc`) | Not run before the fix: the same helper pattern (a 1 s shot), so fixed with the others. | Same fix. |
| `library.spec.ts:79` (axe) | `scrollable-region-focusable` (serious): five demo screenshots make the Media list scroll, and the scroll region can't be reached by keyboard. | `MediaTab.tsx`: the list is a focusable, labelled region with a focus ring. |
| `wave5.spec.ts:73` | "Scroll through page" isn't shown: scroll and cursor are single-device controls. | The test applies Quiet Hero first. |
| `stage.spec.ts:228` (test 3) | 22 frames in 2 s on SwiftShader, needs 30. | The playback tests apply Quiet Hero first. Measured below. |

Frames rendered in 2 s of editor playback, two runs each:

| Backend | Desktop Slider | Quiet Hero |
| ------- | -------------- | ---------- |
| Real GPU (Chrome, `--use-angle=d3d11`) | 119, 121 | 120, 121 |
| SwiftShader | 9, 5 | 15, 18 |

The slider plays at 60 fps on a GPU. It costs 2–3× more per frame on the software renderer, which is what the test runs on. `stage.spec` test 3 also passed 3 of 3 on the GPU with Desktop Slider. The 30-frame threshold is unchanged; the test runs on the document it was written for.
