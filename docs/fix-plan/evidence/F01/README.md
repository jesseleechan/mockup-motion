# F01 image orientation evidence

All stills are native 1200 × 675 renders unless their filename says otherwise.

- `quiet-hero.png` — The Aurelia desktop screenshot and all browser text read upright in the quiet hero composition.
- `phone-spotlight.png` — The phone screenshot headline reads upright; the short source image leaves the remaining screen area blank, which is a separate asset issue.
- `scroll-story-end.png` — At the final scroll stop, the real 1440 × 4300 Aurelia full-page image shows its footer content upright.
- `launch-reel-title.png` — The title card and its “INTRODUCING” label read upright over the desktop screenshot.
- `cursor-hotspot.png` — The arrow points up-left, with its tip at the center of the click ripple.
- `decoded-webm-1280x720.png` — Mediabunny decoded the native 1280 × 720 WebM frame; red/green are the upper quadrants and blue/yellow are the lower quadrants.

The scroll endpoint capture injects `public/demo/aurelia/desktop-full.webp` through the dev-only `__labSetDoc` hook and corrects the fixture metadata from the decoded bitmap dimensions. It does not change the production lab asset provider.

Gate results and mutation runs are in the F01 pull request description.
