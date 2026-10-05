# WP-18: Visual regression, E2E, performance, cross-browser, and final polish

**Milestone:** M3 · **Depends on:** all other WPs · **Size:** L

## Goal

Lock in quality so future changes cannot quietly make the output worse, prove the app works in every target browser, and do a final taste pass on everything.

## Scope

**In**

1. **Visual regression (`tests/visual/`):** Playwright `toHaveScreenshot` against `/lab?fixture=…&t=…&aspect=…` stills. Cover every template × {16:9, 9:16} × 2 times, every device frontal and tilted, every background, every transition at progress 0.5, and every text animation at its midpoint. Use a fixed DPR, wait for `window.__labReady`, and set a per-test pixel tolerance (start at `maxDiffPixelRatio: 0.002`). Document how to update baselines.
2. **E2E suite (`tests/e2e/`):**
   - First run → template → demo → edit → export.
   - Upload real files (including corrupt and oversized ones).
   - v1 migration.
   - Multi-shot reel.
   - Scroll Story.
   - Brand kit.
   - Projects (create, duplicate, delete).
   - Storage quota error (stub `IDBObjectStore.put` to throw `QuotaExceededError`).
   - WebGL context loss (`WEBGL_lose_context`) during playback and during export.
   - Cancel export.
3. **Performance budgets** (`tests/perf/`, reported in CI as warnings, not failures):
   - Preview: single-shot templates ≥ 55 fps, wall and rows ≥ 45 fps at a 1440 × 810 canvas on an M1-class machine.
   - Export: 6 s at 1080p30 `high` in ≤ 12 s.
   - Startup: interactive in ≤ 1.5 s on a cold load (Lighthouse, desktop).
   - Bundle: initial JS ≤ 250 KB gzip (lazy-load the engine worker, export, GIF, and template previews).
4. **Cross-browser checklist** (manual, results in `docs/plan/browser-matrix.md`): Chrome, Edge, Safari 17 and 18 (or current), and Firefox current, on macOS and Windows. Check:
   - H.264, VP9, and AV1 encode availability.
   - `OffscreenCanvas` WebGL2 in a worker.
   - `createImageBitmap` resize-options fallback.
   - `EyeDropper` fallback.
   - Font loading.
   - Clipboard paste.
   - Drag and drop.
   - IndexedDB quotas.
5. **Final taste pass:** go through every template with the `quality-bar.md` §8 checklist at 3 aspects and fix deviations. Review all UI copy (short, calm, sentence case). Run an accessibility pass (axe, keyboard, focus order, reduced motion).
6. **Docs:** rewrite `README.md` as a user guide. Cover capturing screenshots (`npm run capture` and DevTools), choosing a template, Scroll Story, reels, brand kits, export destinations, and embedding on a website (with the snippet). Update `CLAUDE.md` commands, and mark the plan's WPs done.

## Acceptance criteria

- [ ] The visual and E2E suites run in CI and are green. Baselines are committed.
- [ ] Performance numbers are reported in the PR, and any budget misses come with an explanation and a follow-up issue.
- [ ] The browser matrix is filled in, with no blocking issue in any target browser.
- [ ] The quality-bar checklist is completed for all 12 templates (attach the final contact sheet).
- [ ] README rewritten; no dead code (check with `ts-prune` or `knip`).
