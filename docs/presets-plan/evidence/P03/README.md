# P03 evidence: Mobile Slider and Desktop Slider templates

## Loop check (4:5 exports)

Each template's lab preview document (five demo screenshots, 10 s) was exported at 4:5, 1080 × 1350, 30 fps as MP4 (H.264) through `exportWithEngine` in Chrome on an RTX 5060. Each export has exactly 300 frames. Each file was then played three times back to back (`ffmpeg -stream_loop 2`), and every pair of consecutive frames was compared at 270 × 338 (mean absolute RGB difference, 0–255):

| Measure                                       | Mobile Slider    | Desktop Slider   |
| --------------------------------------------- | ---------------- | ---------------- |
| Median change between consecutive frames      | 4.87             | 7.65             |
| 99th percentile                               | 19.47            | 27.64            |
| Largest change away from the loop points      | 20.74            | 29.55            |
| Change across each loop point (frame 299 → 0) | 0.10, 0.10       | 0.11, 0.11       |
| The three changes before each loop point      | 0.00, 0.00, 0.00 | 0.00, 0.00, 0.00 |

Before each loop point the slider is in the hold at the end of its last step (0.00 change). The change across the loop point is the first frame of the next step's ease-in: 0.10 and 0.11, followed by 0.57 and 1.78 (0.76 and 2.27 for Desktop Slider). That is the same as the start of any other step, so the loop point shows no jump. These are measurements; nobody has watched the exports in real time yet (quality bar §8 asks for three watched loops).

## Gallery previews

`npm run template-previews -- mobile-slider desktop-slider` rendered the two previews (`public/templates/<id>.webm` and `.webp`). I looked at both posters:

| File                            | Size           | What I checked                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mobile-slider.webm` / `.webp`  | 342 KB / 28 KB | Five mobile cards at 16:9, the active card centred with two faded neighbours on each side. Five demo screenshots fill both sides (with four, one side would be empty: see the P02 follow-up). The poster (3.5 s) is the third card, settled.                                                                                                                             |
| `desktop-slider.webm` / `.webp` | 318 KB / 18 KB | A desktop card centred at the 0.50 height cap with its neighbours above and below, settled on Maison Oak's photographic hero. With four screenshots the 8 s loop put the poster mid-step, and a flat dark card made the poster 14–15 KB, under the test's 15 KB floor for real content. Five screenshots and this order give a settled poster without touching the test. |

Both WebMs are under the 450 KB test limit, at the default bitrate.

## Editor

| File                                  | What I checked                                                                                                                                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gallery_slider-cards.webp`           | Both templates in the gallery with their posters, categories (Mobile, Portfolio), one-line descriptions and "Needs a … screenshot" hints. P05 moves them to the front (D1).                                                                                               |
| `editor_mobile-slider_inspector.webp` | Mobile Slider with demo content: the Layout section shows Direction (Horizontal), Card shape (Mobile) and Step length (2.0 s); the Screenshots section lists the five screenshots in order with a remove button each; the timeline card shows the slider icon and 10.0 s. |
| `editor_media-tab_slider-menu.webp`   | The Media tab's context menu on a screenshot that is already in the selected slider offers "Remove from slider". (The e2e test checks "Add to slider" on one that isn't.)                                                                                                 |

UI copy: "Direction", "Horizontal", "Vertical", "Card shape", "Mobile", "Desktop", "Step length", "Set by step length × screenshots", "Add screenshot", "Add to slider", "Remove from slider", "Shows the first 18 screenshots, so the loop fits in 30 s.", "Drag a file from Media here to add it." All are short and in sentence case.

The tests and the failing output for each reverted change are in `mutations.md`.
