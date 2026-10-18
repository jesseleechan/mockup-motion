# Orbit plan: Desktop Orbit and Mobile Orbit

**Status: in progress.** Written 18 October 2026. O00–O03 are on branch `orbit/desktop-mobile-orbit`. O04 (gallery previews, contact sheet review, baselines) waits on the owner's answers to D1–D3 and on their written approval of the rendered stills.

On 18 October 2026 the owner reviewed five preset proposals with live previews and approved four, each built in its own session. This plan covers one of them: **Desktop Orbit** and **Mobile Orbit**, the same effect in two sizes. Screenshots sit on a ring seen from slightly above, and each step turns the next card to the front.

## 1. What has to be built

- **An `orbit` layout** (`src/motion/layouts/orbit.ts`). Card i at ring phase φ has angle θ = 2π(i − φ)/N and depth z = cos θ. It sits at x = R sin θ, scale 0.58 + 0.42 × (1 + z)/2, and y = y_front + lift × (1 − z)/2, so cards further back sit higher. Cards draw in order of z. Every card faces the camera; nothing is tilted.
- **Stepped like the sliders.** The phase is `k + p` from `sliderStep` (2.0 s per screenshot, a 1.85 s move on `slide`, then a hold), counted modulo N. After N steps the ring is back where it started, so a single shot with a `cut` wrap loops natively, and frame(N × step) is exactly frame(0). Cards move left; the next card comes in from the right.
- **Emphasis.** Only the front card is at full strength. Every other card has strength 0.65 + 0.35 × max(0, z)^4, so cards on the side and back half of the ring sit at the slider's 65%.
- **A `background` fade blend** in `DeviceFadePass` (§3, D6). The orbit's cards overlap, so a faded card has to be mixed with the background colour, not with the cards behind it.
- **Two templates**, `desktop-orbit` and `mobile-orbit`: Ash or Onyx through the Light/Dark switch, frameless cards, shadow none, grain 0, vignette 0, still camera, entrance none, `cut` wrap. Slots `desktop1`–`desktop6` or `mobile1`–`mobile6`, with the first 4 required. A shot shows at most the first 6 screenshots (`ORBIT_MAX_SCREENSHOTS`), so it never shows a screenshot twice.
- **Editor support.** The orbit uses the slider's stepped-shot rules through `isSteppedLayout` (`src/motion/layouts/duration.ts`): the duration is N × step, the camera is still, there are no Camera controls and no duration handle, and the screenshot list offers add and remove. The Layout section shows Card shape and Step length.

## 2. Reference (decision D3)

The earlier presets each copy a measured Rico Supply Jitter template (`docs/presets-plan/reference.md`). The brief named Rico's Orbit family as the natural reference. On 18 October 2026 we downloaded the first `<video>` of each product page (1080 × 1350, 60 fps) and looked at the frames. Strips are in [`evidence/reference/`](evidence/reference).

| Product                         | Loop          | What it does                                                                                                                          |
| ------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| orbit-1-01, 1-02, 1-03          | 2.2–3.0 s     | **One** card, landscape, portrait or square, spins once in its own plane around its centre, then holds. The card is tilted for most of the move. |
| orbit-2-01 … 2-03, 3-01, 3-02   | 2.4–2.55 s    | **One** card swings out of the frame around a pivot far outside it, tilted up to about 45°, and comes back in to rest.                    |
| freebie-17 ("Dual Orbit")       | 18 s          | Two flat concentric rings of many small square tiles turning in the frame's plane, seen from the front, with a title in the middle.      |

**None of them matches the approved design.** None is a ring of screenshots seen from above, and all of them tilt the screenshot in the frame's plane, which would break "screens are colour-exact" (quality bar §3.1) for the whole move. Freebie-17's tiles are thumbnails, far too small for a website screenshot. The "orbit" in Rico's names is a rotation, not a ring.

