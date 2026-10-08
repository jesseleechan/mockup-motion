# Quality bar

"Elegant and thoughtful" has to be testable, or every agent will interpret it differently. These rules are the defaults built into templates and the limits enforced by controls. A reviewer rejects visual work that breaks them. Numbers are in stage units (frame height = 1) or as a percentage of frame height, so they hold at every resolution.

Reference feel: Jitter templates, shots.so mockups, Apple product pages, Linear and Vercel launch videos. Calm, confident, generous space, nothing bouncy or flashy.

## 1. Principles

1. **The work is the hero.** Screenshots are shown at the largest size the composition allows, color-exact and crisp. Effects support them and never compete.
2. **One idea per shot.** Each shot has a single dominant movement. Secondary motion (float, grain, background drift) stays under the threshold of attention.
3. **Motion has intent.** It starts with purpose, settles, and holds. Nothing moves linearly except marquees. Nothing reverses within a shot.
4. **Restraint over decoration.** If an effect is noticeable as an effect, it is too strong.

## 2. Motion

### 2.1 Easing vocabulary (`src/motion/easing.ts`)

| Id | Curve | Use |
|---|---|---|
| `gentle` | cubic-bezier(0.37, 0, 0.63, 1) (sine in-out) | Long camera drifts, background, float |
| `smooth` | cubic-bezier(0.65, 0, 0.35, 1) (cubic in-out) | Default camera moves, scroll segments |
| `expoOut` | cubic-bezier(0.16, 1, 0.3, 1) | Entrances, text reveals |
| `quintInOut` | cubic-bezier(0.83, 0, 0.17, 1) | Transitions, decisive pushes |
| `backOut` | cubic-bezier(0.34, 1.32, 0.64, 1) | Small UI-like pops only (cursor click). Overshoot 3% or less |
| `spring` | Analytic damped spring, ζ = 0.85, settles in 0.9 s | Device entrances in reels |
| `slide` | cubic-bezier(0.40, 0, 0.05, 1) | Carousel steps (`slider` layout). A short ease-in into a fast middle and a long, soft settle |
| `linear` | — | Marquees only |

### 2.2 Durations

- Shot: 3–7 s (default 5 s single-shot, 4 s per shot in reels). Title cards: 2–3 s. Two layouts set their own length instead: a `slider` shot lasts screenshots × step (carousel steps, below), and a Frames shot lasts at least `framesDuration` (§2.5), 15 s by default.
- Transitions: 0.5–0.9 s (default 0.7 s, `quintInOut`). Loop wrap crossfade: 0.8 s.
- Entrances: 0.7–1.0 s with `expoOut`. Stagger between sibling elements: 80–120 ms.
- Text: 0.6–0.9 s per reveal, 60–90 ms per-word stagger. Hold text fully visible for at least 1.2 s before any exit.
- Carousel steps (`slider` layout): one step per screenshot, 1.6–4.0 s per step (default 2.0 s). Step `k` starts on its step boundary, `k × step`, with a 1.85 s move on the `slide` curve, then holds for the rest of the step, so a longer step only adds hold. A step shorter than 1.85 s moves for the whole step. Position, scale and opacity follow the same progress. A slider shot lasts screenshots × step and must fit in 30 s, so the step is at most min(4.0, 30 / N) s, and a slider shows at most its first 18 screenshots (18 × 1.6 s = 28.8 s).
- Scroll: each segment between stops takes at least 1.1 s per viewport height travelled (the viewport is the device screen). Hold 0.6–1.2 s at each stop. Never scroll faster than 0.9 viewport heights per second.

### 2.3 Camera presets at `intensity = 1` (`src/motion/camera.ts`)

Default lens: **fov 22°**. Long lenses look like product photography; wide lenses distort the screenshots. Allowed range is 15–35°.

