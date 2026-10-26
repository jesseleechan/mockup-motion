# Contracts

This file is the source of truth for shared types and module APIs. WP-00 copies §2 verbatim into `src/doc/types.ts`, so every lane compiles against the same contract from day one. To change a contract, edit this file and the code in the same PR, and call it out in the PR title (`contract:`).

## 1. Module layout

```
src/
  doc/         types.ts · defaults.ts · validate.ts · migrate.ts (v1 → v2) · palettes.ts
  state/       store.ts (zustand + immer) · history.ts · selectors.ts · ui-store.ts (non-undoable)
  storage/     db.ts (idb) · projects.ts · blobs.ts · user-templates.ts
  assets/      decode.ts · roles.ts
  motion/      PURE, no DOM/three/React
               easing.ts · rng.ts · camera.ts (presets → poses) · layouts/ (layout → nodes)
               framing.ts · timeline.ts (scheduling, loop wrap) · scroll.ts
               evaluate.ts (doc, t) → FrameState
  engine/      three.js, no React (except react/)
               Engine.ts · stage.ts (camera fit) · devices/ · backgrounds/ · shadows/ · materials/
               textures/ (tiling, downscale cache) · text/ (browser URL pill rasters)
               compositor.ts (shots → RT → transition) · post/ (composite, final pass)
               react/EngineCanvas.tsx (thin preview wrapper)
  text/        rasterize.ts (main thread only: one line of Inter → ImageBitmap, for the URL pill)
  templates/   registry.ts · slots.ts · <one file per template>.ts
  export/      probe.ts · encode.ts · engine-worker.ts · engine-export.ts · destinations.ts
               verify.ts · bundle.ts
  ui/          design-system primitives (Radix wrappers), tokens, icons
  editor/      Shell · TopBar · Library/ (Templates, Media) · Stage/ · Timeline/
               Inspector/ (VideoPanel, ShotPanel) · dialogs/
  lab/         dev-only render lab (/lab): fixtures, stills for visual tests
scripts/       capture.ts · contact-sheet.ts · template-previews.ts
demo-sites/    static HTML/CSS sources for demo screenshots (WP-04)
```

Dependency direction: `editor → state, engine, templates, ui`; `engine → motion, doc`; `templates → motion, doc`; `motion → doc`. Nothing imports `editor`.

## 2. Document model (`src/doc/types.ts`)

