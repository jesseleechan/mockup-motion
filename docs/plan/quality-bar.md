# Quality bar

"Elegant and thoughtful" has to be testable, or every agent will interpret it differently. These rules are the defaults built into templates and the limits enforced by controls. A reviewer rejects visual work that breaks them. Numbers are in stage units (frame height = 1) or as a percentage of frame height, so they hold at every resolution.

Reference feel: Jitter templates, shots.so mockups, Apple product pages, Linear and Vercel launch videos. Calm, confident, generous space, nothing bouncy or flashy.

## 1. Principles

1. **The work is the hero.** Screenshots are shown at the largest size the composition allows, color-exact and crisp. Effects support them and never compete.
2. **One idea per shot.** Each shot has a single dominant movement. Secondary motion (grain, background drift) stays under the threshold of attention.
3. **Motion has intent.** It starts with purpose, settles, and holds. Nothing moves linearly except Frames lanes and Page Columns' drift. Nothing reverses within a shot.
4. **Restraint over decoration.** If an effect is noticeable as an effect, it is too strong.

## 2. Motion

### 2.1 Easing vocabulary (`src/motion/easing.ts`)

| Id           | Curve                                              | Use                                                                                          |
| ------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `gentle`     | cubic-bezier(0.37, 0, 0.63, 1) (sine in-out)       | Long camera drifts, background                                                               |
| `smooth`     | cubic-bezier(0.65, 0, 0.35, 1) (cubic in-out)      | Default camera moves, scroll segments                                                        |
| `expoOut`    | cubic-bezier(0.16, 1, 0.3, 1)                      | Ease-outs (the Camera section offers it)                                                     |
| `quintInOut` | cubic-bezier(0.83, 0, 0.17, 1)                     | Loop wrap crossfade, decisive pushes                                                         |
| `backOut`    | cubic-bezier(0.34, 1.32, 0.64, 1)                  | Small UI-like pops only. Overshoot 3% or less                                                |
| `spring`     | Analytic damped spring, ζ = 0.85, settles in 0.9 s | Camera moves (the Camera section offers it)                                                  |
| `slide`      | cubic-bezier(0.40, 0, 0.05, 1)                     | Carousel steps (`slider` layout). A short ease-in into a fast middle and a long, soft settle |
| `linear`     | —                                                  | Frames lanes and Page Columns' drift only                                                    |

### 2.2 Durations

