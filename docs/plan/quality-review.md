# Quality-bar review (WP-18)

Checklist from `quality-bar.md` §8, applied to the 12 built-in templates. Stills for the regression suite are `/lab?still=1`. A contact sheet is produced with `npm run contact-sheet`.

Templates: Quiet Hero, Tilted Showcase, Responsive Pair, Responsive Trio, Phone Spotlight, Phone Parade, Portfolio Rows, Isometric Wall, Cascade Stack, Scroll Story, Launch Reel, Case Study Reel.

- [x] Screenshot content is not cropped horizontally. Device screens fit to width (`quality-bar.md` §3). Colors use unlit materials, sRGB textures, and no tone mapping.
- [x] No reversing motion. Camera presets move one way and settle. Loops use a wrap crossfade or an integer marquee period, not a yo-yo.
- [x] Safe margins are in stage units, so they hold at 16:9, 9:16, 1:1, 4:5, and 4:3. Visual stills cover 16:9 and 9:16 for every template.
- [x] Shadow, grain, and vignette use the §5 defaults (soft / 0.25 / 0.06) unless a template overrides them inside those ranges.
- [x] Title size in the text fixtures is 6% of frame height. Captions stay at or above 1.6%.
- [x] Loop seam is a unit-tested property of `schedule` (frame at `total` matches frame 0 when looping).
- [x] Screenshot text shimmer is mitigated by mipmaps, anisotropy, and pre-downscale in the engine. A 1080p export review is still the human check.

UI copy in this wave was moved to sentence case: empty state, export, projects, and the save indicator. Reduced motion collapses UI transitions. The video itself is the motion, so camera moves are unchanged when the OS asks for less motion.

**Bundle (production build):** entry `index` is 201 KB gzip, under the 250 KB budget. The preview engine is a separate 156 KB gzip chunk, loaded when the stage mounts. Export and GIF are in `ExportModal` (147 KB gzip), loaded when export opens. The encode worker is its own file.

**Follow-up:** attach a fresh contact sheet after `npm run contact-sheet`. Linux visual baselines are not committed yet. Generate them with `npm run test:visual:update` on the machine that runs the check. Safari and Firefox were not launched on this Windows host.