```ts
export type Aspect = "16:9" | "9:16" | "1:1" | "4:5" | "4:3";
export type AssetRole = "desktop" | "mobile" | "tablet" | "logo" | "background" | "other";
export type EasingId =
  "linear" | "gentle" | "smooth" | "expoOut" | "quintInOut" | "backOut" | "spring" | "slide";

export interface AssetRef {
  id: string;
  kind: "image" | "font"; // saved "audio" assets (music, removed October 2026) are dropped on load
  name: string;
  mime: string;
  bytes: number;
  width?: number; // image px
  height?: number; // image px
  role?: AssetRole; // auto-detected (assets/roles.ts), user-editable
  meta?: {
    tall?: boolean;
    hasStatusBar?: boolean;
    bottomColor?: string; // image analysis (WP-13, WP-06)
    sections?: { id: string; top: number }[]; // from the capture's JSON: top in image px, ascending (Responsive Scroll)
    page?: string; // the capture's URL, used to pair a desktop and a mobile capture of one page
  };
  family?: string; // font: CSS family name registered via FontFace
}

export type Background =
  | { kind: "solid"; color: string }
  | { kind: "gradient"; stops: string[]; angle: number; angleConvention?: "css" }; // 2-3 stops, OKLCH-interpolated

export type ShadowPreset = "none" | "soft" | "medium" | "dramatic";
export type BrowserChrome = "standard" | "none";

export interface Style {
  background: Background;
  frameAppearance: "light" | "dark";
  browserChrome: BrowserChrome;
  browserUrl: string; // shown in URL pill; "" hides text
  shadow: ShadowPreset;
  grain: number; // 0..1 (0.25 ≈ quality-bar default)
  vignette: number; // 0..1
}

export type DeviceKind = "browser" | "phone" | "card";

export type Layout =
  | { kind: "single"; device: DeviceKind; assetId: string }
  | {
      kind: "rows";
      assetIds: string[];
      rows: 1 | 2 | 3;
      device: "browser" | "card";
      tilt: number;
      cardHeight?: number;
      gap?: number;
      travel: "period";
    }
  | {
      kind: "columns";
      assetIds: string[];
      columns: 2 | 3 | 4 | 5;
      tilt: number;
      device?: "phone" | "card";
      cardWidth?: number;
      gap?: number;
      travel: "period";
    }
  | {
      kind: "slider";
      assetIds: string[];
      axis: "x" | "y";
      shape: "mobile" | "desktop";
      step: number;
      arrangement?: "carousel" | "deck";
    }
  | { kind: "orbit"; assetIds: string[]; shape: "mobile" | "desktop"; step: number }
  | { kind: "tour"; device: "browser" | "phone"; assetIds: string[]; step: number }
  | { kind: "responsive"; desktopId: string; mobileId: string }
  | { kind: "responsive-tour"; desktopIds: string[]; mobileIds: string[]; step: number };
// rows and columns are Frames (Desktop Frames, Mobile Frames, §5): lanes that each move exactly one
// asset period per loop, so the speed follows the shot duration. tilt: degrees of 3D tilt for the
// whole group (the presets use 0). travel is always "period" (see "Removed layouts" below).
// rows.cardHeight: stage units (default: the per-row-count value). rows.gap: stage units between
// cards and rows (default: 0.14 × width across, 0.06 down).
// columns.device (default "phone") and columns.cardWidth and gap mirror rows, turned 90°. "card"
// draws portrait cards at the phone screen aspect 0.4615, whatever the image's own aspect.
// cardWidth: stage units (card height = cardWidth / 0.4615). gap: stage units between cards and
// columns.
// slider.axis x: cards move left, the next comes in from the right. axis y: cards move up.
// slider.shape: mobile = portrait cards at the phone screen aspect; desktop = landscape cards.
// slider.step: seconds per screenshot, 1.6..4.0. Shot duration = assetIds.length × step.
// slider.arrangement: "carousel" (default when unset: Desktop Slider, Mobile Slider) or "deck"
// (Desktop Stack, Mobile Stack): the front card leaves along the axis and the deck moves forward
// one slot per step. Same step timing, duration, 30 s cap and still camera (§5).
// orbit: the screenshots on a ring seen from slightly above, cards always facing the camera. Each
// step turns the next card (from the right) to the front. shape and step as for slider; at most
// the first 6 screenshots are shown, so a shot lasts min(N, 6) × step.
// tour: pages of one site in one browser or phone (Desktop Site Tour, Mobile Site Tour). Each
// step the next page slides in from the right while the current one leaves to the left, both
// clipped to the screen (§4, "A screen that draws two screenshots"); the device and the camera
// stay still. step as for slider, and the slider's 18-screenshot cap applies. The URL pill shows
// style.browserUrl for every page.
// responsive: a landscape card (desktop, 1.6) and a portrait card (mobile, 0.4615) of one page that
// scroll together (Responsive Scroll, quality-bar §4). Side by side at 16:9, 4:3 and 1:1, stacked
// at 4:5 and 9:16.
// responsive-tour: pages of one site, each as a desktop and a mobile screenshot, on Responsive
// Scroll's two cards (Responsive Tour, presets round two D12). Page i is desktopIds[i] with
// mobileIds[i]: both lists have the same length, and "" is a side without a screenshot (it draws
// the empty-state fill). Each step both cards slide to the next page together (§4, §5). step as
// for slider, and the slider's 18 cap applies to pages. src/doc/tour-pages.ts holds the edits
// that keep pages paired: adding a screenshot fills the first page without one on its side (a
// mobile screenshot on the mobile side, others on desktop) or starts a page; removing or moving
// a page takes both its screenshots. sanitizeDoc pads the shorter list with "", turns a missing
// screenshot into "" so later pages stay paired, and drops a page with neither screenshot.

// Since 19 October 2026. A saved project with a removed move (pullBack, orbitLeft, orbitRight,
// tiltUp, tiltDown, riseUp, dollyLeft, dollyRight, isoDrift, heroTilt) loads with "static".
export type CameraPresetId = "static" | "pushIn";

// Since 26 October 2026 there is no `float` (an ambient sway); a saved one is dropped on load.
export interface CameraMove {
  preset: CameraPresetId;
  intensity: number; // 0..1, scales the preset's delta (quality-bar §2 limits apply at 1)
  easing: EasingId;
}

export interface CameraPose {
  yaw: number; // degrees, orbit around target (+ = camera moves right)
  pitch: number; // degrees (+ = camera above, looking down)
  roll: number; // degrees
  distance: number; // multiple of the fit distance (1 = stage exactly fills frame)
  panX: number; // stage units
  panY: number; // stage units
  fov: number; // vertical degrees; long lens (18-30) by default
}

export interface ScrollSpec {
  enabled: boolean; // opt-in; never auto-enabled
  stops: number[]; // 0..1 positions in scrollable range, ascending, first is 0
  sections?: string[]; // responsive: section ids to stop at after the top, in page order (§5); `stops` is the fallback
  hold: number; // seconds held at each stop
  easing: EasingId;
}

// The loop wrap: a cut, or a fade from the shot's end into its start (§5).
export interface Transition {
  kind: "cut" | "fade";
  duration: number; // seconds the wrap fade overlaps the end of the shot
  easing: EasingId;
}

export interface Shot {
  id: string;
  duration: number; // seconds, 1..30
  layout: Layout;
  camera: CameraMove;
  scroll?: ScrollSpec; // honoured for single-device and responsive layouts
  transitionIn: Transition; // the loop wrap transition when doc.loop
  styleOverrides?: Partial<Style>;
  pace?: "calm" | "brisk"; // unset = Default; sets step, duration or hold (§5, Pace)
}

// "custom" is a state (settings that differ from every preset), not a card. Saved "linkedin"
// and "x" load as "video" (export polish §3, October 2026).
export type DestinationId =
  | "video"
  | "dribbble"
  | "instagram-feed"
  | "instagram-story"
  | "presentation-4k"
  | "web-embed"
  | "custom";

export interface ExportSettings {
  destination: DestinationId;
  resolution: 720 | 1080 | 1200 | 1440 | 2160; // short side in px (16:9 1080 → 1920×1080, 4:3 1200 → 1600×1200, 4:5 1080 → 1080×1350)
  fps: 24 | 30 | 60;
  quality: "web" | "high" | "master";
  format: "mp4" | "webm";
  supersample: 1 | 1.5 | 2;
}

export interface ProjectDoc {
  version: 2;
  id: string;
  name: string;
  createdAt: number; // epoch ms (set by the store, never read by motion/engine)
  updatedAt: number;
  aspect: Aspect;
  loop: boolean;
  assets: AssetRef[];
  style: Style;
  shots: Shot[]; // exactly one
  export: ExportSettings;
  templateId?: string; // last applied template (informational)
}
```

