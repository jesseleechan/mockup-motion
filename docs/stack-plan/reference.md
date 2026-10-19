# Reference measurements

Desktop Stack and Mobile Stack rebuild the idea of a Rico Supply Jitter template from the Stack family. We copy the idea, not their files, names or branding. Rico's names stay in these planning docs only, never in the product.

The design the owner approved on 18 October 2026 (the preset shortlist, [preview](https://claude.ai/artifact/Sh1TVUML9ToqKKfWmSNC9Y)) came first; the reference is measured here so the owner can choose, per difference, between the preview and the reference (README §2, D3).

## The Stack family

Every Stack preview is 1080 × 1350 (4:5), 60 fps. `x-01` is landscape cards, `x-02` portrait cards, `x-03` square cards. Strips of 8 frames (0 to 1.28 s, every 0.18 s) are in [`evidence/S00/`](evidence/S00).

| Family                                                                                                 | Loop  | What the front card does                                                                                                        | Fits our design?                                                                                   |
| ------------------------------------------------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Stack 1-01](https://rico.supply/products/stack-1-01)                                                  | 1.5 s | Drops below the deck, then rises again and tucks in at the back. Nothing leaves the frame.                                      | No. The card goes down and comes back up: a reversal (quality bar §2.5).                           |
| [Stack 2-01](https://rico.supply/products/stack-2-01), [2-02](https://rico.supply/products/stack-2-02) | 1.5 s | Drops out of the bottom of the frame while the deck moves forward one slot, and a new card slides out from behind the last one. | **Yes.** It is the approved design: the front card leaves and the deck moves forward. Recommended. |
| [Stack 3-01](https://rico.supply/products/stack-3-01)                                                  | 1.0 s | Drops a little while growing, then slides back up behind the deck.                                                              | No, for the same reason as Stack 1.                                                                |

## Stack 2-01 (landscape cards) and 2-02 (portrait cards)

Measured on 18 October 2026 as in `docs/presets-plan/reference.md`: the preview MP4 (the first `<video>` on the product page, a `framerusercontent.com/...mp4` URL) decoded at 20 fps, and each frame scanned row by row for pixels darker than the background. Stage units as in `contracts.md` §3 (frame height = 1, a 4:5 frame is 0.8 wide).

### Composition at rest

| Measure                         | 2-01 (landscape)                                                                                                          | 2-02 (portrait)                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Front card                      | 707 × 440 px = 0.524 × 0.326 stage (0.655 frame widths)                                                                   | 389 × 848 px = 0.288 × 0.628 stage (0.36 frame widths)          |
| Card aspect                     | 1.61                                                                                                                      | 0.459, our phone screen aspect (0.4615); the Mobile Slider card |
| Cards in view                   | front + 3 behind                                                                                                          | front + 3 behind                                                |
| Scale of the cards behind       | 0.90, 0.80, 0.70 (−0.10 per slot)                                                                                         | about the same                                                  |
| Where the back cards peek out   | **above** the front card                                                                                                  | **above** the front card                                        |
| Top edge above the front card's | 0.030, 0.052, 0.067 stage                                                                                                 | 0.030, 0.054, 0.069 stage                                       |
| Centring                        | the **front card** is centred in the frame                                                                                | the front card is centred                                       |
| Look                            | flat `#DFE1E3`, no shadow, no tilt, still camera; back cards show no dimming (the coloured `3-03` cards keep full colour) | same                                                            |

### Motion (2-01; 2-02 is the same)

- **Direction:** the front card moves **down** and out of the bottom of the frame; the deck moves down and forward one slot.
- **The leaving card** accelerates down from t = 0, crosses the frame's bottom edge at about 0.5 s, and eases to rest just below the frame at about 1.45 s. It travels 0.66 stage (its top edge goes from 0.337 to the bottom edge, 1.0). It grows to about 1.07 as it leaves.
- **The deck** moves on almost the same curve: each card goes to the next slot's position and scale.
- **The new back card** is not faded: it starts hidden behind the last card at the next scale down (0.66 at t = 0.55 s) and slides out above it.
- **Timing:** both curves fit our `slide` easing (cubic-bezier(0.40, 0, 0.05, 1)) over **1.3–1.4 s**, max error 0.02 (leaving card) and 0.03 (deck). Free fits give cubic-bezier(0.50, 0, 0, 1) over 1.45 s (max error 0.011) and cubic-bezier(0.35, 0, 0, 1) from 0.025 s over 1.45 s (0.018). So it is the sliders' curve, played faster: a 1.5 s step instead of 2.0 s.

| t (s)                  | 0.10 | 0.20 | 0.30 | 0.35 | 0.40 | 0.45 | 0.50 | 0.60 | 0.70 | 0.80 | 1.00 | 1.20 | 1.45 |
| ---------------------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| Leaving card, progress | 0.01 | 0.04 | 0.12 | 0.20 | 0.34 | 0.49 | 0.61 | 0.75 | 0.83 | 0.88 | 0.95 | 0.98 | 1.00 |
| Deck, progress         | 0.00 | 0.08 | 0.23 | 0.38 | 0.50 | 0.60 | 0.65 | 0.78 | 0.83 | 0.88 | 0.95 | 0.98 | 1.00 |

## Where the reference differs from the approved preview

| #   | Preview (approved 18 Oct)                                                                                                   | Stack 2 reference                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| a   | Desktop: back cards peek **below**, front card leaves **up**. Mobile: peek **right**, leaves **left** (as the sliders move) | Both sizes: back cards peek **above**, front card leaves **down**                |
| b   | Front + 2 behind                                                                                                            | Front + 3 behind                                                                 |
| c   | Scale −0.06 per slot; peek 0.12 card heights (desktop) or 0.20 card widths (mobile) per slot                                | Scale −0.10 per slot; peeks of about 0.03, 0.022, 0.015 stage (each one smaller) |
| d   | The whole deck (front card plus peeks) is centred                                                                           | The front card is centred                                                        |
| e   | The leaving card keeps scale 1                                                                                              | It grows to about 1.07                                                           |
| f   | 2.0 s per step, a 1.85 s `slide` move (the sliders' timing)                                                                 | 1.5 s per step, about 1.4 s on the same curve                                    |
| g   | The card entering the last slot fades in with its scale and move                                                            | It slides out from behind the last card, hidden until it shows                   |
| h   | Desktop card 0.84 frame widths wide, capped by height                                                                       | 0.655 frame widths wide (0.524 × 0.326 at 4:5)                                   |
