# Contracts

This file is the source of truth for shared types and module APIs. WP-00 copies §2 verbatim into `src/doc/types.ts`, so every lane compiles against the same contract from day one. To change a contract, edit this file and the code in the same PR, and call it out in the PR title (`contract:`).

## 1. Module layout

```
src/
  doc/         types.ts · defaults.ts · validate.ts · migrate.ts (v1 → v2) · palettes.ts
  state/       store.ts (zustand + immer) · history.ts · selectors.ts · ui-store.ts (non-undoable)
  storage/     db.ts (idb) · projects.ts · blobs.ts · brand-kits.ts · user-templates.ts
  assets/      decode.ts · provider.ts (AssetProvider) · roles.ts · palette.ts · sections.ts · fonts.ts
  motion/      PURE, no DOM/three/React
               easing.ts · rng.ts · camera.ts (presets → poses) · layouts/ (layout → nodes)
               framing.ts · timeline.ts (scheduling, loop wrap) · scroll.ts
               text-anim.ts · cursor.ts · evaluate.ts (doc, t) → FrameState
  engine/      three.js, no React (except react/)
               Engine.ts · stage.ts (camera fit) · devices/ · backgrounds/ · shadows/ · materials/
               textures/ (tiling, downscale cache) · text/ (screen-space text pass)
               compositor.ts (shots → RT → transition) · post/ (composite, final pass)
               react/EngineCanvas.tsx (thin preview wrapper)
  text/        rasterize.ts (main thread only: text layer → ImageBitmap + word boxes)
  templates/   registry.ts · slots.ts · <one file per template>.ts
  export/      probe.ts · encode.ts · engine-worker.ts · engine-export.ts · destinations.ts
               verify.ts · bundle.ts
  ui/          design-system primitives (Radix wrappers), tokens, icons
  editor/      Shell · TopBar · Library/ (Templates, Media, Brand) · Stage/ · Timeline/
               Inspector/ (VideoPanel, ShotPanel, TextPanel) · dialogs/
  lab/         dev-only render lab (/lab, /lab/ui): fixtures, stills for visual tests
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
  palette?: string[]; // image: 5 dominant colours, hex, most-to-least prominent
  meta?: {
    tall?: boolean;
    hasStatusBar?: boolean;
    bottomColor?: string; // image analysis (WP-13, WP-06)
    sections?: { id: string; top: number }[]; // from the capture's JSON: top in image px, ascending (Responsive Scroll)
    page?: string; // the capture's URL, used to pair a desktop and a mobile capture of one page
  };
  family?: string; // font: CSS family name registered via FontFace
}

export interface FontRef {
  source: "builtin" | "asset";
  family: string; // builtin family name or AssetRef.family
  weight: number; // 100..900
}

export type Background =
  | { kind: "solid"; color: string }
  | { kind: "gradient"; stops: string[]; angle: number; angleConvention?: "css" } // 2-3 stops, OKLCH-interpolated
  | { kind: "mesh"; colors: string[]; drift: number; seed: number } // 3-5 colours, drift 0..1
  | { kind: "ambient"; assetId: string; blur: number; dim: number } // blurred screenshot, 0..1
  | { kind: "image"; assetId: string; dim: number };

export type ShadowPreset = "none" | "soft" | "medium" | "dramatic";
export type DeviceFinish = "graphite" | "silver" | "black" | "sand";
export type BrowserChrome = "standard" | "minimal" | "none";

export interface Style {
  background: Background;
  frameAppearance: "light" | "dark";
  deviceFinish: DeviceFinish;
  browserChrome: BrowserChrome;
  browserUrl: string; // shown in URL pill; "" hides text
  shadow: ShadowPreset;
  grain: number; // 0..1 (0.25 ≈ quality-bar default)
  vignette: number; // 0..1
  fonts: { display: FontRef; body: FontRef };
  textColor: string; // default text colour; "" = auto contrast vs background
  accent: string; // cursor, highlights
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
  | { kind: "responsive"; desktopId: string; mobileId: string }
  | { kind: "title" };
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
// responsive: a landscape card (desktop, 1.6) and a portrait card (mobile, 0.4615) of one page that
// scroll together (Responsive Scroll, quality-bar §4). Side by side at 16:9, 4:3 and 1:1, stacked
// at 4:5 and 9:16.

export type CameraPresetId =
  | "static"
  | "pushIn"
  | "pullBack"
  | "orbitLeft"
  | "orbitRight"
  | "tiltUp"
  | "tiltDown"
  | "riseUp"
  | "dollyLeft"
  | "dollyRight"
  | "isoDrift"
  | "heroTilt";

export interface CameraMove {
  preset: CameraPresetId;
  intensity: number; // 0..1, scales the preset's delta (quality-bar §2 limits apply at 1)
  easing: EasingId;
  float: number; // 0..1 subtle ambient sway layered on top (quality-bar §2.4)
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

export type TextAnimId = "none" | "fadeUp" | "maskReveal" | "blurIn" | "wordStagger" | "typewriter";
export type Anchor =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export interface TextLayer {
  id: string;
  text: string;
  role: "title" | "subtitle" | "caption" | "label";
  font: "display" | "body";
  size: number; // % of frame height (e.g. 6 = 6%)
  anchor: Anchor;
  align: "left" | "center" | "right";
  color: string; // "" = Style.textColor
  animation: TextAnimId;
  delay: number; // seconds from shot start
  logoAssetId?: string; // render a logo above the text
}

// The loop wrap: a cut, or a fade from the shot's end into its start (§5).
export interface Transition {
  kind: "cut" | "fade";
  duration: number; // seconds the wrap fade overlaps the end of the shot
  easing: EasingId;
}

export interface CursorKey {
  t: number;
  x: number;
  y: number;
  click?: boolean;
} // x,y 0..1 of device screen
export interface CursorSpec {
  enabled: boolean;
  style: "arrow" | "pointer" | "dot";
  keys: CursorKey[];
}

export interface Shot {
  id: string;
  duration: number; // seconds, 1..30
  layout: Layout;
  camera: CameraMove;
  scroll?: ScrollSpec; // honoured for single-device and responsive layouts
  cursor?: CursorSpec; // honoured only for single-device layouts
  texts: TextLayer[];
  transitionIn: Transition; // the loop wrap transition when doc.loop
  styleOverrides?: Partial<Style>;
}

export type DestinationId =
  | "custom"
  | "web-embed"
  | "dribbble"
  | "instagram-feed"
  | "instagram-story"
  | "linkedin"
  | "x"
  | "presentation-4k";

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

## 3. Stage, units and camera

- **Stage units.** The output frame at the default camera covers a plane at z = 0 that is `aspectRatio × 1` stage units (height 1). Layouts position nodes in stage units. Because nothing is defined in pixels, every value scales identically at every resolution and aspect ratio. This fixes the v1 bug where 1:1 and 4:5 rendered at different relative sizes.
- **Fit distance.** `d_fit = 0.5 / tan(fov/2)`. A camera with `distance = 1`, `yaw = pitch = roll = 0`, `pan = 0` sees exactly the stage. Because `distance` is a multiple of `d_fit`, changing `fov` at the same `distance` keeps the framing constant and only changes the amount of perspective.
- **Orbit.** The camera orbits the target point `(panX, panY, 0)` by yaw and pitch at radius `distance × d_fit`, looking at the target, then rolls.
- **Text and overlays** render in screen space (§6), not in the 3D scene, so camera moves never distort typography.

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
}

export function resolveLayout(
  layout: Layout,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number, // local shot time, for lane offsets
  shotDuration: number,
): LayoutNode[];
```

