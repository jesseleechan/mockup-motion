# F12: Demo site fixes and recapture

**Size:** S · **Depends on:** none (independent; can be done at any time)

## Why

The five demo sites in `demo-sites/` are the best part of the rebuild, but a few layout bugs show up in the captures, which every preview and template uses:

- **Studio Kova:** the top navigation overlaps ("KOVA [2026]" runs into "INDEX"), and the "CHRONOS" label overlaps its circle graphic.
- The other sites need checking at 1440 and 390 widths for overlaps, clipped text and empty areas.

## Required changes

1. Open each site at 1440 and at 390 (2×) in Playwright, take full-page captures, and inspect them. Fix every overlap, clipping or broken layout in `demo-sites/<site>/styles.css` and `index.html`.
2. Recapture with `npm run demo:capture`. Update `public/demo/manifest.json` (dimensions and sizes) and each site's `sections.json`.
3. Re-run the F04 demo-asset unit test, the WP-15 section-detection tests and the template preview generation (F07, if it has already landed).

## Acceptance criteria

- [ ] Commit before and after crops of every fixed issue under `docs/fix-plan/evidence/F12/`.
- [ ] The demo assets stay within the 14 MB budget (report the sizes).
- [ ] The demo-asset, section-detection and template-preview tests pass.