**Removed layouts (19 October 2026, `docs/cuts-plan/README.md`).** `pair`, `trio`, the tilted `stack` fan, `wall`, the tilted `rows` and `columns` marquees (`travel: "steps"` or unset) and the `laptop` and `tablet` devices are gone. `sanitizeDoc` loads a saved one as the nearest preset look (`src/doc/legacy-layouts.ts`), so no shot is dropped: `pair` and `trio` become a single browser with the desktop screenshot; `stack` the Desktop Stack deck (`slider`, `axis: "y"`, `shape: "desktop"`, `arrangement: "deck"`); `wall` and tilted `rows` Desktop Frames; tilted `columns` Mobile Frames; a laptop or tablet a browser. A shot mapped to Frames or the deck also takes the preset's still camera and a cut wrap, and a Frames shot lasts at least 15 s. The V1 migration and saved user templates map the same way. The `tablet` asset role stays: it is a screenshot's detected size.

**Removed reels (19 October 2026, `docs/cuts-plan/README.md`).** A video has one shot: `sanitizeDoc` keeps a saved reel's first shot and drops the others, and a saved user template applies its first shot. Shot entrances (`Shot.entrance`), shot-to-shot transitions and the `blur`, `push`, `zoom` and `wipe` kinds, `Transition.direction` and `CameraMove.progressRange` (split shots) are gone. Shot 0's `transitionIn` is the loop wrap: a saved `blur`, `push`, `zoom` or `wipe` loads as a `fade` with the same duration and easing.

Gradient angles use CSS direction in normalized frame coordinates: 0° runs bottom to top, 90° left to right, 180° top to bottom. New gradients carry `angleConvention: "css"`; unmarked persisted v2 gradients retain their legacy direction through a one-time angle migration at load.

Mesh, ambient and image backgrounds were removed on 19 October 2026. `sanitizeDoc` loads a saved mesh as a gradient from its first to its last colour (315°, CSS), and a saved ambient or image background as the Ash solid `#DFE1E3`. The v1 migration turns a v1 image background into Ash too.

Device finishes and the `minimal` browser chrome were removed on 19 October 2026. `sanitizeDoc` drops a saved `deviceFinish`, so every device loads in its one finish (the phone in Silver, `quality-bar.md` §3.3), and loads a saved `minimal` chrome as `standard`.

The camera's Float (`CameraMove.float`, a sine sway of up to 1.2° yaw, 0.8° pitch and 0.4% distance over the shot) was removed on 26 October 2026 ([#113](https://github.com/jesseleechan/mockup-motion/pull/113)). `sanitizeDoc` drops a saved `float`, so a camera loads as its move alone: Still stays still and Push in pushes in without sway. `cameraPose(move, aspect, p)` no longer takes the shot time and length.

## 3. Stage, units and camera

- **Stage units.** The output frame at the default camera covers a plane at z = 0 that is `aspectRatio × 1` stage units (height 1). Layouts position nodes in stage units. Because nothing is defined in pixels, every value scales identically at every resolution and aspect ratio. This fixes the v1 bug where 1:1 and 4:5 rendered at different relative sizes.
- **Fit distance.** `d_fit = 0.5 / tan(fov/2)`. A camera with `distance = 1`, `yaw = pitch = roll = 0`, `pan = 0` sees exactly the stage. Because `distance` is a multiple of `d_fit`, changing `fov` at the same `distance` keeps the framing constant and only changes the amount of perspective.
- **Orbit.** The camera orbits the target point `(panX, panY, 0)` by yaw and pitch at radius `distance × d_fit`, looking at the target, then rolls.

