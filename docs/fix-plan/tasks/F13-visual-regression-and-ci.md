# F13: Visual baselines and CI that runs everything

**Size:** M · **Depends on:** F11 (the look must be approved before baselines are frozen)

## Why

The visual regression suite has never compared anything: no baselines are committed, and until F00 the spec skipped itself silently. CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests and build, but **not** e2e or visual tests. Every rendering bug in this plan reached `main` because no automated check looked at pixels.

## Required changes

1. **Visual stills** (`tests/visual/stills.spec.ts`)
   - Keep the template, device, background, transition and text-animation stills.
   - **Add** the F01 orientation fixtures (quadrants in every device) and the F02 colour fixture (bands).
   - Use a fixed 900×900 viewport, DPR 1 and SwiftShader flags (F00), and wait for `__labReady` plus two `requestAnimationFrame`s.
2. **Baselines:** generate them on Linux with the same Chromium build CI uses (`npm run test:visual:update` inside CI, or the `mcr.microsoft.com/playwright:<version>` image), and commit `tests/visual/stills.spec.ts-snapshots/*-linux.png`. Document how to update them in `tests/visual/README.md`.
3. **CI jobs** (`.github/workflows/ci.yml`)
   - `unit`: typecheck, lint, unit tests and build (exists).
   - `e2e`: `npx playwright install --with-deps chromium`, then `npm run test:e2e`.
   - `visual`: same install, then `npm run test:visual`.
   - Upload `test-results/` and `playwright-report/` as artifacts when a job fails.
   - The `perf` project stays out of CI gating. Run it manually on real GPUs.
4. **Branch protection** (tell the user; they must click it): require `unit`, `e2e` and `visual` to pass before merging to `main`.

## Acceptance criteria

- [ ] CI is green on the PR with all three jobs.
- [ ] **Mutation check:** on a scratch branch, set `texture.flipY = true` again (undoing F01). The `visual` and `e2e` jobs go red. Link the failed run in the PR.
- [ ] `tests/visual/README.md` explains when and how to update baselines, and says that baseline updates need the user's approval of the rendered diff.
