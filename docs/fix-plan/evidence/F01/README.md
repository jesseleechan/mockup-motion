# F01 image orientation evidence

All stills are native 1200 × 675 renders unless their filename says otherwise.

- `quiet-hero.png` — The Aurelia desktop screenshot and all browser text read upright in the quiet hero composition.
- `phone-spotlight.png` — The phone screenshot headline reads upright; the short source image leaves the remaining screen area blank, which is a separate asset issue.
- `scroll-story-end.png` — At the final scroll stop, the real 1440 × 4300 Aurelia full-page image shows its footer content upright.
- `launch-reel-title.png` — The title card and its “INTRODUCING” label read upright over the desktop screenshot.
- `cursor-hotspot.png` — The arrow points up-left, with its tip at the center of the click ripple.
- `decoded-webm-1280x720.png` — Mediabunny decoded the native 1280 × 720 WebM frame; red/green are the upper quadrants and blue/yellow are the lower quadrants.

The scroll endpoint capture injects `public/demo/aurelia/desktop-full.webp` through the dev-only `__labSetDoc` hook and corrects the fixture metadata from the decoded bitmap dimensions. It does not change the production lab asset provider.

Mutation checks:

- `orientation-mutation-fails.txt`: restoring the old screen UV mapping fails the card quadrant ordering assertion; restoring the old glyph UVs fails the capital-T crossbar assertion.
- `export-mutation-fails.txt`: restoring the old screen UV mapping fails the decoded WebM red quadrant pixel assertion.
- `mask-mutation-fails.txt`: restoring the old mask clip direction reveals upper glyph ink before the lower glyph.
- `background-mutation-fails.txt`: restoring direct `vUv` image-background sampling reads the blue lower quadrant where red is expected at the top.
- `texture-mutation-fails.txt`: removing `flipY = false` makes the TextureManager unit assertion fail (`true` received).