Screen aspect rules (quality-bar §3): `phone 0.4615` (9:19.5), desktop browser `clamp(imageAspect, 1.25, 2.0)` when the image is short, else `1.6`. A `slider` or `orbit` with `shape: "mobile"` and a `columns` layout with `device: "card"` emit `card` nodes at the phone aspect `0.4615`; every other card follows the desktop rule. A `responsive` layout emits a desktop card at `1.6` and a mobile card at `0.4615`, whatever the images' aspects, so tall pages scroll.

## 5. Timeline (`src/motion/timeline.ts`)

- A document has one shot (multi-shot reels were cut on 19 October 2026). It runs from 0 to `duration`.
- `totalDuration = duration`. When `doc.loop` is true and `shots[0].transitionIn` is a `fade`: `totalDuration −= transitionIn.duration` (d0), and in `[total − d0, total)` the shot's end blends into its start, with the incoming layer's local time `t − total` clamped to 0 (it holds its first pose while fading in). So frame(total) ≡ frame(0) for every loop.
- A looping shot with a moving camera therefore loops by **wrap crossfade** (default 0.8 s fade).
- **Frames** (`rows` or `columns`: the Desktop Frames and Mobile Frames presets) loops natively. Both layouts resolve the period mode through one shared lane function (`motion/layouts/lanes.ts`); a row is a lane moving sideways, a column a lane moving vertically. Every lane travels exactly one asset period (N × pitch, pitch = card length along the lane + gap) per shot, at one shared speed `N × pitch / duration`, alternating direction (rows: the first moves left; columns: the first, leftmost, moves up). Lane r starts `r / lanes` of a period along, so lanes that move together (the outer rows of three, or every other column) never line up the same screenshot. Odd lanes run the screenshots in reverse order (2, 1, N, N − 1, …), so adjacent lanes, which pass each other, match one card at a time instead of whole lanes. A single looping shot with a `cut` wrap therefore has frame(total) ≡ frame(0) with no crossfade. Given a wrap crossfade instead, a single looping shot's lanes travel one period per `totalDuration`, and during the wrap the incoming lanes run on their unclamped time `t − total` (`ActiveShot.wrapT`) while camera and text keep the clamped time, so both layers show the same cards in the same places. The speed follows the shot duration, which must be at least `framesDuration(layout, aspect)`, the shortest duration that keeps the speed at or under 0.20 stage units per second along the lane (`quality-bar.md` §2.5), rounded up to 0.5 s. A Frames shot shows only `framesAssetIds(layout, aspect)`: the first screenshots whose period fits 30 s at that limit (Desktop Frames: 10 with 3 rows, 8 with 2; Mobile Frames: 9 at 16:9, 4:3 and 1:1, 10 at 4:5 and 9:16), so `framesDuration` is at most 30 s. Both helpers take a rows or a columns layout, and `minShotDuration` applies them to both.
- **Sliders** (`slider`) loop natively. Step `k` moves every card one slot over `[k × step, k × step + 1.85]` on the `slide` curve, then holds; after N steps (N = `assetIds.length`) the arrangement is back where it started. The shot lasts `sliderDuration(layout) = max(1, N) × step`, so a single looping slider shot with a `cut` wrap has frame(total) ≡ frame(0) with no crossfade. A shot fits in 30 s: N counts at most the first 18 screenshots (`SLIDER_MAX_SCREENSHOTS`; later ones are not shown) and the step is at most `sliderStepMax(N)` = min(4.0, 30 / N) in 0.1 s steps. `src/motion/layouts/duration.ts` holds these rules beside `minShotDuration`; `sanitizeDoc` and the editor store apply them after every edit, so a slider's `Shot.duration` always equals `sliderDuration`. A slider's camera is still: `fixedShotCamera` sets `preset: "static"`, `intensity: 0` and `float: 0` in the same places, and the Shot inspector shows no Camera section for a slider. When fewer screenshots than visible slots are lit, the lit window is centred on the active card: N slots, or N − 1 when N is even (N > 2).
- **Decks** (`slider` with `arrangement: "deck"`: Desktop Stack and Mobile Stack) are sliders: every rule in the bullet above applies, with the deck geometry of `quality-bar.md` §4. Card j sits `s = (j − k) mod N` slots back during step k; slot 0 leaves the frame, slots 1…depth move forward one slot, and the rest are hidden. After N steps every card is back where it started, so frame(total) ≡ frame(0). A deck's entering card blends in linear light; only the carousel's faded neighbours mix in sRGB.
- **Orbits** (`orbit`, the Desktop Orbit and Mobile Orbit presets, `docs/orbit-plan/README.md`) loop natively on the slider's step timing. Card i sits at ring angle θ = 2π(i − φ)/N, where the phase φ = (k mod N) + p comes from `sliderStep`, so after N steps the ring is back where it started and frame(N × step) is exactly frame(0). An orbit is a stepped layout (`isSteppedLayout` in `duration.ts`) and shares the slider's rules: `sliderDuration` (N × step, N counting at most the first 6 screenshots, `ORBIT_MAX_SCREENSHOTS`), the step clamp, `fixedShotCamera` (still) and no Camera section. One node per shown screenshot (`orbit:<i>`), so no screenshot appears twice. Its nodes' `opacity` is a strength that the engine mixes with the shot's background, not with the cards behind (`fadeBlendFor(layout) === "background"` in `src/engine/devices/DeviceFade.ts`): the cards overlap, so each card is drawn on its own, back to front, and covers what is behind it.
- **Responsive Scroll** (`responsive`) loops by the 0.8 s wrap crossfade: a scroll never reverses. Both screens stop together. With section data on both assets (`AssetRef.meta.sections`) and `ScrollSpec.sections` naming sections both pages have, stop k puts that section's top at the top of both screens (a page that can't scroll that far stops at its bottom); the first stop is the top of both pages. Otherwise both screens use the same `stops` fractions of their own scrollable range. Each move takes the time the screen that travels further needs at 0.9 screen heights per second on average, eased `smooth`; each stop holds `ScrollSpec.hold`. The layout sets the shot length (`fixedShotDuration`: holds plus moves plus the 0.8 s the wrap crossfade overlaps, at most 30 s; later stops are left out) and keeps the camera still (`fixedShotCamera`). A loop therefore lasts holds plus moves, and the wrap crossfade falls inside the last hold.
- Mesh background phase is `t / totalDuration` and uses only integer harmonics of 2π, so it loops.

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
  texts: TextFrame[];
  cursor?: { x: number; y: number; pressed: number; nodeId: string }; // pressed 0..1 ripple
  style: Style; // resolved (doc.style + overrides)
}
export interface TextFrame {
  layerId: string;
  words: { index: number; opacity: number; dy: number; blur: number; clip: number }[]; // dy in % frame height
  opacity: number;
}
export interface FrameState {
  t: number;
  total: number;
  backgroundPhase: number; // 0..1, loop-safe
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
}

