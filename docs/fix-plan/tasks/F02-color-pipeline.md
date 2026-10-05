# F02: Colour pipeline (linear working space, sRGB output, exact colours)

**Size:** M · **Depends on:** F00 (do after F01; both touch shaders)

## Bug

Colours are wrong everywhere except gradients:

| Input (grain 0, vignette 0) | Rendered | Expected |
|---|---|---|
| Solid `#808080` | `#373737` | `#808080` |
| Solid `#18191B` (Graphite) | `#020303` | `#18191B` |
| Gradient `#808080 → #808080` | `#808080` | `#808080` (correct only by accident) |

Screenshot mid-tones are darkened the same way, which breaks the "screens are colour-exact" hard rule. Dark templates (Tilted Showcase, Phone Spotlight, Portfolio Rows, Phone Parade) render on pure black, and dark devices disappear. See `../evidence/05-rows-black-screens-black-bg.webp` and `../evidence/06-phone-parade-invisible.webp`.

## Root cause

When three.js renders into a render target, shaders must output **linear** values. sRGB render targets (`SRGB8_ALPHA8`) encode on write and decode on read, so values read back from a target are linear. Built-in materials follow this rule automatically; custom `ShaderMaterial`s do not.

- `src/engine/post/final.ts:188` writes linear values straight to the canvas. Nothing converts linear to sRGB, so everything is too dark.
- `src/engine/background/BackgroundRenderer.ts:82,155` (`oklab_to_srgb`) writes **sRGB-encoded** values into an sRGB target. They get encoded twice and decoded once, which cancels the final pass error. That is why only gradients look right.

## Required changes

1. **Write down the rule.** Add this to `contracts.md` §7 under "Renderer invariants" and as a header comment in `src/engine/post/final.ts`:
   > Render targets hold linear-light values. Every custom shader that writes to a render target outputs linear sRGB-primaries values. Only the final pass converts to sRGB, and it does so explicitly (no `colorspace_fragment` include). Grain and dither are added after that conversion.
2. **Background shaders** (`BackgroundRenderer.ts`): rename `oklab_to_srgb` to `oklab_to_linear_srgb` and remove the transfer function, so the shader returns linear RGB. Solid colours already go through `THREE.Color`, which is linear in the working space; keep that. Ambient and image backgrounds sample an `SRGBColorSpace` texture, which decodes to linear; keep that, and apply `dim` in linear.
3. **Final pass** (`src/engine/post/final.ts`), in this order:
   1. Transition blend and downsample (linear).
   2. Vignette (linear).
   3. `vec3 srgb = linearToSrgb(color)`, using the exact piecewise function: 12.92·c below 0.0031308, else 1.055·c^(1/2.4) − 0.055.
   4. Grain, zero-mean, with amplitude from `Style.grain` mapped to 1.5–4% (quality-bar §5).
   5. Triangular dither of ±0.5/255.
   6. Clamp, then write.
4. **Audit every `ShaderMaterial` and `RawShaderMaterial` in `src/engine`** (`grep -rn "ShaderMaterial" src/engine`): screen, text, shadows, accumulation, cursor and ripple. For each, confirm that:
   - inputs are linear (colour uniforms built with `THREE.Color`, or explicitly converted from hex with `THREE.Color.setStyle`),
   - outputs are linear,
   - alpha and premultiplication are consistent.

   For text, create the raster bitmap with `premultiplyAlpha: "premultiply"` and treat it as premultiplied in the shader with `One, OneMinusSrcAlpha` blending, so light text has no dark fringes. Record the result for each shader in the PR as a table.
5. **Shadow tint** (`src/engine/shadows/DeviceShadow.ts`): build the tint from `shadowTintFor(background)` through `THREE.Color`, so it is linear.
6. **Motion-blur accumulation:** the half-float accumulation target stays linear. Make sure accumulation happens **before** the final pass (F09 refactors this further).

## Tests (start them in F00 as `test.fail`; remove the annotation here)

Create `tests/e2e/color.spec.ts`. All tests use: grain 0, vignette 0, supersample 1, 1280×720, a `title` layout (no devices) or a frontal static card, and read pixels in the centre region.

1. Solid backgrounds: `#808080` → (128,128,128) ±1; `#18191B` → (24,25,27) ±1; `#F1EDE6` → (241,237,230) ±1.
2. A gradient with identical stops `#3366CC` → (51,102,204) ±1. A mesh with all colours `#3366CC` → ±1.
3. Screenshot exactness: a card shows `bands(1600, 1000, ["#808080", "#3366CC", "#F1EDE6", "#18191B"])` frontally, with the camera at `distance` 0.7 so the screen fills most of the frame. The centre of each band reads back within ±2 per channel.
4. Grain sanity: with grain 0.25 on `#808080`, the 200×200 centre mean is within ±1.5 of 128, and the standard deviation is between 1.0 and 8.0 levels.
5. Gradient direction: adopt the **CSS `linear-gradient` convention** (0° runs from bottom to top, 90° from left to right, 180° from top to bottom), because designers already know it. Today the shader uses math angles (0° = left to right). Change the shader, migrate the angle in every built-in palette and template, write the convention into `contracts.md` §2, and test it: a `#000000 → #FFFFFF` gradient at 90° is black on the left edge and white on the right; at 180° it is black at the top.

## Acceptance criteria

- [ ] All colour tests pass. With the `linearToSrgb` step removed, test 1 fails (paste the output).
- [ ] Commit stills under `docs/fix-plan/evidence/F02/`: `tilted-showcase` and `phone-spotlight` (dark backgrounds now visible), `quiet-hero` (Bone), and a side-by-side comparison of a demo screenshot crop against the same crop in the render. The mid-tones must match.
- [ ] The shader audit table is in the PR.