| Preset | From → To |
|---|---|
| `static` | No change (float only) |
| `pushIn` | distance 1.10 → 0.98 (about 12% scale change) |
| `pullBack` | distance 0.92 → 1.06 |
| `orbitLeft` / `orbitRight` | yaw ∓14° → ±4°, pitch 6°, distance 1.05 |
| `tiltUp` / `tiltDown` | pitch 14° → 4° (or reverse), distance 1.04 |
| `riseUp` | panY −0.06 → 0.02, pitch 8° → 3° |
| `dollyLeft` / `dollyRight` | panX +0.08 → −0.08 (scaled by aspect), yaw 6° |
| `isoDrift` | yaw 34° pitch 28° fixed, panX/panY drift 0.05 along the diagonal |
| `heroTilt` | yaw −20° → −10°, pitch 10° → 6°, roll −2° → 0°, distance 1.08 → 1.0 |

`intensity` scales the delta between from and to around the midpoint pose. Every preset must keep all screen content inside the frame at `intensity = 1` for every aspect (WP-09 adds a framing test).

### 2.4 Float

Float is optional ambient sway layered on top of the main move, the only allowed oscillation. Amplitude is at most 1.2° yaw/pitch and at most 0.4% distance. The period equals the shot duration (one cycle), using the `gentle` curve shape. It is applied only when the shot loops or is long (6 s or more).

### 2.5 Never

- Never reverse direction within a shot. The v1 zoom-in-then-out "breathing" is banned.
- Never use more than one dominant movement at once (for example, orbit plus push plus scroll). Scroll shots use a near-static camera (intensity ≤ 0.3).
- Never let marquee speed exceed 0.12 frame widths per second. The one exception is Frames (a `rows` layout with `travel: "period"`): every row moves at the same speed, alternating direction, at no more than **0.20 frame heights per second**. At the 0.12 limit a 4-screenshot Frames loop at 9:16 would need more than 30 s.
- Never use a linear camera move.
- Never let elements pop in without an entrance. Never animate opacity alone for large objects (pair it with 2–4% rise or scale 0.97 → 1). Slider cards pair their fade with the 0.75 neighbour scale.

## 3. Screens and devices

### 3.1 Screen content

- **Fit to width, always.** If the screenshot is taller than the viewport, crop the bottom (or scroll, if opted in). If it is shorter, then for desktop the viewport aspect adapts within `[1.25, 2.0]`, and for phones and tablets the content is top-aligned and the remainder filled with the screenshot's bottom-row average color. Never crop horizontally.
- Unlit material, sRGB, no tone mapping. A screenshot pixel must be identical to the source within ΔE < 1 at a frontal camera.
- **One exception: faded slider neighbours.** In the `slider` layout the active card is color-exact like any other screen. Its neighbours are a deliberate de-emphasis: scale 0.75 and 65% opacity over the background, faded as one object (screen, border and shadow together, so no body shows through). The fade mixes encoded sRGB values, as the reference does: a pixel of 15 at 65% over a background of 223 shows 88. Entrances keep blending in linear light. No other layout shows a screen faded or tinted once its entrance has finished.
- Textures are pre-downscaled to about 1.5× the largest on-screen width (2× for `master` quality) with high-quality resampling, and use mipmaps plus max anisotropy. Text inside a screenshot must not shimmer during slow camera moves (WP-03 has a check for this).
- Tall screenshots are tiled into strips of `min(maxTextureSize, 4096)` px.

### 3.2 Browser window

- Corner radius: 1.1% of window width. Hairline border: 1 px at 1080p equivalent (0.0009 stage units), `rgba(0,0,0,0.08)` light or `rgba(255,255,255,0.08)` dark.
- `standard` chrome: toolbar height 4.2% of window width (minimum 0.028 stage units). Traffic lights: diameter 0.85% of width, gap 0.55%, left inset 1.6%, colors `#FF5F57 #FEBC2E #28C840` with a 0.5 px darker ring. URL pill centered, 34% of width, height 56% of the toolbar, radius fully round, domain text in the body font at 42% of toolbar height, 55% opacity.
- `minimal`: no toolbar; traffic lights float inside the top-left corner over a 6% top fade. `none`: the screen only, with radius and border kept.
- Light toolbar `#F6F6F7`, dark `#1E1E21`.

### 3.3 Phone (generic; no Apple trademarks or exact silhouettes)

