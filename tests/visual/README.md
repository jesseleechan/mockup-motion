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

1. Push your branch, then run the **Visual baselines** workflow (`.github/workflows/visual-baselines.yml`) on it from the Actions tab, or:

   ```sh
   gh workflow run visual-baselines.yml --ref <branch>
   ```

   Pushing the commit to a branch named `visual-baselines/<name>` runs it too, but leaves a branch behind to delete. Vercel doesn't deploy those branches (`vercel.json`).

2. When it finishes, download the `visual-baselines` artifact into an empty folder outside the repository, then copy its PNGs over the baselines. Don't download it straight into `stills.spec.ts-snapshots`: `gh run download` refuses to overwrite a file that exists, so there it fails with "file exists" and writes nothing.

   ```sh
   dir="$(mktemp -d)"
   gh run download <run-id> -n visual-baselines -D "$dir"
   cp "$dir"/*-linux.png tests/visual/stills.spec.ts-snapshots/
   ```

   The artifact holds the full set of `*-linux.png` files, but the workflow rewrites only stills that are missing or no longer match, so unchanged baselines keep their bytes and `git status` then shows only the stills that changed.

3. Open every changed PNG (`git status`) and check it: orientation, colours, real screenshots, no black screens. Do not recompress them. Playwright compares decoded pixels, and the files should stay exactly as the runner wrote them.
4. Commit them with the change that caused them, then get the approval described above.
5. If you removed or renamed a still, delete its old baseline by hand.

## Comparing two commits pixel for pixel

A normal run keeps every committed still that is within the 0.2% tolerance, so its artifact can't show that a change leaves the stills untouched, or what a change under the tolerance does to them. Tick **Render every still** (`-f fresh=true`) to delete the committed baselines first and render all of them. Run it on your branch and on `main`, download both artifacts into empty folders, and compare them:

```sh
gh workflow run visual-baselines.yml --ref <branch> -f fresh=true
gh workflow run visual-baselines.yml --ref main -f fresh=true
# when both finish:
gh run download <branch-run-id> -n visual-baselines -D /tmp/vb-branch
gh run download <main-run-id> -n visual-baselines -D /tmp/vb-main
for f in /tmp/vb-main/*.png; do cmp -s "$f" "/tmp/vb-branch/${f##*/}" || echo "changed: ${f##*/}"; done
```

The renders are deterministic, so stills that print nothing are byte-identical. The fresh run on `main` should also match the committed baselines byte for byte; if it doesn't, a merged change moved them within the tolerance, and they need refreshing with the owner's approval.
