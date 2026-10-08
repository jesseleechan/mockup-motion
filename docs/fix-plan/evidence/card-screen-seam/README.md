# Card screen seam: evidence

P02 and P04 showed a light dotted diagonal, or a light line, across card screens. It was logged as z-fighting between the screen and the card's body slab. It is not.

## Cause

The screen shader (`src/engine/materials/screen.ts`) anti-aliases its rounded corners with `smoothstep(-delta, delta, d)`, where `d` is the rounded box's signed distance and `delta = 0.7 * fwidth(d)`. On the box's medial axis (the 45° lines in from the corners, and the centre line of a non-square box) `d` can be exactly flat across a 2 × 2 pixel quad, so `fwidth(d)` is 0. `smoothstep(0, 0, d)` is undefined in GLSL. SwiftShader returns 1, which made `alpha` 0, and the shader discarded the quad. The light slab behind the screen showed through: a dotted 45° line where single quads hit the diagonal exactly, or a solid line when a card's centre row does.

How this was established, on `/lab` stills (SwiftShader, as in CI):

- With the slab coloured pure red, the line turned red: the slab showed through.
- With discarded fragments drawn blue instead, the line turned blue: the screen discarded them. No other screen pixel did.
- Drawing fragments with `delta == 0.0` magenta marked exactly the line's pixels (520 on Frames 4:5 at 1080 px, t = 10 s).
- Depth is not involved: the shot targets have a 24-bit depth buffer, and at the default camera one depth step is about 1.5e-6 stage units. The 0.0004 gap between the screen and the slab is about 250 steps, under tilted cameras too. Moving the screen to z = 0.002 only appeared to fix it: the move shifts the projection, so the quads no longer line up with the axis in that frame.

## Fix

`aaStep(w, x)` returns `smoothstep(-w, w, x)` for `w > 0` and `step(0, x)` for `w = 0`, which is the ramp's limit. The screen edge and the hairline border both use it. Every fragment with a non-zero `fwidth` renders exactly as before. The card's geometry and depth are unchanged. Every device screen uses this material, so browsers, phones, tablets and laptops get the same fix.

## Stills

Rendered with `engine.renderAt(t)` and `engine.readPixels()` in `/lab` (supersample 1) from the `frames-4x5` lab fixture, with the shader before and after the fix.

- `frames_4x5_1200_t10_before.webp`, `frames_4x5_1200_t10_after.webp`: Frames 4:5 at 1200 × 1500, t = 10 s. Before: the dotted diagonal from the middle card's bottom-left corner (as in P04's crop). After: gone. The two frames differ in 184 pixels, all on that diagonal (bounding box 228,752 to 453,977).
- `frames_4x5_1200_t10_crop_before-left_after-right.webp`: that diagonal at 2× (nearest neighbour), before on the left and after on the right.
- `frames_4x5_1080_t10_crop_before-left_after-right.webp`: Frames 4:5 at 1080 × 1350, t = 10 s, at 2×. The middle row's cards sit on the frame's centre row, so the line through the card's centre shows. Before the fix it showed in all 31 frames sampled every 0.5 s over the 15 s loop, 518 to 1040 pixels each. After the fix none show.

At 1200 px wide, Frames 1:1 and 16:9 rendered identically before and after over the same 31 frames. At 4:5, 5 frames changed, each by those 184 pixels.

## Visual baselines

All 79 visual stills, rendered locally (Windows, SwiftShader) before and after the fix, are bit-identical. The committed Linux baselines are unchanged.

## Tests

`tests/e2e/devices.spec.ts`:

- "card screens hide the slab behind them, frontal and tilted" renders flat grey cards at Frames 4:5 1080 px t = 10, slider-y 1:1 1200 px t = 0 (P02's still), a single card at 1:1 1079 px, card rows at 16:9 1276 px and 1:1 1084 px (t = 0.5), and, as off-axis checks, heroTilt at t = 0 and 5 and card rows tilted 8°. It fails if any pixel inside a screen differs from the grey (`screenLeaks` in `tests/helpers/pixels.ts` scans rows and columns). With the fix reverted, the five frontal cases fail.
- "a card screen stays opaque where its edge distance is flat" sets every UV of the card's screen mesh to (0.5, 0.5), so `fwidth(d)` is 0 on every fragment and the test does not depend on where rounding puts a quad. With the fix reverted the whole screen is discarded (0 grey pixels).
