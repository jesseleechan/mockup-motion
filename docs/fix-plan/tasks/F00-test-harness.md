# F00: Test harness that can't lie

**Size:** M · **Depends on:** none · **Blocks:** everything

## Why

The Playwright suite cannot launch in cloud sessions. Several tests pass no matter what the app renders, and scripts swallow errors. Every later fix relies on pixel-level tests, so the harness has to come first.

## Evidence (current state)

- `npx playwright test` fails at launch: `Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/…`. `@playwright/test@1.63` expects Chromium 1243, but the cloud image has 1194.
- `tests/e2e/spike.spec.ts:63`: `maxChannelDiff = Math.max(maxChannelDiff, 0)`. The value is always 0, so the colour test can never fail.
- `tests/e2e/devices.spec.ts:47-96` ("width-fit") renders a test pattern and returns `true` without reading any pixels.
- `tests/e2e/spike.spec.ts` "Spike 2" times `renderAt` without a GPU sync. That measures command submission, not rendering.
- `tests/visual/stills.spec.ts:50-58` returns early, and passes, when no baseline exists. No baselines are committed.
- `scripts/template-previews.ts` uses `.catch(() => {})` and writes "fallback" posters.

## Required changes

1. **Playwright launch** (`playwright.config.ts`)
   - If `process.env.PW_CHROMIUM_EXECUTABLE` is set, pass it as `launchOptions.executablePath` for every project. Keep the existing `PLAYWRIGHT_BROWSERS_PATH` logic.
   - Add `args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]` to the `chromium` and `visual` projects, so WebGL works the same headless on every machine. Merge with any existing args.
   - Document both in `CLAUDE.md` → Commands:
     - Locally: `npx playwright install chromium`.
     - Cloud session with a mismatched browser: `PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:e2e`.
2. **Pixel helpers** (`tests/helpers/pixels.ts`, used inside `page.evaluate` through `/lab` hooks):
   - `renderAndRead(t)`: calls `window.__labEngine.renderAt(t)` and returns `{ width, height, data }` from `engine.readPixels()` in the same task, so `preserveDrawingBuffer` doesn't matter.
   - `avgRegion(px, x0, y0, x1, y1)` returns the mean RGB of a rectangle.
   - `expectRgbNear(actual, expected, tol)` gives a readable failure message with both values.
   - `inkBounds(px, background, threshold)` returns the bounding box of pixels that differ from the background.
3. **Test images** (`src/lab/test-images.ts`, dev only, exposed as `window.__labTestImages`). Each returns an `ImageBitmap`:
   - `quadrants(w, h)`: top-left `#FF0000`, top-right `#00FF00`, bottom-left `#0000FF`, bottom-right `#FFFF00`.
   - `bands(w, h, colors[])`: horizontal flat bands, top to bottom.
   - `edgeColumns(w, h)`: white fill with 4 px `#FF00FF` columns at the left and right edges.
4. **Lab hook** (`src/lab/LabPage.tsx`): `window.__labSetDoc(doc, images?: Record<string, ImageBitmap>)` calls `engine.setDocument` with a provider that serves `images[id]` and falls back to the normal lab provider. Return a promise that resolves after the first render. Every pixel test must go through this hook, not a hand-rolled provider.
5. **Replace the fake tests**
   - Delete "Spike 1: Color exactness" from `spike.spec.ts`. F02 adds the real colour tests.
   - Rewrite "width-fit" in `devices.spec.ts`: use `edgeColumns(1600, 1000)` in a frontal static browser shot, read pixels, find the screen rectangle (inkBounds against the background), and assert that magenta pixels exist within 6 px of both the left and right edges of the screen.
   - "Spike 2" performance: render 60 frames, then call `engine.readPixels()` once to force GPU completion before stopping the clock. Move the test to the `perf` project (non-gating; SwiftShader numbers are not representative).
   - `tests/visual/stills.spec.ts`: a missing baseline is a **failure**. Remove the annotation-and-return branch. F13 commits the baselines; until then the `visual` project is red, and that is honest.
6. **Known-bug tests:** add the real tests for F01, F02 and F03 now (copy the "Tests" sections of those tasks) and mark each one `test.fail(true, "Known bug, fixed by F0x")`. Playwright reports an error if such a test unexpectedly passes, which forces the fixing task to remove the annotation.
7. **Lint bans** (`eslint.config.js`, applied to `src`, `tests` and `scripts`):
   - `no-empty: ["error", { allowEmptyCatch: false }]`.
   - `no-restricted-syntax` with the selector `CallExpression[callee.property.name='catch'] > ArrowFunctionExpression[body.type='BlockStatement'][body.body.length=0]` and the message "Do not swallow errors". Also ban `.catch(() => undefined)` and `.catch(() => null)` with similar selectors.
   - Fix every violation properly. Report or rethrow; do not add `eslint-disable`.

## Acceptance criteria

- [ ] `PW_CHROMIUM_EXECUTABLE=… npm run test:e2e` launches in a cloud session. Paste the summary. The expected result: the previously failing specs still fail, the `test.fail` known-bug specs report as "expected to fail", and nothing else changed.
- [ ] The rewritten width-fit test fails if you change `screen.ts` to crop 10% on each side (paste the output), then passes after reverting.
- [ ] `npm run lint` passes, and the repo has no empty catch blocks or swallowing `.catch` calls (`grep -rn "catch {}\|catch(() => {})" src tests scripts` returns nothing).
- [ ] `CLAUDE.md` documents the browser setup.

## Out of scope

Fixing the rendering bugs themselves (F01–F03).