## 4. Layout resolution (`src/motion/layouts.ts`)

```ts
export interface LayoutNode {
  id: string; // stable across frames, e.g. "row1:col3"
  device: DeviceKind;
  assetId: string | null; // null renders an empty-state screen
  // device outer size in stage units; screen rect is derived by the device builder
  width: number;
  height: number;
  screenAspect: number; // width/height of the visible screen viewport
  transform: { x: number; y: number; z: number; rx: number; ry: number; rz: number; scale: number };
  opacity: number; // 0..1 (slider neighbours, a deck's entering card)
  scroll: number; // 0..1 of scrollable range (0 when scroll disabled)
  depthOrder: number; // tie-breaker for transparent sorting
  panes?: ScreenPane[]; // a screen that draws more than one screenshot (below)
}

export function resolveLayout(
  layout: Layout,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number, // local shot time, for lane offsets
  shotDuration: number,
): LayoutNode[];
```

Screen aspect rules (quality-bar §3): `phone 0.4615` (9:19.5), desktop browser `clamp(imageAspect, 1.25, 2.0)` when the image is short, else `1.6`. A `slider` or `orbit` with `shape: "mobile"` and a `columns` layout with `device: "card"` emit `card` nodes at the phone aspect `0.4615`; every other card follows the desktop rule. A `responsive` layout emits a desktop card at `1.6` and a mobile card at `0.4615`, whatever the images' aspects, so tall pages scroll. A `tour` browser takes its first page's aspect by the desktop rule, and every page is fit to that screen's width. A `responsive-tour` emits Responsive Scroll's two cards, desktop at `1.6` and mobile at `0.4615`, whatever the images' aspects; every page is fit to its card's width and shows its top.

### A screen that draws two screenshots (`ScreenPane`, presets round two T1)

A node with `panes` draws several screenshots on one screen, for Site Tour (T1), Before & After (T2) and Responsive Tour (T4). It works on every device: browser, phone and card.

```ts
export interface ScreenPane {
  assetId: string | null; // null draws the empty-state fill
  offset: number; // the screenshot's left edge, in screen widths: 0 fills the screen, 1 is just past its right edge
  clip: readonly [number, number]; // the band of the screen it may draw on, [left, right] in screen widths; [0, 1] is all of it
  scroll: number; // 0..1 of the screenshot's scrollable range
}
```

- Each pane is fit to the screen's width (quality bar §3.1: never cropped horizontally by the fit; a short one gets its bottom-row fill), shifted by `offset`, and drawn only on `[max(0, clip[0], offset), min(1, clip[1], offset + 1)]`. Panes are drawn in order, later ones over earlier ones. Where they leave part of the screen uncovered it shows the empty-state fill.
- When `panes` is set it replaces `assetId` and `scroll` on the screen. `assetId` is then the pane that covers most of the screen (`mainPane`; a tie goes to the later pane), for picking, the editor and `debugInfo`, whose `textureLoaded` is true when every pane's texture is.
- **Every frame lists every screenshot the screen shows during the shot, in the same order.** The engine sizes each pane's texture at the node's width (`textureWidths`) and, the first time a screen gets its list, draws every pane once in setDocument's warm-up render, so no texture is uploaded and no mesh is built while playing. A pane outside the screen or its clip draws nothing, so a layout parks the ones not in view (Site Tour parks them at `offset: 1`).
- Screens stay unlit and colour-exact: each pane is the same strip drawing as a one-screenshot screen, with `flipY = false` textures whose top edge is at v = 0, into the same sRGB target. Pane edges round to whole target pixels the same way on both sides, so neighbouring panes neither overlap nor leave a gap.
- On a phone each pane brings its own status bar colour (its top row, quality bar §3.3), which moves with it; the glyphs stay put and take each pane's tone over that pane.
- The engine side is `ScreenCompositor.composePanes(renderer, panes, { isPhone })` (`src/engine/materials/screen.ts`), which draws one `ScreenPage` (`screen-page.ts`) per pane with a scissor on its band. `compose()` for one screenshot is `composePanes` with one whole-screen pane, unchanged.
- `steppingPanes(ids, step, t)` (`src/motion/layouts/tour.ts`) is the Site Tour step on any screen: during step k (`sliderStep`), page k mod N has `offset: −p` and the next page `1 − p`, edge to edge; the rest wait at `1`. A Before & After screen is two panes at `offset: 0` with complementary clips, `[0, e]` and `[e, 1]`.
- Responsive Tour (`resolveResponsiveTourLayout`, `src/motion/layouts/responsive-tour.ts`) puts `steppingPanes` on both of its cards, `responsive-tour:desktop` and `responsive-tour:mobile`, with the same step and time: pane i of each card is page i's screenshot of that size (`responsiveTourPages`; a missing one is a `null` pane), and page i has the same offset on both cards in every frame.

