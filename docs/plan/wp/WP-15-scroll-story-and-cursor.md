# WP-15: Scroll Story and cursor overlay

**Milestone:** M2 · **Depends on:** WP-09, WP-12 (WP-04 `sections.json` for tests) · **Size:** M

## Goal

Show a whole website the way a person reads it: the page scrolls and pauses on each section. Optionally show a cursor that glides and clicks. Both are opt-in per shot (README decision D3).

## Context (read first)

- `contracts.md` §2 (`ScrollSpec`, `CursorSpec`), §6; WP-02 `scroll.ts` (timing, speed limit, `minDurationFor`)
- `quality-bar.md` §2.2 (scroll timing), §2.5 (one dominant move; scroll shots use camera intensity ≤ 0.3)
- WP-03 screen compositor (scroll offset already supported), WP-04 `public/demo/*/sections.json`

## Scope

**In**

1. **Section detection (`src/assets/sections.ts`, pure)**
   - `detectSections(rgba, w, h) → number[]` (y offsets in source px). Downscale to 256 px wide, compute per-row features (mean color, edge energy), find strong full-width transitions and long uniform bands, and merge boundaries closer than 0.6 viewport heights.
   - `suggestStops(sections, imageHeight, viewportHeight) → number[]` picks 3–5 well-spaced stops (as 0..1 of the scrollable range) that land each section's top at the viewport top, always including 0 and ending at or near the bottom.
2. **Inspector "Scroll" section** (single-device shots only; the section explains why it is unavailable otherwise):
   - A "Scroll through page" switch (**off by default**; turning it on suggests stops and lowers the camera intensity to ≤ 0.3 if needed, with a toast that offers undo).
   - **Stops editor:** a vertical minimap of the screenshot with draggable stop markers, add (click), remove (drag out or Delete), and "Suggest stops" again.
   - Hold time and easing controls.
   - A feasibility hint when `duration < minDurationFor(spec)` ("Needs 9.5 s to scroll comfortably"), with a one-click fix that extends the shot.
3. **Scroll Story template** (`src/templates/scroll-story.ts`, the WP-11 spec), using `suggestStops`.
4. **Cursor**
   - Inspector "Cursor" section (single-device shots): an enable switch, style (`arrow`, `pointer`, `dot`), and a key list.
   - **Record mode:** with the playhead at time t, clicking on the device screen in the stage adds a `CursorKey { t, x, y }` (via `Engine.pick`'s screen UV; implement `pick` here if WP-13 has not). Alt-click adds a click.
   - **Motion (`src/motion/cursor.ts`):** centripetal Catmull-Rom path through the keys. Arrival easing is `expoOut`, the minimum travel time between keys is 0.45 s, and the cursor rests at keys. A click is a 0.12 s press (scale 0.9) plus a ripple (radius 0 → 3.2% of screen width, opacity 0.35 → 0, 0.5 s, `backOut` for the press).
   - **Render:** cursor and ripple are drawn into the screen compositor in viewport coordinates, so they follow tilt but not page scroll. Cursor sprites are crisp vectors rasterized at the needed size; there is no Apple cursor artwork, so draw an original arrow.
5. **Phone status bar while scrolling.** The status-bar safe zone stays fixed while content scrolls beneath it, as on a real phone. If the screenshot has its own status bar (`meta.hasStatusBar`), pin that strip at the top and scroll the rest of the page under it.

**Out:** screen recording, real interactions with the site.

## Acceptance criteria

- [ ] `detectSections` finds at least 80% of the ground-truth section tops (±0.15 viewport heights) on all 10 demo full-page captures, using `sections.json` from WP-04. Report precision and recall.
- [ ] `suggestStops` tests: includes 0, ascending, 3–5 stops, and respects `minDurationFor`.
- [ ] Turning scroll on never happens automatically. There is a test for template application and asset import.
- [ ] Cursor tests: the path passes through the keys at their times, the minimum travel time is enforced, and the cursor is deterministic.
- [ ] Attach a Scroll Story export (10 s, 1080p) of a demo site and a cursor demo export.