**Recommendation:** no Rico reference. The approved preview is the reference, and the numbers below are ours, recorded in quality bar §4 once the contact sheet is approved. Rico's names stay out of the product either way.

## 3. Architecture

- **A new `orbit` layout kind** (D5): `{ kind: "orbit"; assetIds; shape: "mobile" | "desktop"; step }`. No existing layout is close. A slider with a `ring` option would keep `axis`, which has no meaning on a ring, and the Stack session builds on `slider.ts` at the same time. The slider's stepped-shot rules (duration N × step, still camera, step clamp, user templates, drop to add) now take `SteppedLayout = slider | orbit`, so there is one copy of them.
- **Fading (D6).** `DeviceFadePass` composites a faded layer over the shot target as it is at that moment, which includes every card drawn before it. That is right for the slider, whose cards never overlap. On the ring, a 65% card in front of another card would show that card through itself. The new `background` blend (`fadeBlendFor`, `src/engine/devices/DeviceFade.ts`):
  1. copies the target once, after the background and before any device, as the backdrop;
  2. draws each device as its own layer, back to front, never merged with another device of the same opacity, so overlapping cards never z-fight;
  3. mixes each faded card with the backdrop in encoded sRGB, as the slider does (15 at 65% over 223 shows 88), and puts the result over the target with the layer's coverage, so the card hides what is behind it.

  The front card is opaque and is drawn directly, so it is colour-exact.

## 4. Composition

Stage units (frame height = 1, frame width W). Starting values from the approved preview, to tune on the contact sheet (D8) and then record in quality bar §4.

- **Mobile Orbit:** portrait cards at the phone screen aspect 0.4615, 7.5% radius. h0 = min(0.58, 0.42 × W / 0.4615). R = min(1.25 × card width, W/2 − 0.25 × card width). lift = 0.42 × h0.
- **Desktop Orbit:** landscape cards at 1.6. Card width = min(0.62 × W, 0.42 × 1.6). R = min(0.62 × card width, W/2 − 0.2 × card width). lift = 0.34 × h0.
- **Both:** the front card's centre is at y = −(lift − 0.21 × h0)/2, which centres the composition between the front card's bottom edge and the back card's top edge.

| Preset  | Aspect | Front card (w × h) | Card width / W | R     | lift  |
| ------- | ------ | ------------------ | -------------- | ----- | ----- |
| Mobile  | 16:9   | 0.268 × 0.580      | 15%            | 0.335 | 0.244 |
| Mobile  | 4:3    | 0.268 × 0.580      | 20%            | 0.335 | 0.244 |
| Mobile  | 1:1    | 0.268 × 0.580      | 27%            | 0.335 | 0.244 |
| Mobile  | 4:5    | 0.268 × 0.580      | 34%            | 0.333 | 0.244 |
| Mobile  | 9:16   | 0.236 × 0.512      | 42%            | 0.222 | 0.215 |
| Desktop | 16:9   | 0.672 × 0.420      | 38%            | 0.417 | 0.143 |
| Desktop | 4:3    | 0.672 × 0.420      | 50%            | 0.417 | 0.143 |
| Desktop | 1:1    | 0.620 × 0.388      | 62%            | 0.376 | 0.132 |
| Desktop | 4:5    | 0.496 × 0.310      | 62%            | 0.301 | 0.105 |
| Desktop | 9:16   | 0.349 × 0.218      | 62%            | 0.211 | 0.074 |

The first contact sheet (5 demo screenshots, t = 0, 0.9 and 2.0 s, all five aspects) is in [`evidence/contact-sheet-1/`](evidence/contact-sheet-1). What it shows:

- No faded card shows another card through itself, and the front card is the untouched screenshot.
- Mobile Orbit reads as a ring at every aspect. At 4:5 and 9:16 the outer side cards are cropped by the frame edge by up to about a quarter of their width, by design (the R formula keeps three quarters in frame), like the slider's neighbours.
- Desktop Orbit reads well at 16:9 and 4:3. At 1:1, 4:5 and 9:16 the 0.62 × W card fills the width, so the side cards overlap the front card heavily and are cropped by the frame. The ring is a band across the middle with empty space above and below, because a landscape card is short. At 4:3 a side card is cropped by about 2% of the frame width at θ = ±72° (N = 5).

## 5. Decisions

| #   | Decision                                   | Recommendation                                                                                                                                                                                                                                                                                                                                                   | Status                       |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| D1  | Stepped (previewed) or continuous rotation | **Stepped**, as previewed and built. Each screenshot holds at the front, so a viewer can read it, and the timing is the sliders', which the owner already approved. A continuous ring never shows a screenshot at rest and needs its own speed limit, as Frames' D2 did.                                                                                           | Open: owner                  |
| D2  | Ship both sizes, or Mobile Orbit only      | **Ship both.** Desktop Orbit is strong at 16:9 and 4:3, where most desktop work is shown. At the tall aspects it is a weaker composition, as Desktop Frames is at 9:16; the gallery's size suggestion already steers mobile screenshots to Mobile Orbit. If the owner prefers, at 4:5 and 9:16 the desktop card can drop to 0.56 × W to ease the overlap (one constant). | Open: owner, after the sheet |
| D3  | Reference                                  | **No Rico reference** (§2). The approved preview is the reference; record our numbers in quality bar §4.                                                                                                                                                                                                                                                        | Open: owner                  |
| D4  | Names and ids                              | "Desktop Orbit" (`desktop-orbit`) and "Mobile Orbit" (`mobile-orbit`), a size pair in `pairs.ts`, after Mobile Frames in the gallery order of the brief.                                                                                                                                                                                                         | As briefed                   |
| D5  | Layout model                               | A new `orbit` layout kind sharing the slider's stepped-shot rules (§3).                                                                                                                                                                                                                                                                                          | Recommended, built           |
| D6  | Fading with overlapping cards              | The `background` blend (§3). Extends the slider's named exception in quality bar §3.1.                                                                                                                                                                                                                                                                         | Recommended, built           |
| D7  | Visual baselines                           | 8 stills: each preset at 16:9 and 9:16, at t = 0.9 s (mid-turn, overlap and fade) and 2.4 s (at rest). **The rendered stills need the owner's written approval** in this thread before they are committed.                                                                                                                                                         | Open: owner, at O04          |
| D8  | Tuning on the contact sheet                | Keep the previewed numbers. They read well, and the crops at the tall aspects follow the slider's rule that neighbours may be cropped. Change only what the owner points at.                                                                                                                                                                                    | Open: owner, at O04          |

## 6. Tasks

| Task | Title                                                                                    | Status                                                         |
| ---- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| O00  | This plan; decisions to the owner; reference review                                      | Done: this file, [evidence/reference](evidence/reference)      |
| O01  | `orbit` layout motion, stepped-shot rules shared with the slider (pure TypeScript, tests) | Done: `tests/orbit.test.ts`                                    |
| O02  | `background` fade blend, lab fixtures (`desktop-orbit`, `mobile-orbit`, `-dark-<aspect>`) | Done: [contact-sheet-1](evidence/contact-sheet-1)              |
| O03  | Templates, gallery order, size pair, editor support, docs (`contracts.md`, quality bar)  | Done                                                           |
| O04  | Gallery previews, contact sheet at five aspects, baselines (**owner review gate**)       | Previews done; baselines wait on D7                            |

## 7. Rules for the executor

The fix plan's rules (`docs/fix-plan/README.md` §3) apply unchanged, together with the presets plan's (`docs/presets-plan/README.md` §5), except that there is no reference to match (D3). No visual baseline is committed without the owner's written approval of the rendered stills. Three other sessions are adding presets at the same time, so edits to shared files stay small and additive.