- Body aspect 0.488 (about 71.5 × 146.5 mm feel). Corner radius 15.5% of width. Bezel 3.2% of width, uniform. Screen radius equals the body radius minus the bezel.
- Edge: a thin rim with a 2-stop specular highlight along the top-left (the finish color lightened 18%), and side buttons at 0.6% of width, protruding.
- Camera pill: 27% of width wide, 7.6% of width tall, centered 2.4% below the screen top. It is drawn **inside** a 5.5%-of-height status-bar safe zone, so content is never covered unless the screenshot already includes a status bar (detected by `assets/roles.ts` from a uniform top strip; when unsure, keep the safe zone).
- Finishes: `graphite #3A3B3F`, `silver #D9DADD`, `black #121214`, `sand #CBBBA0`.

### 3.4 Tablet, laptop, card

- Tablet: screen aspect 0.75, bezel 4% of width, radius 6.5%.
- Laptop: a browser-style screen in a thin aluminium lid (bezel 1.8%) plus a base at 6% of lid height, viewed at pitch 8° or more so the base reads. Only used when the camera has pitch.
- Card: the screenshot alone with a hairline border. This is the "frameless" look. The corner radius is 1.6% of width for landscape cards and 7.5% of width for portrait (mobile) cards, which show a mobile screenshot at the phone screen aspect 0.4615.

## 4. Composition

- **Safe margin:** at least 7% of the shortest frame side around the primary subject at the shot's tightest camera pose.
- **Primary subject size:** single desktop device spans 62–74% of frame width at 16:9 and 4:3, 84–90% at 9:16, 4:5, and 1:1. A single phone spans 70–78% of frame height.
- **Responsive pair:** phone height is 78–86% of browser height, the phone overlaps the browser's right edge by 10–16% of browser width, and the phone sits 0.04 stage units in front.
- **Marquee and wall:** at most 3 rows or 5 columns visible. No asset appears twice within the same row or column window. Adjacent rows are offset by half a period. With fewer than 3 distinct assets, use the `single` or `pair` layout instead (templates enforce this through slots).
- **Slider:** cards on one axis, still camera, no tilt. The active card is centred at scale 1 and opacity 1; the others sit at scale 0.75 and opacity 0.65. Horizontal (`axis: "x"`, mobile cards): the active card is 0.63 of the frame height tall at the phone aspect 0.4615, capped at 0.52 of the frame width (the cap only comes close at 9:16). Vertical (`axis: "y"`, desktop cards): the active card is 0.84 of the frame width wide, capped at 0.50 of the frame height (binds at 16:9, 4:3 and 1:1). Centre-to-centre spacing is half the active size along the axis + gap + half the neighbour size, with a gap of 0.128 (x) or 0.115 (y) stage units at 4:5, scaled with the card at other aspects. At 4:5 this gives the reference: a 0.29 × 0.63 active card with 0.38 spacing (x), and 0.67 × 0.42 with 0.48 spacing (y). The safe margin applies to the active card; neighbours are cropped by the frame on purpose. Sliders need 3 screenshots and work best with 4–6. With fewer screenshots than visible slots, the far cards fade out instead of repeating: no screenshot appears twice in view.
- **Frames** (`rows`, `device: "card"`, tilt 0, `travel: "period"`): at 4:5, 9:16 and 1:1, 3 rows of cards 0.315 tall with a 0.065 gap between cards and between rows (pitch 0.585 along a row); the middle row is centred and the outer rows are cropped by the frame edges. At 16:9 and 4:3, 2 rows of cards 0.42 tall with the same gap, so a row window shows at most 4 cards. Adjacent rows move in opposite directions at one shared speed (the outer rows of three move left). Row r starts r/rows of a period along (half a period with 2 rows; 0, ⅓ and ⅔ with 3), so the outer rows, which move together, never line up the same screenshot. Frames needs 4 screenshots.
- **Vertical formats:** keep text and primary content inside the central 80% of the height (social UI overlays).

## 5. Light, shadow, and atmosphere

