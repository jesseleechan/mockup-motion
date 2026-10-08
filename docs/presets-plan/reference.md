# Reference measurements

The three presets copy the motion and composition of three Rico Supply Jitter templates. We rebuild the idea; we don't copy their files, names or branding. Rico's names stay in these planning docs only, never in the product.

| Preset (working name) | Reference                                               | Preview video            |
| --------------------- | ------------------------------------------------------- | ------------------------ |
| Mobile Slider         | [Slider 5-02](https://rico.supply/products/slider-5-02) | 1080 × 1350, 2.0 s loop  |
| Desktop Slider        | [Slider 6-01](https://rico.supply/products/slider-6-01) | 1080 × 1350, 2.0 s loop  |
| Frames                | [Frames 1-01](https://rico.supply/products/frames-1-01) | 1080 × 1350, 15.0 s loop |

All three are sold for 4:5, 4:3, 1:1, 16:9 and 9:16. Only the 4:5 previews are public, so the numbers below are measured at 4:5. Rules for the other aspects are ours (see the tasks).

## How these were measured

On 7 October 2026 each preview MP4 was loaded in a browser tab, drawn frame by frame into a canvas, and scanned for card edges (pixels darker than the background) at 0.05 s steps for the sliders and 0.2 s steps for Frames. Stage units below are as in `contracts.md` §3: frame height = 1, so a 4:5 frame is 0.8 wide.

To re-measure, open the product page, take the `framerusercontent.com/...mp4` URL from its first `<video>`, open that URL directly, and use `fetch(location.href)` into a blob URL so seeking works.

## Shared look

- Background: flat solid `#DFE1E3` (sampled RGB 223, 225, 227). No gradient, vignette or visible grain.
- Cards: frameless rounded rectangles, no device chrome, no visible shadow.
- Nothing tilts. The camera never moves.

## Slider 5-02 (horizontal, portrait cards)

| Measure                            | Value                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| Active card size                   | 389 × 849 px = 0.36 frame widths × 0.63 frame heights (0.288 × 0.629 stage)                 |
| Card aspect                        | 0.458, the same as our phone screen aspect (0.4615)                                         |
| Corner radius                      | about 29 px = 7.5% of card width                                                            |
| Neighbour scale                    | 0.75 of the active card                                                                     |
| Gap, active edge to neighbour edge | 0.128 stage                                                                                 |
| Centre-to-centre spacing           | 0.38 stage                                                                                  |
| Neighbour emphasis                 | looks like 65% opacity over the background (active pixel 15 → neighbour 88, background 223) |
| Direction                          | cards move left; the next card comes in from the right                                      |
| Visible at 4:5                     | the active card, one neighbour each side (partly cropped), a fourth card while a step runs  |

## Slider 6-01 (vertical, landscape cards)

| Measure                            | Value                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------- |
| Active card size                   | 899 × 560 px = 0.84 frame widths × 0.415 frame heights (0.67 × 0.415 stage) |
| Card aspect                        | 1.61, close to our default desktop screen aspect (1.6)                      |
| Corner radius                      | about 12 px = 1.3% of card width (our card rule is 1.6%)                    |
| Neighbour scale                    | 0.75                                                                        |
| Gap, active edge to neighbour edge | 0.115 stage                                                                 |
| Centre-to-centre spacing           | 0.478 stage                                                                 |
| Neighbour emphasis                 | about 65% opacity, as in 5-02                                               |
| Direction                          | cards move up; the next card comes in from below                            |

## Slider step timing (both sliders)

One step moves every card one slot. Position, scale and opacity all follow the same progress `p`. The step starts at t = 0 and settles at about 1.85 s; the loop is 2.0 s.

| t (s) | 0.10 | 0.20 | 0.30 | 0.40 | 0.45 | 0.50 | 0.55 | 0.60 | 0.70 | 0.80 | 0.90 | 1.00 | 1.20 | 1.40 | 1.60 | 1.75 |
| ----- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| p     | 0.01 | 0.04 | 0.10 | 0.21 | 0.31 | 0.41 | 0.50 | 0.60 | 0.71 | 0.77 | 0.83 | 0.87 | 0.93 | 0.97 | 0.99 | 1.00 |

A least-squares fit gives **cubic-bezier(0.40, 0, 0.05, 1) over 1.85 s**, starting at t = 0, with a maximum error of 0.017 against the table. It is a short ease-in (about 0.4 s) into a fast middle and a long, soft settle. None of the curves in `quality-bar.md` §2.1 is close: `quintInOut` is symmetric and `expoOut` has no ease-in.

## Frames 1-01 (three-row marquee)

| Measure            | Value                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Rows               | 3, the middle row centred; the top and bottom rows are cropped by the frame edges                                                         |
| Card size          | 0.52 × 0.315 stage (0.65 frame widths at 4:5), aspect about 1.65                                                                          |
| Gap                | 0.065 stage between cards and between rows                                                                                                |
| Pitch (card + gap) | 0.585 stage                                                                                                                               |
| Motion             | linear and continuous, no steps                                                                                                           |
| Directions         | top row left, middle row right, bottom row left                                                                                           |
| Speeds             | 0.154, 0.119 and 0.196 stage/s (top, middle, bottom) = 0.19, 0.15 and 0.245 frame widths per second at 4:5                                |
| Loop               | each row travels a whole number of pitches in 15 s (4, 3 and 5), so the loop is seamless because every card in the reference is identical |

Two of these numbers clash with our rules. The speeds are above `quality-bar.md` §2.5's limit of 0.12 frame widths per second. The reference's different row speeds only loop because its cards are identical; with real screenshots, a native loop needs every row to travel a whole asset period. Both are decisions D2 and D3 in the README.

**How our Frames differs (P04).** Our cards keep the 1.6 desktop screen aspect instead of the reference's 1.65, so a 0.315-tall card would be 0.504 wide, 3.1% narrower than the reference. Frames therefore uses a card height of **0.32** (0.512 × 0.32), which keeps width, height, pitch (0.577) and row pitch (0.385) within 1.6% of the reference. Because all our rows move at one speed, the two outer rows of three move together; at half a period apart (the reference's offset would not matter with its identical cards) they would show the same screenshot in the same column for the whole loop, so row r starts r/3 of a period along.
