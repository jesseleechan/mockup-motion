# MockupMotion: agent guide

MockupMotion is a local-first studio that turns website screenshots into short, elegant presentation videos. Think Jitter or shots.so, focused on web designers presenting their work. Everything renders in the browser, with no server, no account, and no watermark.

**Current phase: after the fix plan.** The October 2026 audit found that the rebuild on `main` rendered upside down, with wrong colours, black screens and fake tests. The fix plan, **`docs/fix-plan/README.md`** (tasks F00–F14), fixed that; each work package's status in `docs/plan/README.md` links to the fix. Open issues are listed in **`docs/plan/follow-ups.md`**. Section 3 of the fix plan, "Rules for the executor", still applies to every change: read it before you start.

The original rebuild plan is still the reference for _what_ to build. If you were given a work package (WP) or a follow-up, read these first, in this order:

1. `docs/plan/README.md`: architecture, milestones, and how WPs fit together
2. `docs/plan/contracts.md`: shared types and module APIs (the source of truth)
3. `docs/plan/quality-bar.md`: the aesthetic and motion rules every visual change must meet
4. `docs/plan/wp/WP-XX-*.md` or your entry in `docs/plan/follow-ups.md`: your task

`docs/archive/` holds the previous plan and design notes. They are stale, so do not follow them.

## Commands

```sh
npm ci                     # install (Node 22.12+)
npm run dev                # http://localhost:3000
npm test                   # unit tests (Vitest)
npm run typecheck
npm run lint               # ESLint
npm run build
npm run test:e2e           # Playwright, Chromium (tests/e2e)
npm run test:visual        # pixel stills against the committed Linux baselines (tests/visual)
npm run test:visual:update # writes baselines for your OS; see "Visual baselines" below
npm run test:perf          # export speed (Spike 3) and frame budgets (tests/perf); needs a real GPU
npm run contact-sheet      # every template at 3 aspects x 3 times into ./contact-sheet (--out <dir>)
npm run template-previews  # regenerates the gallery previews in public/templates
npm run demo:capture       # recaptures the demo sites in demo-sites/ into public/demo
```

CI (`.github/workflows/ci.yml`) has three required checks: `unit` (typecheck, lint, test, build), `e2e` and `visual`. All three must be green.

- `unit` and `visual` run in full on every pull request and merge group.
- `e2e` reports on every pull request and merge group. On a pull request and in a merge group it runs only the **smoke subset**, the tests tagged `@smoke` (`--grep @smoke`, about 5 minutes). On a pull request it runs Playwright only when the PR is ready for review (not a draft), targets `main`, and changes an e2e trigger path: `src/`, `public/`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tests/e2e/`, `tests/helpers/`, `playwright.config.ts`, `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `scripts/e2e-paths.ts` or `scripts/e2e-shards.ts`. The list lives in `scripts/e2e-paths.ts`. Otherwise `e2e` is green within seconds and says why the suite was not run. A merge group always runs the smoke subset.
- Drafts and PRs stacked on another branch skip the suite while you iterate. Marking a draft ready for review runs it. A stacked PR runs it once it targets `main` and gets a new commit, which merging `main` into it gives it.
- Pushes to `main`, the nightly run (06:00 UTC) and manual runs always run the full e2e suite.
- **When `main`'s full run fails, the merge queue pauses** until the failure is fixed or the culprit PR is reverted. Nothing else merges in the meantime.
- The full suite runs on four shards, which are file groups in `scripts/e2e-shards.ts` balanced on measured durations. When you add a spec, add it to the group with the least time; a unit test fails until every spec is in exactly one group. The `e2e` check merges the shards' reports, and uploads the HTML report as `e2e-results` when a test fails.

`perf` is not in CI, because the runner has no GPU.

Playwright browsers:

- **Locally:** run `npx playwright install chromium` once.
- **Cloud sessions:** Chromium may be preinstalled under `/opt/pw-browsers` with a build older than the one `@playwright/test` expects. When versions differ, set `PW_CHROMIUM_EXECUTABLE` to the installed binary: `PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:e2e`.

Playwright's Chromium on Linux (the CI runner) cannot encode H.264, so MP4 exports fall back to WebM there. MP4-only assertions must check the encoder at runtime and skip with that reason; no other skips are allowed.

**Visual baselines** are Linux-only: they are rendered on the CI runner by the Visual baselines workflow, and Windows and macOS stills never match them. A local `npm run test:visual` therefore needs `npm run test:visual:update` on unchanged code first, which writes git-ignored baselines for your OS. **Every change to the committed baselines needs the project owner's written approval of the rendered diff.** Read `tests/visual/README.md` before you touch them.

## Hard rules

