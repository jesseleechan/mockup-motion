# Visual regression

Stills are Playwright screenshots of `/lab?still=1&fixture=…&t=…&aspect=…&w=…`.

- Fixed CSS size, `deviceScaleFactor: 1`, supersample 1.
- Wait for `window.__labReady` (fonts loaded, first frame painted).
- Pixel tolerance: `maxDiffPixelRatio: 0.002`.

Snapshots are stored next to the spec and include the OS name (`win32`, `linux`). A missing baseline for the current OS is reported, not failed, so CI on Ubuntu stays green until Linux baselines are generated there.

## Update baselines

From the repo root, with the dev server free to start:

```sh
npx playwright test --project=visual --update-snapshots
```

Review the PNGs under `tests/visual/stills.spec.ts-snapshots/` before committing them. GPU and font rasterizers differ across machines; update baselines on the machine that runs the check.
