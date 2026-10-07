# Visual regression

`stills.spec.ts` compares pixel stills of every template, device, background, transition and text animation, plus the F01 orientation quadrants on every device and the F02 colour bands, against committed baselines. The `visual` CI job runs it on every pull request and on `main`.

## How a still is taken

- `/lab?still=1&fixture=…&aspect=…&t=…&w=…`: a fixed time, supersample 1 and pixel ratio 1.
- The `visual` Playwright project uses a 900×900 viewport, `deviceScaleFactor: 1` and SwiftShader flags.
- The test waits for `window.__labReady` (fonts loaded, first frame painted) plus two `requestAnimationFrame`s, then screenshots the canvas.
- Tolerance: `maxDiffPixelRatio: 0.002`.
- The orientation and colour fixtures use generated `lab-test-*` assets (`src/lab/test-images.ts`), so they need no image files.

## Baselines are Linux-only

Baselines live in `stills.spec.ts-snapshots/` as `<still>-visual-linux.png`. They are rendered on GitHub's `ubuntu-latest` runner with the Chromium build pinned by `@playwright/test`, which is what the `visual` job uses. Font rasterization differs between operating systems, so Windows and macOS stills never match them. `.gitignore` excludes `-win32` and `-darwin` files so they are never committed.

**A missing baseline fails the test.** `playwright.config.ts` sets `updateSnapshots: "none"`, so a run never writes a baseline on its own. A new still fails until its Linux baseline is committed. Running `npm run test:visual` on Windows or macOS therefore fails with "A snapshot doesn't exist". To check a change locally, use `npm run test:visual:update` once on the unchanged code to write local baselines for your OS, then run `npm run test:visual` after the change. Those files are ignored by git.

## When to update baselines

Update baselines only when a change is meant to change how something looks: a template's art direction, a device model, a new fixture, a deliberate shader change. Before you update, check the failing stills in the `visual-results` artifact (actual, expected and diff for each still) and make sure every difference is intended.

Never update baselines to make a failing check pass when the look was not supposed to change. That is a regression; fix the code.

**Every baseline update needs the project owner's approval of the rendered diff.** Put the before and after stills (or the CI diff images) in the pull request, say which stills changed and why, and wait for written approval before you merge.

## How to update baselines

1. Push your branch, then run the **Visual baselines** workflow (`.github/workflows/visual-baselines.yml`) on it from the Actions tab. Alternatively, push the same commit to a branch named `visual-baselines/<name>`:

   ```sh
   git push origin HEAD:visual-baselines/<name>
   ```

2. When it finishes, download the `visual-baselines` artifact. It holds the full set of `*-linux.png` files. The workflow rewrites only stills that are missing or no longer match, so unchanged baselines keep their bytes.

   ```sh
   gh run download <run-id> -n visual-baselines -D tests/visual/stills.spec.ts-snapshots
   ```

3. Open every changed PNG (`git status`) and check it: orientation, colours, real screenshots, no black screens. Do not recompress them. Playwright compares decoded pixels, and the files should stay exactly as the runner wrote them.
4. Commit them with the change that caused them, then get the approval described above.
5. If you removed or renamed a still, delete its old baseline by hand.