- **Determinism.** Nothing under `src/motion/` or the engine render path may read `Date.now()`, `performance.now()`, or unseeded `Math.random()`. A frame is a pure function of `(doc, t, size)`. Use `src/motion/rng.ts` (seeded) for noise or grain.
- **Module boundaries.** `src/motion/` is pure TypeScript with no DOM, three.js, or React imports, so it can be unit-tested in Node. `src/engine/` has no React. `src/editor/` and `src/ui/` never import three.js directly; they go through `Engine`.
- **Screens are unlit and color-exact.** Screenshot content uses unlit materials, `SRGBColorSpace` textures, and `NoToneMapping`. A screenshot must look exactly like the PNG.
- **Image orientation.** Image textures use `flipY = false`, so texel row 0 is the top of the image. Every quad that shows an image maps its top edge to v = 0. WebGL ignores `flipY` for `ImageBitmap`. See `docs/fix-plan/tasks/F01-image-orientation.md`.
- **Colour pipeline.** Render targets hold linear values, and every custom shader outputs linear. Only the final pass converts to sRGB, followed by grain and dither. See `docs/fix-plan/tasks/F02-color-pipeline.md`.
- **Tests must be able to fail.** Never weaken, skip, or early-return a test to make it pass. Never swallow errors with `.catch(() => {})` or an empty `catch {}`. Never ship placeholder assets. Look at the pixels you render.
- **Never crop a screenshot horizontally.** Device screens fit the screenshot to width. Overflow is cropped at the bottom or scrolled (opt-in only). See `quality-bar.md` §3.
- **No yo-yo motion.** A shot never reverses its main camera or layout movement. Loops come from marquee periods or a wrap crossfade (`contracts.md` §5).
- **Content scrolling is opt-in.** A tall screenshot never starts scrolling unless the user picks a scroll template or turns scroll on for that shot.
- **Dispose GPU resources** (textures, geometries, materials, render targets) whenever the scene graph changes.
- **Keep scope.** Do only your task. If you find something out of scope, note it in your PR description under "Follow-ups" and add it to `docs/plan/follow-ups.md`.

## Tests

Write the fewest tests that protect what matters, at the cheapest level that can catch the problem. More tests are not better: every e2e test costs CI minutes on every merge and can flake (owner, 19 October 2026).

- **Unit tests first.** Motion, layouts, timing, the document model, templates and the editor store are pure TypeScript. Test them with Vitest. Most changes need only unit tests.
- **Visual stills show the look.** A template, layout or device change is covered by its stills in `tests/visual` and the contact sheet in the PR. Don't add an e2e pixel test for something a still already shows.
- **e2e only for what needs a real browser:** WebGL colour and orientation, export and encoding, asset loading, and user flows that have broken before. A PR adds at most one e2e test unless its task asks for more. A new preset adds none: the stills and the existing specs that cover every built-in template already exercise it.
- **No counts that every addition changes.** Don't assert the number of templates, presets or stills as a literal; read it from the registry. A literal count conflicts with every PR that adds one.
- **Proof that a test can fail** is needed for a test that guards a bug fix: revert the fix, run the test, and put the failure in the PR. A test for new behaviour doesn't need it.
- **Locally,** run typecheck, lint, `npm test` and build, plus only the e2e specs you added or changed (`npx playwright test tests/e2e/<name>.spec.ts`). Don't run the full e2e suite locally; `main` runs it after every merge.
- **The smoke subset** is what a PR's `e2e` check runs: the browser checks that mean "the app is broken" (boot and a template with demo content, WebGL colour and orientation, one export to a playable file, asset loading, the overflow guard). Tag a test by ending its title with ` @smoke`, as in `test("F02 solid colour is exact @smoke", ...)`. Add a test to it only when its failure would make the app unusable; keep the subset under about 3 minutes of runner time. `npm run test:e2e -- --grep @smoke` runs it.
- **A flaky e2e test** gets one re-run. If it fails again and the PR doesn't touch what it tests, say so in the PR and fix or remove the test in its own small PR. Don't keep re-running it.

## Code style

- Write readable TypeScript. Do not chain declarations with commas (`const a = 1, b = 2`). The legacy code does this; do not copy it.
- Use named exports. Keep files under about 400 lines, splitting by responsibility.
- Comment only non-obvious decisions, especially magic numbers in visual code. Point to the `quality-bar.md` section.
- Prettier formats the code; run `npm run format` before committing.
- UI copy is short, calm, and professional. Avoid cute phrases ("Ready for its close-up!"). Use sentence case.

## Definition of done (every task)

- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass, and the PR's three CI checks (`unit`, `e2e`, `visual`) are green. If the PR touches an e2e trigger path (see Commands), `e2e` must have run the smoke subset on the head you merge, which happens once the PR is ready for review and targets `main`. `main` then runs the full suite.
- The acceptance criteria of your task are met, and the PR shows how each one was verified.
- Visual work: attach before/after frames or a contact sheet to the PR. Check `quality-bar.md` and say which rules you checked.
- Update the status: the WP table in `docs/plan/README.md` for a work package, or remove the item from `docs/plan/follow-ups.md` for a follow-up. Link the evidence.
