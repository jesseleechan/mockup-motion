# Marquee speed: before and after

Each strip shows `/lab?still=1` frames of the template's demo document at t = 0, 2.4, 4.8, 6.4, 6.8 and 7.15 s. The rows are 16:9 before, 16:9 after, 9:16 before and 9:16 after. Before is `main` at 9e4b522 (8 s cut loop). After is this branch (7.2 s loop: an 8 s shot with a 0.8 s wrap crossfade over [6.4, 7.2) s, so 6.8 s is the middle of the crossfade).

- `portfolio-rows.jpg`: before, the rows move about a card every 2.4 s at 16:9 (0.26 frame widths/s) and almost a whole card at 9:16 (0.53). After, 0.065 frame widths/s at 16:9 and 0.042 at 9:16. At 6.8 s (16:9) the cards stay in place and only the screens dissolve. At 9:16 one card step does not fit under the limit, so the two layers are offset during the crossfade.
- `phone-parade.jpg`: before 0.25 / 0.91 frame widths/s, after 0.049 / 0.048. 16:9 dissolves in place; 9:16 is offset during the crossfade, as above.
- `isometric-wall.jpg`: before 0.10 / 0.18, after 0.026 / 0.046. The cards line up on the plane, but the isoDrift camera ends away from its start pose, so the crossfade blends two camera positions. Before, the loop cut straight from the drifted camera back to the start.
