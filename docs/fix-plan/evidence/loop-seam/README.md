# Camera loop seam: before and after

Each image shows `/lab?still=1` frames of the template's 16:9 demo document. The top row is before: the frames at total − 0.8, total − 0.4 and total − 0.02 s, then t = 0. That is `fix/marquee-speed` at 6db11a5, where the shot loops with a cut. The bottom row is after: the frames at total − 0.8, − 0.6, − 0.4, − 0.2 and − 0.02 s, then 0 and 0.4 s. After is this branch, where shot 0 has the 0.8 s wrap crossfade, so the loop is 0.8 s shorter than the shot.

Before, the camera ends its one-way move and the loop cuts straight back to the start pose, which pops (last two tiles of the top row). After, the camera pose and the device positions dissolve into the start pose over 0.8 s, and the frame just before the loop point equals frame 0.

| Template          | Camera     | Before loop (s) | After loop (s) |
| ----------------- | ---------- | --------------- | -------------- |
| `quiet-hero`      | pushIn     | 6.0             | 5.2            |
| `tilted-showcase` | heroTilt   | 6.0             | 5.2            |
| `responsive-pair` | orbitRight | 6.0             | 5.2            |
| `responsive-trio` | dollyLeft  | 7.0             | 6.2            |
| `phone-spotlight` | orbitLeft  | 6.0             | 5.2            |
| `cascade-stack`   | pullBack   | 6.0             | 5.2            |

During the crossfade the two camera poses overlap, so the middle of the wrap shows a brief double image. That is the wrap crossfade from `contracts.md` §5. A camera that returns to its start would reverse direction within the shot, which `quality-bar.md` §2.5 bans.
