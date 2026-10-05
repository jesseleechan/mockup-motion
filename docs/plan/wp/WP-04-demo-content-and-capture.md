# WP-04: Demo sites, captured screenshots, and capture CLI

**Milestone:** M1 · **Depends on:** WP-00 · **Parallel with:** 01, 02, 03, 05 · **Size:** M

## Goal

Replace the wireframe-looking demo content with believable, beautiful website screenshots, because they drive first impressions, template previews, and visual tests. Also ship a capture CLI so the designer can grab perfect full-page screenshots of their own sites in one command.

## Context (read first)

- `audit.md` §1 #5, `src/utils/sampleImages.ts` (to delete), `src/assets/images.ts` `loadDemoImages`, `src/editor/Presets.tsx` `samples()`
- `public/demo/aurelia.png` (keep and reuse)

## Scope

**In**

1. **`scripts/capture.ts`**, run as `npm run capture -- <url> [options]`:
   - Options: `--out captures/`, `--desktop 1440`, `--mobile 390`, `--scale 2`, `--mode full|viewport|both` (default `both`), `--hide "<css selectors>"`, `--wait <ms>`, `--unstick` (convert `position: fixed`/`sticky` to static after the first viewport, to avoid repeated or overlapping headers in full-page captures).
   - Behavior: emulate `prefers-reduced-motion: reduce`, inject CSS that disables animations, transitions, and caret blink, auto-scroll the whole page to trigger lazy loading and then return to the top, wait for `document.fonts.ready` and network idle, then capture.
   - Record section boundaries: each top-level `section`, `header`, `footer`, or `main > *` element's `top` and `height` in CSS px, written to `<name>.json` with viewport width, scale, and page height. WP-15 uses these as ground truth for section detection tests.
   - Output: `<host>-desktop-1440[-full].png`, `<host>-mobile-390@2x[-full].png`, plus the JSON.
   - Document local setup in README: `npx playwright install chromium` on the user's machine. Cloud sessions use the preinstalled browser.
2. **`demo-sites/`:** five static, responsive sites (HTML and CSS only, fonts copied locally from `@fontsource`, no external requests). Each has 6–9 sections, a believable copy deck, and real typographic care:
   1. **Aurelia**: architecture studio (reuse `aurelia.png` imagery; serif display type).
   2. **Northwind**: SaaS product landing (product UI built in HTML, CSS, and SVG: charts, tables, cards).
   3. **Maison Oak**: furniture e-commerce (product grid, product detail, cart drawer).
   4. **Field Notes**: editorial magazine (long-form article layout, pull quotes).
   5. **Studio Kova**: design portfolio (case-study grid, bold grotesk, dark sections).
   - Imagery: original SVG and CSS art, the existing `aurelia.png`, images made with an image generation tool if one is available, or Unsplash images (Unsplash License). Record every external image's source and license in `public/demo/CREDITS.md`. Never use images with unclear licenses.
3. **Captured assets** (`npm run demo:capture` serves `demo-sites/` locally and runs the capture script):
   - Per site, in `public/demo/<site>/`: `desktop-hero.webp` (1440 × 900 @2×), `desktop-full.webp` (1440 wide @1×), `mobile-hero.webp` (390 × 844 @2×), `mobile-full.webp` (390 wide @2×), plus `sections.json`.
   - WebP quality 92. Total budget is 14 MB or less; report the sizes.
   - `public/demo/manifest.json` lists every asset with `{ site, file, role, tall, width, height }`.
4. **Legacy UI switch-over** (a small, immediately visible win): change `loadDemoImages` and the preset-thumbnail sample loader to use `manifest.json` (Aurelia, Northwind, and Studio Kova desktop heroes; Maison Oak and Field Notes mobile heroes). Delete `src/utils/sampleImages.ts`.

**Out:** template previews (WP-11), section-detection algorithm (WP-15).

## Acceptance criteria

- [ ] `npm run capture -- https://example.com` produces the 4 PNGs and JSON locally. `--unstick` removes repeated headers on a site with a sticky header (demonstrate with a demo site).
- [ ] The 5 demo sites look like real, high-end websites. Attach all `desktop-hero` and `mobile-hero` captures to the PR for the user's review.
- [ ] Assets are within budget, the manifest is valid, and CREDITS.md is complete.
- [ ] The legacy app's demo and preset thumbnails use the new screenshots. `sampleImages.ts` is gone.