- **Shadows have two layers**, computed in a shader or baked texture (no shadow maps):
  - Contact: blur 0.6% of frame height, opacity 0.22, offset y 0.25%.
  - Ambient: blur 6% (soft) / 8% (medium) / 11% (dramatic), opacity 0.10 / 0.16 / 0.24, offset y 2.5% / 3.5% / 5%.
  - Shadow color is the background's dominant hue at 25% lightness, not black.
  - On tilted layouts the shadow projects onto a ground plane, falling off with distance.
- **Grain:** monochrome, zero-mean, 1.5–4% peak amplitude (default 2.5% at `Style.grain = 0.25`), seeded per frame index, applied after the final sRGB transfer. Zero disables grain. Positive values interpolate from 1.5% to 2.5% over `(0, 0.25]`, then to 4% over `(0.25, 1]`. Templates enable it for gradients and dark backgrounds to reduce 8-bit H.264 banding. Add ±0.5 LSB triangular dither after grain and before quantization.
- **Vignette:** 0–12% darkening at the corners (default 6%), elliptical, matched to the aspect.
- **No lens flares, bloom on screenshots, chromatic aberration, or glossy reflections across screen content.** A screen sheen (at most 4% opacity, static gradient, only on `dark` frames) is the maximum.

## 6. Color and backgrounds

- Palettes are defined in OKLCH. Gradients and mesh interpolate in OKLab (using `culori`) to avoid muddy middles.
- Built-in palettes (WP-07 finalizes them; these are starting values): **Bone** `#F1EDE6 → #E3DCD0`; **Fog** `#EEF1F4 → #D9DFE6`; **Graphite** `#141417 → #2A2A30`; **Ink** `#0D1424 → #1F2B45`; **Sage** `#E4E9E1 → #C9D3C4`; **Clay** `#EBDDD3 → #D2B8A6`; **Dusk** mesh `#1B1B2F #3A2F4F #6B4E71 #C3A6A0`; **Mist** mesh `#E9EEF5 #D7E0EE #EDE3F0 #F6EFE6`; **Ash** solid `#DFE1E3`, the flat light grey of the slider and Frames presets, used with grain 0 and vignette 0 (a flat fill cannot band).
- **Auto palette:** extract 5 dominant colors from the primary screenshot, then derive a background that complements without matching (lower chroma by 40–60%, shift lightness away from the screenshot's average by at least 0.25 L).
- Background chroma stays at or below 0.09 (OKLCH C) for light palettes and 0.12 for dark, unless the user picks a custom color. Elegance comes from low chroma.
- Mesh drift: at most 6% of the frame per loop, using integer harmonics only (loop-safe).

## 7. Typography

- Curated pairs (self-hosted, WP-10): **Inter Display / Inter**, **Instrument Serif / Inter**, **Fraunces / Inter**, **Geist / Geist**, **DM Serif Display / DM Sans**, **Space Grotesk / Inter**. Users can also upload their own fonts.
- Title 5–7% of frame height, tracking −1.5% to −2.5%, line height 1.05–1.12, weight 500–650 (display serifs 400). Subtitle 2.2–2.8%, 70% opacity. Captions and labels 1.6–1.9%, uppercase optional with +6% tracking.
- Text is never smaller than 1.6% of frame height (about 17 px at 1080p).
- Text color is auto-contrasted against the local background luminance (WCAG ≥ 4.5:1 for captions, ≥ 3:1 for titles).
- Text renders in screen space, crisp, never perspective-distorted. Max line length 22 characters for titles; wrap with balanced lines.

## 8. Review checklist (paste into visual PRs)

- [ ] Screenshot content is not cropped horizontally, and colors match the source.
- [ ] No reversing motion. Each shot has one dominant move, and the easing comes from §2.1.
- [ ] Safe margins (§4) hold at all 5 aspects. Checked on the contact sheet.
- [ ] Shadow, grain, and vignette are within §5 ranges. No banding visible on the gradient frame at 1080p export.
- [ ] Text is at least 1.6% of frame height, with contrast that passes.
- [ ] The loop is seamless: frame(0) equals frame(total) (unit test), and there is no visible pop when watching 3 loops.
- [ ] No shimmer on screenshot text during camera moves in a 1080p30 export.
