# F03 asset loading evidence

Gate results and mutation runs are in the F03 pull request description.

All stills are 1200 px wide, rendered from `/lab?still=1&fixture=…&w=1200` at 50% of each template's duration and written from `engine.readPixels()`. The lab provider still maps every asset id to `aurelia.png` until F04, so the capture injects each slot's real demo file through the dev-only `__labSetDoc` hook and corrects fixture dimensions from the decoded files. It first loads an asset-free document so the lab's cached Aurelia textures are released. Every capture asserted `debugInfo()` reported no unloaded screen.

- `responsive-pair.png`: the browser shows Aurelia desktop-full and the phone shows Aurelia mobile-full. Both are upright, colour-correct and fit to width, where the old code showed black screens.
- `responsive-trio.png`: all three devices show real screenshots. The tablet slot receives the 16:10 desktop hero, so fit-to-width leaves more than half of the screen as bottom-row fill. That is the quality-bar §3.1 rule, but it looks poor; slot assignment is a follow-up.
- `portfolio-rows.png`: every visible card in the tilted rows shows Aurelia, Northwind or Maison Oak; none is black.
- `isometric-wall.png`: every visible tile shows a real screenshot (Aurelia, Northwind, Maison Oak), and `debugInfo()` reports all 288 nodes loaded.
- `cascade-stack.png`: Maison Oak in front, with Northwind and two Aurelia cards behind it showing their own tops.
- `phone-parade-9x16.png` (1200×2133): every phone shows a real mobile screenshot (Aurelia and Northwind). The phones overflow the frame edges at 9:16, which is an F11 composition issue.
- `softness-screen-target-1x-vs-2x.png` (2× nearest-neighbour crop): on the left is this branch, and on the right is an uncommitted experiment with screen render targets at 2× on-screen size. The right is visibly sharper (Laplacian variance 1050 → 1494). The remaining softness comes from the 1× screen target, not from texture size; see the PR follow-ups.
