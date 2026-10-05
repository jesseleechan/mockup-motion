# WP-07: Backgrounds, palettes, and atmosphere

**Milestone:** M1 · **Depends on:** WP-03 · **Parallel with:** 06, 08, 10 · **Size:** M

## Goal

Build elegant, low-chroma backgrounds that make screenshots look expensive: designed palettes, OKLab gradients, slow mesh gradients, ambient blurred-screenshot backdrops, and an automatic palette derived from the user's own work.

## Context (read first)

- `quality-bar.md` §5 (grain is applied in WP-08's final pass; assume it is on) and §6
- `contracts.md` §2 `Background`, §5 (background phase is loop-safe)
- WP-03's `BackgroundRenderer` interface

## Scope

**In**

1. **Dependency:** `culori`.
2. **Palettes (`src/doc/palettes.ts`).** Finalize the 8 built-in palettes from quality-bar §6. You may adjust the values, but stay within the chroma limits and document each in a comment. Each palette provides the `Background` plus a recommended `frameAppearance`, `textColor`, and shadow tint.
3. **Auto palette**
   - **`src/assets/palette.ts`:** `dominantColors(rgba: Uint8ClampedArray, w, h, k = 5) → string[]`. k-means in OKLab on a 64 px downscale with a seeded initialization, weighted by saturation so white page backgrounds do not dominate. It is pure and testable.
   - **`suggestBackgrounds(palette) → Background[4]`:** light, dark, mesh, and ambient, following quality-bar §6 (lower chroma by 40–60%, lightness distance at least 0.25 L from the screenshot average).
   - Compute the palette on import and store it in `AssetRef.palette`. This needs a small hook in WP-01's `decode.ts`; coordinate through a PR note if WP-01 is not merged yet.
4. **Background renderers (`src/engine/backgrounds/`)**, each a full-frame screen-space quad drawn first into each shot target. An optional parallax of up to 2% follows the camera pan.
   - `solid`
   - `gradient`: 2–3 stops, angle, interpolated in OKLab inside the shader (sRGB → linear → OKLab, mix, back).
   - `mesh`: 3–5 color points with smooth inverse-distance falloff, domain-warped by low-frequency value noise (seeded), drifting with `backgroundPhase` using integer harmonics only (loop-safe), at most 6% movement per loop.
   - `ambient`: the asset downscaled to 256 px, blurred with a dual-Kawase blur (5 iterations) once per asset, scaled to cover, then dimmed. It is cached, not re-blurred per frame.
   - `image`: cover-fit with dim.
5. **Shadow tint export.** `shadowTintFor(background) → string` (dominant hue at 25% lightness) for WP-08.

**Out:** grain, vignette, and dither (WP-08); background pickers in the UI (WP-12).

## Acceptance criteria

- [ ] `dominantColors` returns stable results for 4 fixture images (snapshot), and white-page screenshots do not return near-white as the first color.
- [ ] `suggestBackgrounds` outputs pass the chroma and lightness rules (unit tests using `culori`).
- [ ] **Mesh loop seam:** rendered `backgroundPhase` 0 vs. 1 differs by at most 1 per channel (Playwright readback in `/lab`).
- [ ] **Gradient quality:** the OKLab gradient between `#1F2B45` and `#C3A6A0` has no grey or muddy midpoint. Attach a comparison strip against plain sRGB interpolation.
- [ ] Attach a contact strip: each built-in palette × (frontal browser, phone) at 1080p, plus the 4 auto suggestions for 3 demo screenshots.
- [ ] Frame cost: `mesh` ≤ 0.8 ms and `ambient` ≤ 0.3 ms per frame at 1080p (report the GPU).