## 5. Timeline (`src/motion/timeline.ts`)

- A document has one shot (multi-shot reels were cut on 19 October 2026). It runs from 0 to `duration`.
- `totalDuration = duration`. When `doc.loop` is true and `shots[0].transitionIn` is a `fade`: `totalDuration −= transitionIn.duration` (d0), and in `[total − d0, total)` the shot's end blends into its start, with the incoming layer's local time `t − total` clamped to 0 (it holds its first pose while fading in). So frame(total) ≡ frame(0) for every loop.
- A looping shot with a moving camera therefore loops by **wrap crossfade** (default 0.8 s fade).
- **Frames** (`rows` or `columns`: the Desktop Frames and Mobile Frames presets) loops natively. Both layouts resolve the period mode through one shared lane function (`motion/layouts/lanes.ts`); a row is a lane moving sideways, a column a lane moving vertically. Every lane travels exactly one asset period (N × pitch, pitch = card length along the lane + gap) per shot, at one shared speed `N × pitch / duration`, alternating direction (rows: the first moves left; columns: the first, leftmost, moves up). Lane r starts `r / lanes` of a period along, so lanes that move together (the outer rows of three, or every other column) never line up the same screenshot. Odd lanes run the screenshots in reverse order (2, 1, N, N − 1, …), so adjacent lanes, which pass each other, match one card at a time instead of whole lanes. A single looping shot with a `cut` wrap therefore has frame(total) ≡ frame(0) with no crossfade. Given a wrap crossfade instead, a single looping shot's lanes travel one period per `totalDuration`, and during the wrap the incoming lanes run on their unclamped time `t − total` (`ActiveShot.wrapT`) while camera and text keep the clamped time, so both layers show the same cards in the same places. The speed follows the shot duration, which must be at least `framesDuration(layout, aspect)`, the shortest duration that keeps the speed at or under 0.20 stage units per second along the lane (`quality-bar.md` §2.5), rounded up to 0.5 s. A Frames shot shows only `framesAssetIds(layout, aspect)`: the first screenshots whose period fits 30 s at that limit (Desktop Frames: 10 with 3 rows, 8 with 2; Mobile Frames: 9 at 16:9, 4:3 and 1:1, 10 at 4:5 and 9:16), so `framesDuration` is at most 30 s. Both helpers take a rows or a columns layout, and `minShotDuration` applies them to both. The duration itself follows `Shot.pace` (below).
- **Pace** (`Shot.pace?: "calm" | "brisk"`, unset is Default; `src/motion/pace.ts`, `quality-bar.md` §2.2): sliders, decks, orbits, Site Tours, Responsive Tours, Frames and a scrolling Responsive Scroll shot take their timing from it. `paceTargets(shot, aspect)` gives the clamped knob value per pace (a stepped layout's `step`, a Frames shot's `duration`, Responsive Scroll's `scroll.hold`); `fitPace` writes the knob and the duration that follows; `sanitizeDoc`, the editor store (after every edit), `changeAspect` and user templates call it, so the timing fields are outputs of the pace and every pace keeps the loops below seamless. A shot loaded without `pace` takes `nearestPace` once (ties go to Default). `paceLimited` names the paces a limit makes equal to Default.
- **Sliders** (`slider`) loop natively. Step `k` moves every card one slot over `[k × step, k × step + 1.85]` on the `slide` curve, then holds; after N steps (N = `assetIds.length`) the arrangement is back where it started. The shot lasts `sliderDuration(layout) = max(1, N) × step`, so a single looping slider shot with a `cut` wrap has frame(total) ≡ frame(0) with no crossfade. A shot fits in 30 s: N counts at most the first 18 screenshots (`SLIDER_MAX_SCREENSHOTS`; later ones are not shown) and the step is at most `sliderStepMax(N)` = min(4.0, 30 / N) in 0.1 s steps (`steppedStepMax(layout)` counts only the shown screenshots, so an orbit's limit uses at most 6). The step follows `Shot.pace`: 1.6, 2.0 or 2.4 s, clamped. `src/motion/layouts/duration.ts` holds these rules beside `minShotDuration`; `sanitizeDoc` and the editor store apply them after every edit, so a slider's `Shot.duration` always equals `sliderDuration`. A slider's camera is still: `fixedShotCamera` sets `preset: "static"` and `intensity: 0` in the same places, and the Shot inspector shows no Camera section for a slider. When fewer screenshots than visible slots are lit, the lit window is centred on the active card: N slots, or N − 1 when N is even (N > 2).
- **Decks** (`slider` with `arrangement: "deck"`: Desktop Stack and Mobile Stack) are sliders: every rule in the bullet above applies, with the deck geometry of `quality-bar.md` §4. Card j sits `s = (j − k) mod N` slots back during step k; slot 0 leaves the frame, slots 1…depth move forward one slot, and the rest are hidden. After N steps every card is back where it started, so frame(total) ≡ frame(0). A deck's entering card blends in linear light; only the carousel's faded neighbours mix in sRGB.
- **Orbits** (`orbit`, the Desktop Orbit and Mobile Orbit presets, `docs/orbit-plan/README.md`) loop natively on the slider's step timing. Card i sits at ring angle θ = 2π(i − φ)/N, where the phase φ = (k mod N) + p comes from `sliderStep`, so after N steps the ring is back where it started and frame(N × step) is exactly frame(0). An orbit is a stepped layout (`isSteppedLayout` in `duration.ts`) and shares the slider's rules: `sliderDuration` (N × step, N counting at most the first 6 screenshots, `ORBIT_MAX_SCREENSHOTS`), the step clamp, `fixedShotCamera` (still) and no Camera section. One node per shown screenshot (`orbit:<i>`), so no screenshot appears twice. Its nodes' `opacity` is a strength that the engine mixes with the shot's background, not with the cards behind (`fadeBlendFor(layout) === "background"` in `src/engine/devices/DeviceFade.ts`): the cards overlap, so each card is drawn on its own, back to front, and covers what is behind it.
- **Site Tours** (`tour`, the Desktop Site Tour and Mobile Site Tour presets, `docs/presets-2-plan/README.md` D3–D5) loop natively on the slider's step timing. One node (`tour:screen`), a browser or a phone at the single-device size (quality-bar §4), centred and still; its `panes` (§4) are `steppingPanes`: during step k page k mod N leaves to the left (`offset: −p`) while page k + 1 slides in from the right (`1 − p`), both clipped to the screen, and after N steps page 1 is back, so frame(N × step) is exactly frame(0). A tour is a stepped layout (`isSteppedLayout`) and shares the slider's rules: `sliderDuration` (N counting at most the first 18 screenshots), the step clamp, the pace (1.6, 2.0 or 2.4 s), `fixedShotCamera` (still), no Camera section and the screenshot list (at least 3). Every page shows its top (`scroll: 0`); nothing fades.
- **Responsive Tours** (`responsive-tour`, the Responsive Tour preset, `docs/presets-2-plan/README.md` D12–D15) loop natively on the same timing. Two still cards in Responsive Scroll's place (`responsiveGeometry`; quality-bar §4), whose `panes` are both `steppingPanes` on the same step and time: during step k page k mod N leaves both cards to the left while page k + 1 slides in on both from the right, so the mobile screen moves in step with the desktop one, and frame(N × step) is exactly frame(0). N is the number of pages (`responsiveTourPageCount`: the longer list, at most 18). A Responsive Tour is a stepped layout (`isSteppedLayout`; `steppedCount` counts its pages, `steppedAssetIds` takes only the one-list layouts) and shares the slider's rules: `sliderDuration`, the step clamp, the pace (1.6, 2.0 or 2.4 s), `fixedShotCamera` (still), no Camera section, and a page list in the inspector (at least 3 pages). Every page shows its top (`scroll: 0`); nothing fades.
- **Responsive Scroll** (`responsive`) loops by the 0.8 s wrap crossfade: a scroll never reverses. Both screens stop together. With section data on both assets (`AssetRef.meta.sections`) and `ScrollSpec.sections` naming sections both pages have, stop k puts that section's top at the top of both screens (a page that can't scroll that far stops at its bottom); the first stop is the top of both pages. Otherwise both screens use the same `stops` fractions of their own scrollable range. Each move takes the time the screen that travels further needs at 0.9 screen heights per second on average, eased `smooth`; each stop holds `ScrollSpec.hold`. The layout sets the shot length (`fixedShotDuration`: holds plus moves plus the 0.8 s the wrap crossfade overlaps, at most 30 s; later stops are left out) and keeps the camera still (`fixedShotCamera`). A loop therefore lasts holds plus moves, and the wrap crossfade falls inside the last hold.

```ts
export interface ScheduledShot {
  index: number;
  start: number;
  end: number;
}
export function schedule(doc: ProjectDoc): { shots: ScheduledShot[]; total: number };
```

## 6. Frame evaluation (`src/motion/evaluate.ts`)

```ts
export interface ShotFrame {
  shotId: string;
  localT: number;
  camera: CameraPose;
  nodes: LayoutNode[];
  style: Style; // resolved (doc.style + overrides)
}
export interface FrameState {
  t: number;
  total: number;
  layers: { frame: ShotFrame; weight: number }[]; // 1 entry, or 2 during the wrap crossfade
  transition?: { kind: Transition["kind"]; progress: number };
}
export function evaluate(doc: ProjectDoc, t: number): FrameState;
```

`evaluate` is pure and synchronous, with no I/O. Memoise layout work by `(shot.id, aspect, assets signature)`, never by time.

## 7. Engine (`src/engine/Engine.ts`)

All image textures are created with `flipY = false`. Texel row 0 is the top of the image (`v = 0`). Every mesh that displays an image maps its top edge to `v = 0`. Never rely on `flipY` for `ImageBitmap`, `OffscreenCanvas`, or `VideoFrame` sources.

```ts
export interface EngineOptions {
  width: number; // output px (CSS px × DPR for preview)
  height: number;
  supersample?: 1 | 1.5 | 2; // internal render scale, downsampled in the final pass
  preserveDrawingBuffer?: boolean; // true for export so Mediabunny can read the canvas
  maxTextureSize?: number; // override for tests
  cameraDistanceOverride?: number; // isolated fixture override, not serialized
  hideDevices?: boolean; // lab/test fixture: draw the background only; not serialized
}

export interface AssetProvider {
  /** Decoded image, downscaled with high-quality resampling so width ≤ maxWidth. */
  getImage(assetId: string, maxWidth: number): Promise<ImageBitmap>;
  /** Pre-rasterised text line at the given output height (main thread rasterises; see src/text). */
  getText(line: TextLine, frameHeightPx: number): Promise<TextRaster>;
}
/** One line of Inter: the browser URL pill's domain. */
export interface TextLine {
  id: string; // raster key, used to hand rasters to the export worker
  text: string;
  size: number; // % of frame height
  color: string; // #RRGGBB
}
export interface TextRaster {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  color: string; // canonical opaque sRGB glyph colour; bitmap alpha supplies coverage
}

export class Engine {
  static create(canvas: HTMLCanvasElement | OffscreenCanvas, opts: EngineOptions): Promise<Engine>;
  /** Diff against the previous doc; rebuild only what changed; resolves when textures are ready. */
  setDocument(doc: ProjectDoc, assets: AssetProvider): Promise<void>;
  renderAt(t: number): void; // synchronous; deterministic
  /** Active layers and transition blend into a linear target; no vignette, encoding or grain. */
  renderComposite(t: number, target: THREE.WebGLRenderTarget): FrameState | null;
  resize(width: number, height: number): void;
  /** Hit-test output-pixel coordinates; returns the LayoutNode id and screen UV (0..1), or null. */
  pick(x: number, y: number): { nodeId: string; u: number; v: number } | null;
  readonly info: { maxTextureSize: number; renderer: string; drawCalls: number };
  /** Cheap, always-on state for tests and the editor. */
  debugInfo(): {
    nodes: { id: string; device: DeviceKind; assetId: string | null; textureLoaded: boolean }[]; // last render
    textures: number;
    geometries: number;
    setDocumentCalls: number;
    renderCalls: number;
    devicesBuilt: number;
  };
  dispose(): void;
}
```

`setDocument` loads every image in `collectAssetIds(doc)` (`src/doc/assets.ts`: every layout's screens) at the width from `textureWidths` (`src/engine/textures/sizing.ts`), which export also uses for its decode widths. Each call bumps a generation; a call superseded while loading changes nothing. When loading finishes it keeps device instances whose key (`node.id`, device, stage size, frame appearance, chrome, URL, shadow) still exists, disposes the rest, and releases textures and URL pill rasters the document no longer uses.

Renderer invariants: `WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer })`, `outputColorSpace = SRGBColorSpace`, `toneMapping = NoToneMapping`. Shots render into MSAA render targets (`samples: 4`). A composite pass blends the active layers and the wrap crossfade into one linear target; the final pass then handles downsample, vignette, sRGB conversion, grain and dither to the canvas. `renderAt(t)` is `renderComposite` plus the final pass.

Render targets hold linear-light values. Every custom shader that writes to a render target outputs linear sRGB-primaries values. Only the final pass converts to sRGB, and it does so explicitly (no `colorspace_fragment` include). Grain and dither are added after that conversion. Byte sRGB targets may encode storage on write and decode on sampling; sampled values and blending remain linear, preserving dark-colour byte precision.

`TextRaster.color` is canonical opaque sRGB hex for the monochrome glyphs; bitmap alpha supplies coverage. The URL pill samples coverage and draws it in that colour. Raster bitmaps are created with `premultiplyAlpha: "premultiply"`.

`EngineOptions.cameraDistanceOverride?: number` is an isolated fixture override, not serialized document state. The lab exposes it through a development-only `cameraDistance` URL parameter so the F02 frontal screenshot test can use distance 0.7 without changing the CameraMove contract. `EngineOptions.hideDevices` is the same kind of override: the development-only `devices=0` URL parameter draws the background alone, for tests of backgrounds, transitions and grain.

## 8. Templates (`src/templates/`)

```ts
export interface SlotSpec {
  key: string; // "desktop1", "mobile1", "logo"
  role: AssetRole;
  required: boolean;
  prefer?: "tall" | "any"; // tall = full-page screenshot preferred
  label: string; // UI label, e.g. "Homepage (desktop)"
}
export interface TemplateBuildContext {
  aspect: Aspect;
  slots: Record<string, AssetRef | undefined>;
  projectName: string;
  style?: Partial<Style>; // keep the user's browser chrome when re-applying
}
export interface Template {
  id: string;
  name: string;
  description: string; // one line, calm tone
  category: "desktop" | "mobile"; // the gallery tab; matches the screenshots' role
  slots: SlotSpec[];
  defaultDuration: number;
  tones?: PresetTones; // { light, dark } palette ids for the Background control; Ash and Onyx when omitted
  build(ctx: TemplateBuildContext): { style: Style; shots: Shot[]; loop: boolean };
}
export function fillSlots(t: Template, assets: AssetRef[]): Record<string, string | undefined>;
```

`fillSlots` is greedy by role and `prefer`. It never puts a `mobile`-role asset in a desktop slot or the reverse, and only reuses an asset when there are not enough distinct ones.

The built-in templates, in gallery order (`docs/phone-frames-plan/README.md`, D2, D3, D12): Desktop Slider (`desktop-slider`, the first-run default), Mobile Slider (`mobile-slider`), Desktop Frames (`frames`), Mobile Frames (`mobile-frames`), Desktop Stack (`desktop-stack`), Mobile Stack (`mobile-stack`; stack plan D5), Desktop Orbit (`desktop-orbit`), Mobile Orbit (`mobile-orbit`), Desktop Site Tour (`desktop-site-tour`), Mobile Site Tour (`mobile-site-tour`; presets round two D15), Desktop Scroll Story (`scroll-story`) and Mobile Scroll Story (`mobile-scroll-story`, `docs/mobile-scroll-story-plan/README.md`). The two sliders are one effect in two sizes, and so are the two Frames presets, the two Stack presets (slider decks, §5), the two Orbit presets, the two Site Tour presets and the two Scroll Story presets. Removed templates leave their layouts in the engine, so saved projects keep rendering; a saved `templateId` that no longer exists is informational only.

Responsive Scroll (`responsive-scroll`, `docs/responsive-scroll-plan/README.md`) and Responsive Tour (`responsive-tour`, presets round two D12–D15) are last in the gallery, in that order. Each shows desktop and mobile screenshots, so its category is `"both"` and it sits under the Desktop and the Mobile tab (`templateInCategory`). Responsive Scroll's two slots are a same-page pair (`Template.samePage`): `fillSlots` fills them with captures of one page (same capture URL, then the same page name in the file names) before the greedy fill. Responsive Tour has ten slots, `desktop1`/`mobile1` to `desktop5`/`mobile5`, the first three pages required; page n pairs the n-th desktop with the n-th mobile screenshot in Library order (D12), and `distinctPages` leaves out a page that would repeat a screenshot when `fillSlots` runs short. Its card says "Needs 3+ pages in desktop and mobile" (`templateNeeds`).

Video inspector > Background offers Light, Dark or Custom (`docs/polish-plan/inspectors.md` P1). Light and Dark are the template's `tones` (`templateTones`): Ash and Onyx for the slider, Stack, Frames, Orbit, Site Tour, Responsive Scroll and Responsive Tour presets and for documents without a template, Fog and Graphite for Desktop and Mobile Scroll Story. The tone is not stored: it is read from `style.background` (`presetToneOf`; a solid by colour, a gradient by stops and angle), so it saves and loads with the style; anything else is Custom. A custom colour is a flat solid; below OKLCH L 0.5 it sets `frameAppearance: "dark"` (`customBackgroundStyle`). `applyTemplate` gives a document whose `frameAppearance` is dark the new template's Dark fill; otherwise every template builds its Light fill.

## 9. Export worker protocol (`src/export/engine-worker.ts`)

```ts
type ToWorker =
  | {
      type: "start";
      doc: ProjectDoc;
      images: Record<string, ImageBitmap>;
      texts: Record<string, TextRaster>;
      settings: ExportSettings;
      codec: "avc" | "vp9" | "av1";
      container: "mp4" | "webm";
      width: number;
      height: number;
    }
  | { type: "cancel" };
type FromWorker =
  | {
      type: "progress";
      stage: "preparing" | "rendering" | "finishing";
      frame: number;
      total: number;
    }
  | { type: "done"; blob: Blob; mime: string }
  | { type: "error"; message: string };
```

Before posting, the main thread rasterises the URL pill text at export resolution and decodes all images at the needed size, then transfers the bitmaps. The worker never needs fonts or the DOM.
