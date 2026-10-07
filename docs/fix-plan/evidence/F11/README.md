# F11 evidence

Rendered from `/lab?still=1` (pixel ratio 1, supersample 1) with Chrome on SwiftShader, read back with `engine.readPixels()` and written losslessly with sharp. The contact sheet comes from `npm run contact-sheet` (a `VITE_LAB=1` build, `exportFrames`).

- `contact-sheet/`: 12 templates × 16:9, 9:16, 1:1 × 15%, 50% and 85% of each template's length, 960 px wide, WebP q80, with `index.html` (open it in a browser). 8.3 MB.
- `before-templates.png`: all 12 templates at 16:9, 50%, on main (479cc3b) before F11: flat solid backgrounds, empty URL pills, the wall with 17% gaps.
- `after/<template>.png`: each template at 16:9, 50%, 1200 px wide, after F11.
- `ambient-5-aspects.png`: launch-reel's ambient background (its blurred desktop screenshot, dim 0.65) at 16:9, 4:3, 1:1, 4:5 and 9:16: blurred, cover-fit, never stretched.
- `url-pill-preview-vs-export-1080p.png`: 800 px crops of the URL pill at 1920×1080, preview (left) and a decoded frame of a 1080p WebM export through the worker (right), for quiet-hero (light chrome) and tilted-showcase (dark chrome).
- `wall-before.png`: isometric-wall on main, for comparison with `after/isometric-wall.png`.
- `screens-1x-vs-2x.png`: tilted-showcase heading and body copy at 3× zoom, screen targets at 1× (left) and 2× (right).
- `grain-sine-vs-pcg.png`: tilted-showcase at 9:16, 960 px, contrast boosted 6×: the old `sin()` hash (left) leaves diagonal bands and a hard edge, the PCG hash (right) is uniform grain over a smooth gradient.
