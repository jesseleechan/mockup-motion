# WP-08: Shadows, anti-aliasing, final pass, and motion blur

**Milestone:** M1 · **Depends on:** WP-03 · **Parallel with:** 06, 07, 10 · **Size:** M

## Goal

Ground devices with soft, believable shadows, and give every frame a finished, cinematic surface: clean edges, subtle grain and vignette, no banding, and optional motion blur for exports.

## Context (read first)

- `quality-bar.md` §5 (all shadow, grain, and vignette numbers), §2.5
- `contracts.md` §7 (`renderAccumulated`, `supersample`)
- WP-03 compositor and final-pass stub; WP-07 `shadowTintFor`

## Scope

**In**

1. **Analytic soft shadows (`src/engine/shadows/`)**
   - For each device, add two shadow quads (contact and ambient) behind it. They use the closed-form Gaussian-blurred rounded-rectangle approximation (the erf-based "fast rounded rectangle shadow"), with radius matched to the device body, and blur, opacity, and offset from the `Style.shadow` preset.
   - The quads are offset along a fixed key-light direction in stage space, so the shadow moves correctly when the camera orbits.
   - Tinted with `shadowTintFor(background)`. Shadows never use shadow maps.
2. **Ground shadows for tilted groups.** For `wall`, `rows`, and `columns` with `tilt > 0`, project each device's shadow onto the group's ground plane. Blur and opacity grow with distance from the plane (fake height). Give the group's ground plane a bounded alpha so it never shows an edge.
3. **Anti-aliasing and supersampling**
   - Shot targets use MSAA 4×.
   - When `supersample > 1`, render at `output × supersample` and downsample in the final pass with a 13-tap filter (Jimenez-style) for 1.5× and 2×, avoiding the moiré a bilinear downsample gives on screenshot text.
4. **Final pass (`src/engine/post/final.ts`)**, a single fullscreen shader in this order: transition blend (from WP-03, extended by WP-14) → downsample → elliptical vignette (aspect-correct, `Style.vignette`) → monochrome grain (`Style.grain` mapped to 1.5–4% amplitude, seeded by `hash(round(t × 120))`) → triangular dither (±0.5 LSB) → output.
5. **Motion blur:** `renderAccumulated(t, shutter, samples)` renders `samples` sub-frames evenly across `[t − shutter/2, t + shutter/2]` into a `HalfFloatType` accumulation target, averages them, and then runs the final pass once. Defaults: shutter = 0.5 / fps (180°), 8 samples. Export only.

**Out:** transition styles other than fade (WP-14); the export UI toggle (WP-16).

## Acceptance criteria

- [ ] Unit tests: the shadow parameter mapping matches quality-bar §5 for every preset; the shadow tint lands within ±2 L of the specified lightness.
- [ ] Attach 1080p frames of a browser and a phone with `none`, `soft`, `medium`, and `dramatic` shadows, on Bone and Graphite. The shadows read as light falling, not a grey halo.
- [ ] **Banding:** export 3 s of a Graphite gradient plus a dark mesh at 1080p `high`. Zoomed crops (400%) show no banding with grain at 0.25, and visible banding with grain at 0 (proves the grain works).
- [ ] **Supersampling:** a 2× crop comparison of the browser toolbar and the screenshot's small text at 1 vs. 1.5 vs. 2.
- [ ] **Motion blur:** `renderAccumulated` with `shutter = 0` is pixel-identical to `renderAt`. A `dollyLeft` export shows smooth blur.
- [ ] The final pass costs ≤ 1.5 ms at 1080p, and the shadows cost ≤ 0.5 ms for 12 devices (report the GPU).
