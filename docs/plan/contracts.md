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
               framing.ts · timeline.ts (scheduling, transitions, loop wrap) · scroll.ts
               text-anim.ts · cursor.ts · evaluate.ts (doc, t) → FrameState
  engine/      three.js, no React (except react/)
               Engine.ts · stage.ts (camera fit) · devices/ · backgrounds/ · shadows/ · materials/
               textures/ (tiling, downscale cache) · text/ (screen-space text pass)
               compositor.ts (shots → RT → transition) · post/ (final pass, motion blur)
               react/EngineCanvas.tsx (thin preview wrapper)
  text/        rasterize.ts (main thread only: text layer → ImageBitmap + word boxes)
  templates/   registry.ts · slots.ts · <one file per template>.ts
  export/      probe.ts · encode.ts · engine-worker.ts · engine-export.ts · destinations.ts
               verify.ts · bundle.ts · gif.ts
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
  "linear" | "gentle" | "smooth" | "expoOut" | "quintInOut" | "backOut" | "spring";

export interface AssetRef {
  id: string;
  kind: "image" | "font" | "audio";
  name: string;
  mime: string;
  bytes: number;
  width?: number; // image px
  height?: number; // image px
  role?: AssetRole; // auto-detected (assets/roles.ts), user-editable
  palette?: string[]; // image: 5 dominant colours, hex, most-to-least prominent
  meta?: { tall?: boolean; hasStatusBar?: boolean; bottomColor?: string }; // image analysis (WP-13, WP-06)
  family?: string; // font: CSS family name registered via FontFace
  durationSec?: number; // audio
  peaks?: number[]; // audio: 200 normalised (0..1) waveform peak buckets (WP-17)
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

export type DeviceKind = "browser" | "phone" | "tablet" | "laptop" | "card";

export type Layout =
  | { kind: "single"; device: DeviceKind; assetId: string }
  | { kind: "pair"; desktopId: string; mobileId: string; arrangement: "overlap" | "side" }
  | { kind: "trio"; desktopId: string; tabletId?: string; mobileId: string }
  | {
      kind: "rows";
      assetIds: string[];
      rows: 1 | 2 | 3;
      device: "browser" | "card";
      tilt: number;
      speed: number;
    }
  | { kind: "columns"; assetIds: string[]; columns: 2 | 3 | 4 | 5; tilt: number; speed: number }
  | { kind: "wall"; assetIds: string[]; columns: 3 | 4 | 5; speed: number }
  | { kind: "stack"; assetIds: string[]; device: "browser" | "card"; spread: number }
  | { kind: "title" };
// tilt: degrees of 3D tilt for the whole group; speed: 0..1 normalised (resolved to loop-safe px/s)

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

export interface Transition {
  kind: "cut" | "fade" | "blur" | "push" | "zoom" | "wipe";
  duration: number; // seconds, overlaps the previous shot (see §5)
  easing: EasingId;
  direction?: "left" | "right" | "up" | "down";
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
  entrance: "none" | "rise" | "scale" | "stagger"; // how layout nodes appear at shot start (quality-bar §2.2)
  scroll?: ScrollSpec; // honoured only for single-device layouts
  cursor?: CursorSpec; // honoured only for single-device layouts
  texts: TextLayer[];
  transitionIn: Transition; // for shots[0], used as the loop wrap transition when doc.loop
  styleOverrides?: Partial<Style>;
}

export interface AudioTrack {
  assetId: string;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  offset: number;
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
  motionBlur: boolean;
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
  shots: Shot[]; // length >= 1
  audio?: AudioTrack;
  export: ExportSettings;
  templateId?: string; // last applied template (informational)
}
```

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
  opacity: number; // 0..1 (entrances)
  scroll: number; // 0..1 of scrollable range (0 when scroll disabled)
  depthOrder: number; // tie-breaker for transparent sorting
}

export function resolveLayout(
  layout: Layout,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number, // local shot time, for marquee offsets and entrances
  shotDuration: number,
): LayoutNode[];
```

Screen aspect rules (quality-bar §3): `phone 0.4615` (9:19.5), `tablet 0.75`, desktop browser/laptop `clamp(imageAspect, 1.25, 2.0)` when the image is short, else `1.6`.

## 5. Timeline (`src/motion/timeline.ts`)

- Shot `i` starts at `s_0 = 0` and `s_{i+1} = s_i + duration_i − transitionIn_{i+1}.duration` (a `cut` has duration 0). A transition overlaps the end of the previous shot.
- `totalDuration = s_last + duration_last`. When `doc.loop` is true and the doc has more than one shot **or** `shots[0].transitionIn.kind !== "cut"`: `totalDuration −= shots[0].transitionIn.duration`, and in `[total − d0, total)` the last shot blends into shot 0 with shot-0 local time `t − total`, clamped to 0 (shot 0 holds its first pose while fading in). So frame(total) ≡ frame(0) for every loop.
- A single looping shot with a moving camera therefore loops by **wrap crossfade** (default 0.8 s fade).
- In a looping doc, shot 0 has no entrance (`evaluate` treats it as `"none"`). Its first frame is also the frame the loop wraps into, so an entrance there would dissolve the last shot into an empty canvas, or pop out at a cut wrap, on every loop. Later shots keep their entrances, and a doc that does not loop plays shot 0's entrance from t = 0. `loopSkipsEntrance(doc, index)` in `motion/evaluate.ts` is the rule; the editor uses it to say so under shot 0's Entrance select.
- Marquee layouts (`rows`, `columns`, `wall`) also loop by wrap crossfade. At the 0.12 frame widths per second limit (`quality-bar.md` §2.5) a shot cannot travel a whole asset period (N cards), so a native loop would need repeated screenshots in view. Instead `motion/layouts/marquee.ts` sets the speed from `Layout.speed` alone, independent of N, and snaps the travel per loop to a whole number of card steps `m ≥ 1` when one step fits under the limit (otherwise it keeps the target speed). For a single looping shot the loop length is `totalDuration`. During the wrap, the incoming marquee runs on its unclamped time `t − total` (`ActiveShot.wrapT`) while camera, text and entrances keep the clamped time, so the outgoing and incoming cards sit in the same places and only the screens dissolve.
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
  layers: { frame: ShotFrame; weight: number }[]; // 1 entry, or 2 during a transition
  transition?: { kind: Transition["kind"]; progress: number; direction?: Transition["direction"] };
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
  renderAccumulated(t: number, shutter: number, samples: number): void; // motion blur (export)
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

Renderer invariants: `WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer })`, `outputColorSpace = SRGBColorSpace`, `toneMapping = NoToneMapping`. Shots render into MSAA render targets (`samples: 4`). A composite pass blends the active layers and any transition into one linear target; the final pass then handles downsample, vignette, sRGB conversion, grain and dither to the canvas. `renderAt(t)` is `renderComposite` plus the final pass.

Render targets hold linear-light values. Every custom shader that writes to a render target outputs linear sRGB-primaries values. Only the final pass converts to sRGB, and it does so explicitly (no `colorspace_fragment` include). Grain and dither are added after that conversion. Byte sRGB targets may encode storage on write and decode on sampling; sampled values and blending remain linear, preserving dark-colour byte precision. Motion-blur accumulation averages `renderComposite` results (transitions included) in a linear half-float target, then runs the final pass once. Exports use 8 samples over a 180° shutter (`0.5 / fps`).

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
  category: "single" | "responsive" | "mobile" | "portfolio" | "reel";
  slots: SlotSpec[];
  defaultDuration: number;
  build(ctx: TemplateBuildContext): { style: Style; shots: Shot[]; loop: boolean };
}
export function fillSlots(t: Template, assets: AssetRef[]): Record<string, string | undefined>;
```

`fillSlots` is greedy by role and `prefer`. It never puts a `mobile`-role asset in a desktop slot or the reverse, and only reuses an asset when there are not enough distinct ones.

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