- Shot: 3–7 s (default 5 s; a video has one shot). Two layouts set their own length instead: a `slider` shot lasts screenshots × step (carousel steps, below), and a Frames shot (Desktop Frames or Mobile Frames) lasts at least `framesDuration` (§2.5), 15 s by default. A Frames shot must also fit in 30 s, so it shows at most the screenshots whose period fits 30 s at 0.20 stage units per second: for Desktop Frames, 10 with the 3-row cards (4:5, 9:16, 1:1) and 8 with the 2-row cards (16:9, 4:3); for Mobile Frames, 9 at 16:9, 4:3 and 1:1 and 10 at 4:5 and 9:16. Later ones are left out, and the inspector says so.
- Loop wrap crossfade: 0.8 s, `quintInOut`. (Shot-to-shot transitions and device entrances went with reels on 19 October 2026.)
- Carousel steps (`slider` layout, both arrangements: the carousel of the sliders and the deck of Desktop Stack and Mobile Stack): one step per screenshot, 1.6–4.0 s per step (default 2.0 s). Step `k` starts on its step boundary, `k × step`, with a 1.85 s move on the `slide` curve, then holds for the rest of the step, so a longer step only adds hold. A step shorter than 1.85 s moves for the whole step. Position, scale and opacity follow the same progress. A slider shot lasts screenshots × step and must fit in 30 s, so the step is at most min(4.0, 30 / N) s, and a slider shows at most its first 18 screenshots (18 × 1.6 s = 28.8 s). An `orbit` steps on the same timing: one step turns the ring one card, and it shows at most its first 6 screenshots. A `tour` (Site Tour) steps on it too: one step slides in the next page, and like a slider it shows at most its first 18.
- Scroll: each segment between stops takes at least 1.1 s per viewport height travelled (the viewport is the device screen). Hold 0.6–1.2 s at each stop. Never scroll faster than 0.9 viewport heights per second.
- Responsive Scroll: two screens scroll together, so each segment takes the time the screen that travels further needs at 0.9 screen heights per second, and both hold together (1.0 s by default). Defaults stop at the top and three sections both pages share (not the header or footer), each the farthest from the stops already chosen. The shot lasts holds plus moves plus the 0.8 s wrap crossfade, so the loop is holds plus moves and the fade falls inside the last hold; it fits in 30 s.
- Before & After: 1.0 s on the old design, a 2.0 s sweep on `smooth` (the new design crosses from left to right), a hold on the new design, then the 0.8 s wrap crossfade back to the old one: a 6.0 s loop, in a 6.8 s shot whose end the crossfade overlaps (2.2 s on the new design before the fade, 3.0 s with it). The sweep never reverses.
- Page Columns: every column drifts through its page at one constant speed for the whole loop, never faster than 0.5 column heights per second (§2.5), then the 0.8 s wrap crossfade returns every column to its start; the outgoing columns keep drifting under the fade, so nothing stops. The Default loop is the shortest of 12 s or more, in 0.5 s steps, at which the longest shown page keeps to the limit. The shot lasts the loop plus the 0.8 s crossfade and fits in 30 s, so the loop is at most 29.2 s; past that, a column travels only as far as the limit allows (from its start: the top, or the bottom for a column moving down). With the demo pages: Desktop 12 s at every aspect; Mobile 13.5 s at 16:9, 13 s at 4:3 and 12 s at 1:1, 4:5 and 9:16.
- Pace (`Shot.pace`, `src/motion/pace.ts`): every looping preset offers **Calm**, **Default** and **Brisk**. Default is the timing above; Calm is ×1.2 and Brisk ×0.8 on time, the same pair for every preset. The value is rounded, then clamped by the preset's limits:

  | Preset                          | Knob            | Brisk         | Default                     | Calm          | Limits                                                                      |
  | ------------------------------- | --------------- | ------------- | --------------------------- | ------------- | --------------------------------------------------------------------------- |
  | Slider, Stack, Orbit, Site Tour | `layout.step`   | 1.6 s         | 2.0 s                       | 2.4 s         | 0.1 s steps; 1.6–4.0 s and shown N × step ≤ 30 s (an orbit shows at most 6) |
  | Frames                          | `shot.duration` | Default × 0.8 | max(15 s, `framesDuration`) | Default × 1.2 | 0.5 s steps; at least `framesDuration` (the §2.5 speed limit), at most 30 s |
  | Responsive Scroll               | `scroll.hold`   | 0.8 s         | 1.0 s                       | 1.2 s         | 0.1 s steps; the moves already run at the scroll speed limit, so they stay  |
  | Before & After                  | `shot.duration` | 5.6 s         | 6.8 s                       | 8.0 s         | the 6.0 s loop × pace in 0.1 s steps, plus the 0.8 s wrap crossfade         |
  | Page Columns                    | `shot.duration` | Default × 0.8 | loop (above) + 0.8 s        | Default × 1.2 | the loop in 0.5 s steps; at least the §2.5 speed limit's, at most 29.2 s    |

  Page Columns scales its loop, not the 0.8 s crossfade, and Brisk may go under the Default's 12 s (12 × 0.8 = 9.5 s) as long as the longest page keeps to the speed limit. Where a limit makes Calm or Brisk equal Default, the inspector shows that option as unavailable with its reason: "Already at the speed limit" for Brisk (Frames from about 5 screenshots, a slider with 18, Page Columns once its longest page sets a loop over 12 s) and "No room in 30 s" for Calm (a slider with 15 or more, ten phones at 4:5, Page Columns once its Default loop is 29.2 s). The pace is stored, not derived: the step, duration or hold is recomputed from it after every edit, so a choice survives an aspect change or adding and removing screenshots. A project saved before paces existed takes the pace nearest its saved timing once, on load; ties go to Default. Scroll Story has no pace (`follow-ups.md`).

