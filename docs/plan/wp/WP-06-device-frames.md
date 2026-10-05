# WP-06: Device frames

**Milestone:** M1 · **Depends on:** WP-03 · **Parallel with:** 07, 08, 10 · **Size:** M

## Goal

Build premium, generic device frames (browser window, phone, tablet, laptop, and frameless card) that hold up in close-ups and at 3D angles, and that always show the screenshot fit to width.

## Context (read first)

- `quality-bar.md` §3 (all measurements), README decision D6 (no trademarks)
- `contracts.md` §4 (`LayoutNode`, screen aspect), §7
- WP-03's `DeviceBuilder` interface, screen compositor, and `card` placeholder

## Scope

**In** (`src/engine/devices/`)

1. **Shared**
   - `screenAspectFor(device, asset)` lives in `src/motion/layouts.ts` (shared with layout code; the rules are in quality-bar §3.1).
   - A body-geometry helper: a rounded-rect `Shape` → `ExtrudeGeometry` with a small bevel, so tilted devices show a solid edge.
   - Static, deterministic lighting for bodies: one `RoomEnvironment` PMREM generated once per engine, plus a key light. Screens stay unlit.
2. **`browser.ts`**
   - `standard`, `minimal`, and `none` chrome; light and dark (quality-bar §3.2).
   - Toolbar shapes (traffic lights with rings, URL pill) are geometry or SDF shader, not a bitmap, so they stay crisp at 4K.
   - URL text: `AssetProvider.getText` with a synthetic label layer. Hide it until WP-10 provides rasterization, and fall back to no text.
   - Window depth 0.004 stage units.
3. **`phone.ts`:** generic phone (body aspect, radius, bezel, rim highlight, side buttons, camera pill inside the status-bar safe zone, four finishes; quality-bar §3.3). Detecting whether a screenshot already contains a status bar belongs to WP-13; until then, always keep the safe zone.
4. **`tablet.ts`, `laptop.ts`, `card.ts`** (replace the WP-03 placeholder `card` with the final one: radius, hairline border).
5. **Width-fit everywhere.** The screen compositor maps the asset at full width. Overflow is cropped at the bottom or scrolled. A short image is top-aligned with the bottom-row color fill.
6. **`/lab` fixtures:** `devices-*.json` covering each device × light/dark × finishes, frontal and `heroTilt`, using WP-04 demo assets (or `aurelia.png` until they land).

**Out:** shadows (WP-08), arranging multiple devices (WP-09).

## Acceptance criteria

- [ ] **Geometry unit tests** check the quality-bar §3 proportions (traffic-light diameter, toolbar height, phone radius, bezel, camera pill) within ±0.05% of width.
- [ ] **No horizontal crop:** a test-pattern screenshot (1 px magenta columns at x = 0 and x = width − 1, plus a centered grid) rendered frontally in every device shows both magenta columns (pixel readback test in Playwright).
- [ ] **Short images:** a 16:9 image in a phone shows full width, top-aligned, with the fill color below it, and no side crop.
- [ ] Attach `/lab` frames at 1080p for every device in light/dark, frontal and tilted. Check them against the quality-bar §3 review items.
- [ ] Bodies look solid at yaw 34° / pitch 28° (`isoDrift`), with no visible z-fighting or light leaks at edges.