export interface AssetProvider {
  /** Decoded image, downscaled with high-quality resampling so width ≤ maxWidth. */
  getImage(assetId: string, maxWidth: number): Promise<ImageBitmap>;
  /** Pre-rasterised text layer at the given output height (main thread rasterises; see src/text). */
  getText(layer: TextLayer, style: Style, frameHeightPx: number): Promise<TextRaster>;
}
export interface TextRaster {
  bitmap: ImageBitmap;
  words: { x: number; y: number; w: number; h: number }[];
  width: number;
  height: number;
  color?: string; // canonical opaque sRGB glyph colour; bitmap alpha supplies coverage
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

`setDocument` loads every image in `collectAssetIds(doc)` (`src/doc/assets.ts`: every layout's screens, ambient and image backgrounds in the style and shot overrides, and text-layer logos) at the width from `textureWidths` (`src/engine/textures/sizing.ts`), which export also uses for its decode widths. Each call bumps a generation; a call superseded while loading changes nothing. When loading finishes it keeps device instances whose key (`node.id`, device, stage size, frame appearance, finish, chrome, URL, shadow) still exists, disposes the rest, and releases textures and text rasters the document no longer uses.

Renderer invariants: `WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer })`, `outputColorSpace = SRGBColorSpace`, `toneMapping = NoToneMapping`. Shots render into MSAA render targets (`samples: 4`). A composite pass blends the active layers and the wrap crossfade into one linear target; the final pass then handles downsample, vignette, sRGB conversion, grain and dither to the canvas. `renderAt(t)` is `renderComposite` plus the final pass.

Render targets hold linear-light values. Every custom shader that writes to a render target outputs linear sRGB-primaries values. Only the final pass converts to sRGB, and it does so explicitly (no `colorspace_fragment` include). Grain and dither are added after that conversion. Byte sRGB targets may encode storage on write and decode on sampling; sampled values and blending remain linear, preserving dark-colour byte precision.

`TextRaster.color?: string` is canonical opaque sRGB hex for monochrome glyphs; bitmap alpha supplies coverage including original fill alpha. The engine samples coverage and premultiplies the exact linear glyph colour. A raster without this metadata is converted per texel to linear premultiplied half-float RGBA before filtering. Raster bitmaps are created with `premultiplyAlpha: "premultiply"`.

`EngineOptions.cameraDistanceOverride?: number` is an isolated fixture override, not serialized document state. The lab exposes it through a development-only `cameraDistance` URL parameter so the F02 frontal screenshot test can use distance 0.7 without changing the CameraMove contract.

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
  style?: Partial<Style>; // keep user's brand style when re-applying
}
export interface Template {
  id: string;
  name: string;
  description: string; // one line, calm tone
  category: "desktop" | "mobile"; // the gallery tab; matches the screenshots' role
  slots: SlotSpec[];
  defaultDuration: number;
  toneSwitch?: boolean; // Light / Dark background switch in the Video inspector (Ash or Onyx)
  build(ctx: TemplateBuildContext): { style: Style; shots: Shot[]; loop: boolean };
}
export function fillSlots(t: Template, assets: AssetRef[]): Record<string, string | undefined>;
```

`fillSlots` is greedy by role and `prefer`. It never puts a `mobile`-role asset in a desktop slot or the reverse, and only reuses an asset when there are not enough distinct ones.

The built-in templates, in gallery order (`docs/phone-frames-plan/README.md`, D2, D3, D12): Desktop Slider (`desktop-slider`, the first-run default), Mobile Slider (`mobile-slider`), Desktop Frames (`frames`), Mobile Frames (`mobile-frames`), Desktop Stack (`desktop-stack`), Mobile Stack (`mobile-stack`; stack plan D5), Desktop Orbit (`desktop-orbit`), Mobile Orbit (`mobile-orbit`), Desktop Scroll Story (`scroll-story`) and Mobile Scroll Story (`mobile-scroll-story`, `docs/mobile-scroll-story-plan/README.md`). The two sliders are one effect in two sizes, and so are the two Frames presets, the two Stack presets (slider decks, §5), the two Orbit presets and the two Scroll Story presets. Removed templates leave their layouts in the engine, so saved projects keep rendering; a saved `templateId` that no longer exists is informational only.

Responsive Scroll (`responsive-scroll`, `docs/responsive-scroll-plan/README.md`) is last in the gallery. It shows a desktop and a mobile screenshot of one page, so its category is `"both"` and it sits under the Desktop and the Mobile tab (`templateInCategory`). Its two slots are a same-page pair (`Template.samePage`): `fillSlots` fills them with captures of one page (same capture URL, then the same page name in the file names) before the greedy fill.

The slider, Frames, Stack, Orbit and Responsive Scroll presets set `toneSwitch`. Their tone is not stored: it is read from `style.background` (Ash `#DFE1E3` is light, Onyx `#141417` is dark, anything else is neither), so it saves and loads with the style. `applyTemplate` keeps a dark document dark when it applies or rebuilds a `toneSwitch` template; every template still builds Ash by default.

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

Before posting, the main thread rasterises all text at export resolution and decodes all images at the needed size, then transfers the bitmaps. The worker never needs fonts or the DOM.
