# F04 real demo assets evidence

Gate results and mutation runs are in the F04 pull request description.

All stills are 1200×675, rendered from `/lab?still=1&fixture=…&aspect=16:9&w=1200` at 50% of each template's duration with the lab's own asset provider (no injected images) and written from `engine.readPixels()`. Each capture checked that `debugInfo()` reported no unloaded screen and that the browser console had no warnings.

- `portfolio-rows.png`: the tilted rows show four different sites (Maison Oak, Aurelia, Field Notes, Northwind), each upright and colour-correct.
- `isometric-wall.png`: the wall alternates Studio Kova, Aurelia, Northwind and Field Notes; no tile repeats its neighbour.
- `phone-parade.png`: the phones show five different mobile captures (Aurelia, Field Notes, Northwind, Maison Oak, Studio Kova), fit to width. Aurelia's "…es for living." is cut off at the left inside the capture itself, not by the renderer.
- `responsive-trio.png`: Field Notes on all three devices. The tablet now gets the full-page capture, so its portrait screen fills to width instead of showing a 16:10 hero over bottom-row fill.
