# WP-10: Text and typography

**Milestone:** M2 · **Depends on:** WP-02 (text timing), WP-03 · **Parallel with:** 06–09 · **Size:** M

## Goal

Add crisp, well-set titles, captions, and end cards in curated or user-supplied fonts, with restrained kinetic reveals. This is what turns a mockup loop into a presentation.

## Context (read first)

- `quality-bar.md` §2.2 (text timing), §7 (typography rules)
- `contracts.md` §2 (`TextLayer`, `FontRef`, `Style.fonts`), §6 (`TextFrame`), §7 (`getText`, `TextRaster`), §9 (pre-rasterized text in the worker)
- WP-02 `text-anim.ts`; WP-01 `AssetProvider` stub for `getText`

## Scope

**In**

1. **Fonts (`src/assets/fonts.ts`)**
   - **Built-in curated pairs** (quality-bar §7) from `@fontsource-variable/*` or `@fontsource/*` (Instrument Serif and DM Serif Display are static). Load lazily: import the woff2 URL, then `new FontFace(family, url)` → `document.fonts.add` on first use.
   - **User fonts:** upload woff2, woff, ttf, or otf → stored as an `AssetRef` (kind `font`) plus a blob → `FontFace` from an `ArrayBuffer`. Read the family name from the file's `name` table when possible (a minimal parser), otherwise use the file name.
   - `ensureFonts(style, layers)` resolves when every needed face is loaded.
2. **Rasterizer (`src/text/rasterize.ts`, main thread)**
   - `rasterizeText(layer, style, frameHeightPx) → TextRaster`, drawing with Canvas 2D at the exact output size.
   - Applies size (% of frame height), tracking, line height, and weight per quality-bar §7.
   - **Balanced line wrapping:** titles wrap at 22 characters or fewer, choosing the break that minimizes line-length variance.
   - Returns word boxes for per-word animation, plus optional logo placement above the text (logo height = 1.4 × cap height).
   - **Auto-contrast:** when `color` is `""`, pick light or dark text from the background's average luminance (computed from `Style.background` colors, or the ambient asset palette) so it meets the WCAG targets in quality-bar §7.
   - Implement `AssetProvider.getText` (replace the WP-01 stub) with a cache keyed by `(layer content hash, style fonts and colors, frameHeightPx)`.
3. **Engine text pass (`src/engine/text/`)**
   - Screen-space overlay per shot after the 3D scene, with one quad per word (or per line for `maskReveal`), driven by `TextFrame`: opacity, dy, clip, and blur.
   - Blur-in uses a 9-tap Gaussian in the fragment shader, scaled by `blur`.
   - Texture: `SRGBColorSpace`, no mipmaps (it is drawn at 1:1), premultiplied alpha.
   - Anchors and safe margins follow quality-bar §4 and §7. Vertical formats keep text inside the central 80%.
4. **Tune animations** in `src/motion/text-anim.ts` to match quality-bar values: `fadeUp`, `maskReveal` (line-by-line clip from below), `blurIn`, `wordStagger`, `typewriter` (per character via word boxes subdivided by measured glyph advances).
5. **Title shot composition:** `layout.kind === "title"` centers a title and subtitle block with an optional logo. The background comes from the style.
6. **Export path:** the main thread pre-rasterizes every text layer at export resolution and passes the results to the worker (`contracts.md` §9).

**Out:** the text editing UI (WP-12 inspector and WP-14 timeline lanes).

## Acceptance criteria

- [ ] Unit tests: raster height scales linearly with `frameHeightPx` at 720, 1080, and 2160 (±1 px); balanced wrapping on 10 fixture titles; auto-contrast meets the targets on Bone, Graphite, and Dusk; text below 1.6% of frame height is clamped up.
- [ ] Every built-in font pair renders correctly in the preview and in an exported frame (attach a specimen frame per pair). A user-uploaded font works after reload.
- [ ] Each text animation matches quality-bar timings. Attach a frame strip at 0, 0.2, 0.4, 0.6, and 1.0 s for each.
- [ ] Text is pixel-crisp in a 1080p export at any camera move (it never takes the 3D transform).