### 2.3 Camera presets at `intensity = 1` (`src/motion/camera.ts`)

Default lens: **fov 22°**. Long lenses look like product photography; wide lenses distort the screenshots. Allowed range is 15–35°.

| Preset   | From → To                                     |
| -------- | --------------------------------------------- |
| `static` | No change                                     |
| `pushIn` | distance 1.10 → 0.98 (about 12% scale change) |

The editor offers these two as Still and Push in. On 19 October 2026 the owner cut the other ten moves (pull back, orbit, tilt, rise, dolly, isometric drift and hero tilt), which no template used: the product is flat, looping presets. A saved project that uses one loads with `static`.

`intensity` scales the delta between from and to around the midpoint pose. Every preset must keep all screen content inside the frame at `intensity = 1` for every aspect (WP-09 adds a framing test).

### 2.4 Float

Cut on 26 October 2026 ([#113](https://github.com/jesseleechan/mockup-motion/pull/113)): the camera has no ambient sway, so nothing in a shot oscillates, and a saved project's float is dropped.

### 2.5 Never

- Never reverse direction within a shot. The v1 zoom-in-then-out "breathing" is banned.
- Never use more than one dominant movement at once (for example, orbit plus push plus scroll). Scroll shots use a near-static camera (intensity ≤ 0.3).
- Never let a Frames lane (a `rows` or `columns` layout: Desktop Frames and Mobile Frames) move faster than **0.20 stage units (frame heights) per second** along its motion axis. Every row or column moves at the same speed, alternating direction. Desktop Frames' rows move sideways and Mobile Frames' columns move vertically under the same limit, so the two presets are one effect. (The tilted marquees' 0.12 frame widths per second went with them on 19 October 2026.)
- Never let a Page Columns column drift faster than **0.5 column heights per second**, calmer than a scroll's 0.9 because it never stops (presets round two, D10). Each column has its own constant speed, its page's travel over the loop; neighbours move in opposite directions.
- Never use a linear camera move.
- Never animate opacity alone for large objects (pair it with 2–4% rise or scale 0.97 → 1). Slider cards pair their fade with the 0.75 neighbour scale. The card entering a deck's last slot (Desktop Stack, Mobile Stack) pairs its fade with its move and scale into that slot.

## 3. Screens and devices

### 3.1 Screen content

- **Fit to width, always.** If the screenshot is taller than the viewport, crop the bottom (or scroll, if opted in). If it is shorter, then for desktop the viewport aspect adapts within `[1.25, 2.0]`, and for phones the content is top-aligned and the remainder filled with the screenshot's bottom-row average color. Never crop horizontally.
- Unlit material, sRGB, no tone mapping. A screenshot pixel must be identical to the source within ΔE < 1 at a frontal camera.
- **One exception: faded slider neighbours.** In the `slider` layout the active card is color-exact like any other screen. Its neighbours are a deliberate de-emphasis: scale 0.75 and 65% opacity over the background, faded as one object (screen, border and shadow together, so no body shows through). The fade mixes encoded sRGB values, as the reference does: a pixel of 15 at 65% over a background of 223 shows 88. Entrances keep blending in linear light. **The orbit extends this exception:** only its front card is at full strength and colour-exact; every other card is mixed with the background colour at a strength of 0.65 + 0.35 × max(0, z)^4 (z = 1 at the front, −1 at the back), in encoded sRGB like the slider. The mix is with the background, never with the cards behind, and each card covers what is behind it, so overlapping cards never show through each other. No other layout shows a screen faded or tinted, except while a deck's entering card fades in during a step (§4); that fade blends in linear light.
- Textures are pre-downscaled to about 1.5× the largest on-screen width (2× for `master` quality) with high-quality resampling, and use mipmaps plus max anisotropy. Text inside a screenshot must not shimmer during slow camera moves (WP-03 has a check for this).
- Tall screenshots are tiled into strips of `min(maxTextureSize, 4096)` px.

### 3.2 Browser window

- Corner radius: 1.1% of window width. Hairline border: 1 px at 1080p equivalent (0.0009 stage units), `rgba(0,0,0,0.08)` light or `rgba(255,255,255,0.08)` dark.
- `standard` chrome: toolbar height 4.2% of window width (minimum 0.028 stage units). Traffic lights: diameter 0.85% of width, gap 0.55%, left inset 1.6%, colors `#FF5F57 #FEBC2E #28C840` with a 0.5 px darker ring. URL pill centered, 34% of width, height 56% of the toolbar, radius fully round, domain text in Inter Regular (+2% tracking) at 42% of toolbar height, 55% opacity.
- `none`: the screen only, with radius and border kept. (A `minimal` chrome, floating traffic lights and no toolbar, was removed on 19 October 2026; saved ones load as `standard`.)
- Light toolbar `#F6F6F7`, dark `#1E1E21`.

### 3.3 Phone (an iPhone Pro, front on)

The owner decided on 18 October 2026 that the phone looks like a current iPhone Pro: MockupMotion is for presenting their own work, so the earlier "generic, no Apple silhouettes" rule no longer applies. The dimensions live in `src/motion/phone-spec.ts`.

- Body 71.9 × 150 mm: aspect 0.481 with the 0.4615 screen. The border around the screen is uniform, 3.7% of the body width: a metal frame (1.2%) with a rounded-edge highlight and a dark seam, then black glass. Corners are concentric: the screen radius is 15.4% of the screen width (62 pt of 402 pt), and the body radius is that plus the border. Depth 8.75 mm (5.8% of the height), capped at 0.036 stage units so a phone in the pair layout stays in front of the browser.
- Dynamic Island: 31.3% × 9.2% of the screen width, 2.7% below the screen top, pure black with the front camera lens at its right end.
- Buttons stand 0.6% of the width proud: the Action button and volume buttons on the left, the side button on the right, at the iPhone's positions.
- **Status bar.** The top 62 pt of the 874 pt screen (7.1%). A screenshot without a status bar starts below it: the bar shows "9:41", signal, Wi-Fi and a full battery over the screenshot's top-row colour, in black on a light colour and white on a dark one, like iOS. So content is never covered by the island. A screenshot that already includes a status bar (detected by `assets/roles.ts`) fills the whole screen, and its own status bar stays pinned while the page scrolls. Scroll speeds are measured against the viewport below the status bar.
- Finish: Silver, frame colour `#D9DADC`. The other finishes (Black Titanium, black, Desert Titanium) and the Device finish control were removed on 19 October 2026; saved finishes load as Silver. The tablet and laptop body is silver `#D9DADD`.

### 3.4 Card

- Card: the screenshot alone with a hairline border. This is the "frameless" look. The corner radius is 1.6% of width for landscape cards and 7.5% of width for portrait (mobile) cards, which show a mobile screenshot at the phone screen aspect 0.4615. Mobile Slider and Mobile Frames use the same portrait card. Page Columns' cards take their radius from their pages' size, not their shape: a desktop page in a tall column keeps 1.6%, a mobile page 7.5%.

## 4. Composition

- **Safe margin:** at least 7% of the shortest frame side around the primary subject at the shot's tightest camera pose.
- **Primary subject size:** single desktop device spans 62–74% of frame width at 16:9 and 4:3, 84–90% at 9:16, 4:5, and 1:1. A single phone spans 70–78% of frame height.
- **Frames lanes:** at most 3 rows or 5 columns visible. No asset appears twice within the same row or column window.
- **Slider:** cards on one axis, still camera, no tilt. The active card is centred at scale 1 and opacity 1; the others sit at scale 0.75 and opacity 0.65. Horizontal (`axis: "x"`, mobile cards): the active card is 0.63 of the frame height tall at the phone aspect 0.4615, capped at 0.52 of the frame width (the cap only comes close at 9:16). Vertical (`axis: "y"`, desktop cards): the active card is 0.84 of the frame width wide, capped at 0.50 of the frame height (binds at 16:9, 4:3 and 1:1). Centre-to-centre spacing is half the active size along the axis + gap + half the neighbour size, with a gap of 0.128 (x) or 0.115 (y) stage units at 4:5, scaled with the card at other aspects. At 4:5 this gives the reference: a 0.29 × 0.63 active card with 0.38 spacing (x), and 0.67 × 0.42 with 0.48 spacing (y). The safe margin applies to the active card; neighbours are cropped by the frame on purpose. Sliders need 3 screenshots and work best with 4–6. With fewer screenshots than visible slots, the far cards fade out instead of repeating: no screenshot appears twice in view. The lit cards stay centred on the active one: with an even number of screenshots, one fewer is lit (with 4, one card each side), so the frame is balanced. A slider shot has no camera controls; its camera is always still.
- **Desktop Frames** (`rows`, `device: "card"`, tilt 0, `travel: "period"`; template id `frames`): at 4:5, 9:16 and 1:1, 3 rows of cards 0.315 tall with a 0.065 gap between cards and between rows (pitch 0.585 along a row); the middle row is centred and the outer rows are cropped by the frame edges. At 16:9 and 4:3, 2 rows of cards 0.42 tall with the same gap, so a row window shows at most 4 cards. Adjacent rows move in opposite directions at one shared speed (the outer rows of three move left). Row r starts r/rows of a period along (half a period with 2 rows; 0, ⅓ and ⅔ with 3), so the outer rows, which move together, never line up the same screenshot. Odd rows show the screenshots in reverse order (2, 1, N, N − 1, …), so adjacent rows never line up as two copies of one row. **One exception to the column rule above:** adjacent rows move in opposite directions over the same screenshots, so they pass each other and, for a moment, can stack the same screenshot in one column. With the reversed order they cross one card at a time: each time the cards of two adjacent rows line up, at most one stacked pair per period shows the same screenshot (two with an even number of screenshots, never side by side). No row order avoids it entirely while the rows share their screenshots, and it is allowed (owner, 8 October 2026, P05; reversed order approved in the PF04 review, 9 October 2026). Frames needs 4 screenshots.
- **Mobile Frames** (`columns`, `device: "card"`, tilt 0, `travel: "period"`): Desktop Frames turned 90°, with mobile screenshots on portrait cards (§3.4) in columns. The gap is 0.065 between cards and between columns, as in Desktop Frames. Column counts and card widths per aspect:
  - 16:9: 5 columns of cards 0.269 wide.
  - 4:3: 4 columns, 0.253 wide.
  - 1:1: 3 columns, 0.258 wide.
  - 9:16: 2 columns, 0.222 wide.
  - 4:5: 3 columns, 0.246 wide.

  At 16:9, 4:3, 1:1 and 9:16 every column is fully visible, with side margins of 4.8% of the frame width, the margins Desktop Frames' two rows leave at 16:9. At 4:5 the middle column is centred and the outer columns are cropped by 14% of their width, as the reference crops its outer rows. Cards are 0.48–0.58 of the frame height tall, so a column shows 1.5–1.8 cards. Adjacent columns move in opposite directions at one shared speed, and the left column moves up. Column c starts c/columns of a period along, so columns that move together never line up the same screenshot. Odd columns show the screenshots in reverse order, as odd rows do, and the passing-lanes exception above applies to adjacent columns too. Mobile Frames needs 4 screenshots. The PF04 contact sheet review may change a card width by at most ±10%; any change is recorded here (`docs/phone-frames-plan/README.md` §3).

- **Desktop Stack and Mobile Stack** (`slider` with `arrangement: "deck"`, tilt 0, still camera; `docs/stack-plan/README.md`): a deck of flat cards. Each step the front card leaves the frame and every other card moves forward one slot, on the carousel step timing (§2.2). In view at rest: the front card plus the ones behind it, `depth = min(3, N − 1)` cards in all (1 with one screenshot), so with 3 screenshots the leaving card, the front card and the entering card are three different screenshots. The card r slots back is scaled 1 − 0.06 r and offset along the peek direction by r × peek, so its edge shows past the card in front, at full colour. The card entering slot depth − 1 fades in from opacity 0 with its move and scale (it comes from slot depth); the front card keeps scale 1 and leaves until its trailing edge is 0.03 stage units past the frame edge.
  - Desktop Stack (`axis: "y"`, landscape cards): back cards peek out **below**, peek = 0.12 × card height; the front card leaves **up**, as Desktop Slider steps up. Card height = min(0.84 × W / 1.6, 0.86 / (1 + (depth − 1) × 0.12)) (the preview had 0.8; raised to 0.86 in the S04 review so the front card spans 62% of the frame width at 16:9), width = 1.6 × height (W = frame width in stage units).
  - Mobile Stack (`axis: "x"`, portrait cards at the phone screen aspect 0.4615, §3.4): back cards peek out to the **right**, peek = 0.20 × card width; the front card leaves **left**, as Mobile Slider moves. Card width = min(0.7 × 0.4615, 0.86 × W / (1 + (depth − 1) × 0.2)).
  - The deck at rest (front card plus peeks) is centred in the frame and keeps the safe margin. The S04 contact sheet review may tune these numbers; any change is recorded here.

- **Orbit** (`orbit`; Desktop Orbit and Mobile Orbit, `docs/orbit-plan/README.md`): the screenshots on a ring seen from slightly above, still camera, cards always facing the camera (never tilted). Card i at phase φ has angle θ = 2π(i − φ)/N, x = R sin θ, depth z = cos θ, scale 0.58 + 0.42 × (1 + z)/2, and sits lift × (1 − z)/2 higher than the front card; nearer cards draw over further ones. The front card's centre is (lift − 0.21 × h0)/2 below the frame centre, so the ring is centred between the front card's bottom and the back card's top (h0 = front card height). Each step turns the next card in from the right. Mobile Orbit: portrait cards at 0.4615, h0 = min(0.58, 0.42 × frame width / 0.4615), R = min(1.25 × card width, frame width/2 − 0.25 × card width), lift = 0.42 × h0. Desktop Orbit: landscape cards, card width = min(0.62 × frame width, 0.672), R = min(0.62 × card width, frame width/2 − 0.2 × card width), lift = 0.34 × h0. Side cards may be cropped by the frame edge, as slider neighbours are. Orbits need 4 screenshots, read best with 5–6, and show at most the first 6, each once. These are the approved preview's values, kept unchanged in the O04 contact sheet review (owner, 19 October 2026).

- **Site Tour** (`tour`; Desktop Site Tour and Mobile Site Tour, `docs/presets-2-plan/README.md` D3–D5): the pages of one site in one browser or phone, still camera, Ash or Onyx, Scroll Story's soft shadow, grain 0, vignette 0. The device is the single-device size above, centred: the browser 0.68 of the frame width wide at 16:9 and 4:3 and 0.86 at 1:1, 4:5 and 9:16 (81%, 60%, 57%, 46% and 32% of the frame height with its toolbar), the phone 0.74 of the frame height tall at every aspect (20%, 27%, 36%, 44% and 63% of the frame width). Each step the next page slides in from the right while the current one leaves to the left, edge to edge, both clipped to the screen, on the carousel step timing (§2.2): a 1.85 s move on `slide`, then a hold. The browser's screen takes the first page's aspect (§3.1); every page is fit to its width and shows its top. One URL in the pill for the whole tour (`style.browserUrl`). Site Tour needs 3 pages of one size and shows each once. These are the approved preview's values; the T1 contact sheet review may tune them, and any change is recorded here.

- **Before & After** (`compare`; Desktop Before & After and Mobile Before & After, `docs/presets-2-plan/README.md` D6–D8): an old and a new design of one page on Site Tour's device, the single browser or phone above, centred and still, Ash or Onyx, Scroll Story's soft shadow, grain 0, vignette 0. Both designs are fit to the screen's width and show their top; the browser's screen takes the new design's aspect (§3.1). The new design sweeps across the old one from left to right (§2.2). Before & After needs 2 screenshots of one size; the first in Library order is the old design. The divider and the labels are drawn over the screen, so the screenshots under them stay unlit and colour-exact; both blend in linear light.
  - **Divider:** a plain white line across the whole screen at the sweep's edge, no handle, with a soft black shadow from its edges (22% at the edge, falling off as a Gaussian whose sigma is the line's width). It is 0.4% of the screen's width and at least 0.35% of the frame height. It shows only while the sweep runs, fading in over the first 2% of the screen it crosses and out over the last 2%.
  - **Labels:** "Before" in the bottom-right corner of the old design and "After" in the bottom-left of the new one, each drawn only where its design is, so the sweep reveals "After" and covers "Before". They sit at the bottom because most sites put their logo at the top left (T2 contact-sheet review). White Inter Medium (500) on a pill of `#111114` at 90%, which in linear light looks like the preview's 72% in sRGB over a light page, with a hairline ring inside its edge so it reads on a dark page: white at 12%, 0.05 em wide (1 px at 1080p). The pill is 2.1 em tall with 0.9 em of padding either side of the text, fully round, and inset 1.2 em from the screen's bottom and side edges. On a phone it stays above the home indicator's area, the bottom 34 pt of the 874 pt screen (the engine draws no indicator), which keeps it clear of the 62 pt corner rounding. The text is 1.75% of the screen's width and at least 1.85% of the frame height, so a label stays legible on a small screen.

  | Before & After (stage units: frame heights) | 16:9           | 4:3            | 1:1            | 4:5            | 9:16           |
  | ------------------------------------------- | -------------- | -------------- | -------------- | -------------- | -------------- |
  | Browser: label text (of the screen's width) | 0.0212 (1.75%) | 0.0185 (2.04%) | 0.0185 (2.15%) | 0.0185 (2.69%) | 0.0185 (3.82%) |
  | Browser: divider                            | 0.0048         | 0.0036         | 0.0035         | 0.0035         | 0.0035         |
  | Phone: label text (of the screen's width)   | 0.0185 (5.6%)  | 0.0185 (5.6%)  | 0.0185 (5.6%)  | 0.0185 (5.6%)  | 0.0185 (5.6%)  |
  | Phone: divider                              | 0.0035         | 0.0035         | 0.0035         | 0.0035         | 0.0035         |

  At 1080p the 16:9 browser's labels are 23 px text on 48 px pills, and the phone's 20 px on 42 px. These are the preview's values, read at its 430 px stage, where an 8 px floor set most labels; the T2 contact sheet review may tune them, and any change is recorded here.

- **Scroll Story** (`single`, one tall screenshot, scroll stops `[0, 0.33, 0.66, 1]` with 0.8 s holds, `pushIn` at intensity 0.2, Fog, no loop): Desktop Scroll Story uses the browser window, Mobile Scroll Story the phone (§3.3), at the single-device sizes above. The shot lasts 10 s, or longer when the page needs it to stay under the §2.2 scroll limit, rounded up to 0.5 s.

- **Responsive Scroll** (`responsive`, cards, still camera; template id `responsive-scroll`): a desktop card at the 1.6 screen aspect and a mobile card at 0.4615 (7.5% radius) of the same page. Side by side at 16:9, 4:3 and 1:1: desktop left, a 0.05 gap, card height min(0.66, (0.86 × W − 0.05) / 2.0615), where W is the frame width. Stacked at 4:5 and 9:16: desktop on top, 0.86 × W wide, a 0.04 gap, mobile height min(0.86 − desktop height − 0.04, 0.6). The pair is centred. Ash or Onyx, no shadow, grain 0, vignette 0 (owner, 18 October 2026).

- **Page Columns** (`pageColumns`, cards, still camera; Desktop Page Columns and Mobile Page Columns, `docs/presets-2-plan/README.md` D9–D11): full pages side by side, one per column, each fit to its column's width (never cropped at the sides) and drifting through its page (§2.2). Mobile has 3 columns at 16:9, 4:3 and 1:1 and 2 at 4:5 and 9:16. Desktop has 3 at 16:9 and 4:3, 2 at 1:1 and 1 at 4:5 and 9:16, which shows the first page: in columns as narrow as mobile ones a desktop page is shorter than its column, so it never drifts (owner, 26 October 2026). With fewer pages, fewer columns share the same span. The columns are centred, with a 0.035 gap. Desktop: each column takes an equal share of 0.86 × W (W = frame width) and is 0.84 tall. Mobile: 0.8 tall and min(that share, 0.8 × 0.4615) wide, so no wider than a phone screen. A page shorter than its column, such as a hero, shows whole on a card as tall as the page, centred, and stays still. Ash or Onyx, no shadow, grain 0, vignette 0. These are the shortlist preview's numbers, kept after the T3 contact sheet except desktop's column counts at 1:1, 4:5 and 9:16:

  | Aspect | Desktop columns | Desktop column (w × h) | Mobile columns | Mobile column (w × h) | Mobile group / W |
  | ------ | --------------- | ---------------------- | -------------- | --------------------- | ---------------- |
  | 16:9   | 3               | 0.486 × 0.84           | 3              | 0.369 × 0.80          | 66%              |
  | 4:3    | 3               | 0.359 × 0.84           | 3              | 0.359 × 0.80          | 86%              |
  | 1:1    | 2               | 0.413 × 0.84           | 3              | 0.263 × 0.80          | 86%              |
  | 4:5    | 1               | 0.688 × 0.84           | 2              | 0.327 × 0.80          | 86%              |
  | 9:16   | 1               | 0.484 × 0.84           | 2              | 0.224 × 0.80          | 86%              |

  A desktop column shows 1440 / w × h px of a 1440 px page: about 2,490 px at 16:9, 3,370 at 4:3, 2,930 at 1:1, 1,760 at 4:5 and 2,500 at 9:16, so shorter pages fit whole. The demo desktop pages (3,507–4,183 px) drift at every aspect. Page Columns needs 2 full pages of one size and shows at most 3, each once.

- **Vertical formats:** keep primary content inside the central 80% of the height (social UI overlays).

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

- Palettes are defined in OKLCH. Gradients interpolate in OKLab (using `culori`) to avoid muddy middles.
- Built-in palettes (WP-07 finalizes them; these are starting values): **Bone** `#F1EDE6 → #E3DCD0`; **Fog** `#EEF1F4 → #D9DFE6`; **Graphite** `#141417 → #2A2A30`; **Ink** `#0D1424 → #1F2B45`; **Sage** `#E4E9E1 → #C9D3C4`; **Clay** `#EBDDD3 → #D2B8A6`; **Ash** solid `#DFE1E3`, the flat light grey of the slider and Frames presets, used with grain 0 and vignette 0 (a flat fill cannot band); **Onyx** solid `#141417` (Graphite's first stop), their dark option, with the same grain 0 and vignette 0. The Video inspector's Background control offers each preset's Light and Dark fills (Ash and Onyx; Fog and Graphite for Scroll Story) or a custom flat colour. Dark fills set `frameAppearance: "dark"` so the card hairline is white at 8%, which keeps a near-black screenshot's edge visible on the near-black fill; a custom colour below OKLCH L 0.5 does the same.
- **Auto palette:** extract 5 dominant colors from the primary screenshot, then derive a background that complements without matching (lower chroma by 40–60%, shift lightness away from the screenshot's average by at least 0.25 L).
- Background chroma stays at or below 0.09 (OKLCH C) for light palettes and 0.12 for dark, unless the user picks a custom color. Elegance comes from low chroma.
- Backgrounds are a solid or a gradient. Mesh, ambient (blurred screenshot) and image backgrounds were removed on 19 October 2026; saved ones load as a gradient of the mesh's colours or as Ash (`contracts.md` §2).

## 7. Typography

Removed (owner, 19 October 2026). Videos carry no text layers, title cards or brand fonts. The only text drawn is the domain in the browser URL pill (§3.2), set in Inter, which the UI also uses.

## 8. Review checklist (paste into visual PRs)

- [ ] Screenshot content is not cropped horizontally, and colors match the source.
- [ ] No reversing motion. Each shot has one dominant move, and the easing comes from §2.1.
- [ ] Safe margins (§4) hold at all 5 aspects. Checked on the contact sheet.
- [ ] Shadow, grain, and vignette are within §5 ranges. No banding visible on the gradient frame at 1080p export.
- [ ] The loop is seamless: frame(0) equals frame(total) (unit test), and there is no visible pop when watching 3 loops.
- [ ] No shimmer on screenshot text during camera moves in a 1080p30 export.
