# F13 evidence

Contact strips of the 79 Linux baselines in `tests/visual/stills.spec.ts-snapshots/`. The baselines were rendered by the Visual baselines workflow (run 37632012683) on `ubuntu-latest` and committed byte for byte. The strips are downscaled copies, recompressed losslessly at PNG level 9.

- `baselines-templates.png`: all 12 templates at 16:9 and 9:16, t = 0.8 and 2.4. I checked that every still is upright, shows the real demo captures (no black or empty screens) and uses the F11 palettes.
- `baselines-devices-backgrounds.png`: the five devices frontal and tilted, and the five background kinds. I checked that the Aurelia captures are upright and fit to width on every device, the phone and tablet use the mobile and full captures, and ambient is blurred and image is sharp.
- `baselines-transitions-text.png`: the five transitions at progress 0.5 and the five text animations at their midpoint. I checked that both shots are visible mid-transition, the text is upright and readable, and typewriter shows its first word.
- `baselines-orientation-colour.png`: F01 quadrants on every device and F02 colour bands. I checked that red and green are on top and red and blue on the left on all five devices. On the full-size baselines, quadrant centres sample exactly `255,0,0 / 0,255,0 / 0,0,255 / 255,255,0`, and the band centres sample `128,128,128 / 51,102,204 / 241,237,230 / 24,25,27`, which equals the source.
