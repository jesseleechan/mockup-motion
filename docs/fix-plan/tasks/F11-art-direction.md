# F11: Template art direction, ambient blur, chrome details (user review gate)

**Size:** L · **Depends on:** F01, F02, F03, F04

## Why

Once the rendering bugs are fixed, the templates still won't meet `quality-bar.md`:

- Most templates use **flat solid colours** instead of the designed palettes, gradients and meshes.
- The ambient background is not blurred.
- The browser's URL pill is empty.
- The isometric wall doesn't read as isometric.
- Several template settings were never checked against a real render.

This task is about taste, and it ends with a **review by the user**.

## Problems found in code

1. **Ambient background is unblurred and stretched.** In `BackgroundRenderer.ts`, `ambientBlurTargets` is declared but never filled. The shader samples strip 0 of the screenshot, stretched to the frame with no cover-fit, and `blur` is ignored.
2. **No URL text in the browser chrome.** `src/engine/devices/browser.ts` draws the pill but never renders `Style.browserUrl` (quality-bar §3.2).
3. **The isometric wall rotates each card around its own centre.** `src/motion/layouts/wall.ts:108-113` sets `rx`/`rz` per node. The **grid plane** must be rotated as a whole, so card positions rotate too. The current output is a flat-looking rotated grid with large gaps (`../evidence/10-wall-black-screens.webp`).
4. **Template backgrounds** (`src/templates/*.ts`) are mostly solid hex colours (`#18191B`, `#16171A`, `#0F1117`, `#1E2024`, `#F5F3EF`). The quality bar asks for low-chroma gradients and meshes with grain.

## Required changes

1. **Ambient background**
   - Once per asset, downscale the screenshot's **first viewport** to 256 px wide (the top region, with the hero's aspect, not the whole tall page).
   - Run 5 iterations of a dual-Kawase blur into a cached render target. Sample it with **cover-fit** UVs for the frame's aspect, and apply `dim`.
   - Include the render target in `retainOnly` (F03) and dispose it there.
2. **URL text**
   - Rasterize `Style.browserUrl` on the main thread with the body font at 42% of the toolbar height and 55% opacity (quality-bar §3.2).
   - Pass the raster through `AssetProvider.getText` using a synthetic layer id `chrome-url`. In the worker, it travels in the pre-rasterized `texts` map.
   - Draw it centred in the pill.
3. **Wall**
   - Build the grid flat in a group space, apply the plane rotation (rx −50°, rz 35°, tuned by eye) to the **whole group**, then position the camera with `isoDrift`.
   - Gaps between cards are 4–6% of the card width.
   - The wall stays full-bleed: the WP-09 full-bleed test must still pass.
4. **Template looks.** These are starting points: render them, look, and tune within the quality-bar limits.

   | Template | Background | Frames and devices | Camera and entrance |
   |---|---|---|---|
   | quiet-hero | Bone gradient `#F1EDE6 → #E3DCD0`, 160° | browser, light, soft shadow | pushIn 0.7, rise |
   | tilted-showcase | Graphite gradient `#141417 → #2A2A30`, vignette 0.08 | browser, dark chrome, medium shadow | heroTilt 1.0, float 0.5 |
   | responsive-pair | Mist mesh | browser and phone (silver) | orbitRight 0.6, stagger |
   | responsive-trio | Fog gradient `#EEF1F4 → #D9DFE6` | browser, tablet, phone | dollyLeft 0.6, stagger |
   | phone-spotlight | Dusk mesh | phone, **silver** finish for contrast on dark | orbitLeft 0.8, float 0.6 |
   | phone-parade | Fog gradient (light) | 3 columns, graphite phones | static, marquee 0.4 |
   | portfolio-rows | Graphite gradient | 2 rows, dark frames, tilt 8° | static, marquee 0.35 |
   | isometric-wall | Bone gradient | card frames, soft shadow | isoDrift 0.5 |
   | cascade-stack | Mist mesh | browser ×4 | pullBack 0.7, stagger |
   | scroll-story | Fog gradient | browser, light | pushIn 0.2, scroll on |
   | launch-reel | Ambient (from primary screenshot), dim 0.35 | browser, then pair | per shot (already defined) |
   | case-study-reel | Graphite gradient | browser | alternating per shot |

   Grain stays at 0.25 by default, and the vignette within quality-bar §5.
5. **Dark templates must keep devices legible:**
   - Rim highlight on phones (quality-bar §3.3).
   - A hairline border on dark frames.
   - Shadows tinted from the background, never pure black (quality-bar §5).
6. **Contact sheet** (`scripts/contact-sheet.ts`, `npm run contact-sheet`)
   - Render 12 templates × 3 aspects (16:9, 9:16, 1:1) × 3 times (0.15, 0.5 and 0.85 of the total) at 960 px wide.
   - Write WebP files (quality 80) and an `index.html` grid with labels.
   - Fail loudly on any error.
   - Commit the output under `docs/fix-plan/evidence/F11/contact-sheet/` (≤ 15 MB).

## User review gate

**Stop after step 6.** Post the contact sheet link to the user and ask for sign-off or changes. Apply what the user asks. Do not start F13 (which freezes visual baselines) until the user has approved the look in writing in the PR.

## Acceptance criteria

- [ ] The ambient background visibly blurs (still in the PR), is cover-fit at all 5 aspects, and causes no per-frame allocations.
- [ ] The URL is readable in the browser pill at 1080p, in both preview and export (crop in the PR).
- [ ] The wall reads as one tilted plane. The full-bleed test passes.
- [ ] The `quality-bar.md` §8 checklist is filled in for **each** template, with one line of notes per item.
- [ ] The contact sheet is committed and the user's sign-off is quoted in the PR.
