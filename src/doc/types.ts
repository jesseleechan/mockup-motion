export type Aspect = "16:9" | "9:16" | "1:1" | "4:5" | "4:3";
export type AssetRole = "desktop" | "mobile" | "tablet" | "logo" | "background" | "other";
export type EasingId =
  | "linear" | "gentle" | "smooth" | "expoOut" | "quintInOut" | "backOut" | "spring";

export interface AssetRef {
  id: string;
  kind: "image" | "font" | "audio";
  name: string;
  mime: string;
  bytes: number;
  width?: number;          // image px
  height?: number;         // image px
  role?: AssetRole;        // auto-detected (assets/roles.ts), user-editable
  palette?: string[];      // image: 5 dominant colours, hex, most-to-least prominent
  meta?: { tall?: boolean; hasStatusBar?: boolean; bottomColor?: string }; // image analysis (WP-13, WP-06)
  family?: string;         // font: CSS family name registered via FontFace
  durationSec?: number;    // audio
  peaks?: number[];        // audio: 200 normalised (0..1) waveform peak buckets
}

export interface FontRef {
  source: "builtin" | "asset";
  family: string;          // builtin family name or AssetRef.family
  weight: number;          // 100..900
}

export type Background =
  | { kind: "solid"; color: string }
  | { kind: "gradient"; stops: string[]; angle: number; angleConvention?: "css" } // CSS: 0 up, 90 right, 180 down. Unmarked persisted v2 = legacy math.
  | { kind: "mesh"; colors: string[]; drift: number; seed: number }    // 3-5 colours, drift 0..1
  | { kind: "ambient"; assetId: string; blur: number; dim: number }   // blurred screenshot, 0..1
  | { kind: "image"; assetId: string; dim: number };

export type ShadowPreset = "none" | "soft" | "medium" | "dramatic";
export type FrameAppearance = "light" | "dark";
export type DeviceFinish = "graphite" | "silver" | "black" | "sand";
export type BrowserChrome = "standard" | "minimal" | "none";

export interface Style {
  background: Background;
  frameAppearance: FrameAppearance;
  deviceFinish: DeviceFinish;
  browserChrome: BrowserChrome;
  browserUrl: string;      // shown in URL pill; "" hides text
  shadow: ShadowPreset;
  grain: number;           // 0..1 (0.25 ≈ quality-bar default)
  vignette: number;        // 0..1
  fonts: { display: FontRef; body: FontRef };
  textColor: string;       // default text colour; "" = auto contrast vs background
  accent: string;          // cursor, highlights
}

export type DeviceKind = "browser" | "phone" | "tablet" | "laptop" | "card";

export type Layout =
  | { kind: "single"; device: DeviceKind; assetId: string }
  | { kind: "pair"; desktopId: string; mobileId: string; arrangement: "overlap" | "side" }
  | { kind: "trio"; desktopId: string; tabletId?: string; mobileId: string }
  | { kind: "rows"; assetIds: string[]; rows: 1 | 2 | 3; device: "browser" | "card"; tilt: number; speed: number }
  | { kind: "columns"; assetIds: string[]; columns: 2 | 3 | 4 | 5; tilt: number; speed: number }
  | { kind: "wall"; assetIds: string[]; columns: 3 | 4 | 5; speed: number }
  | { kind: "stack"; assetIds: string[]; device: "browser" | "card"; spread: number }
  | { kind: "title" };
// tilt: degrees of 3D tilt for the whole group; speed: 0..1 normalised (resolved to loop-safe px/s)

export type CameraPresetId =
  | "static" | "pushIn" | "pullBack" | "orbitLeft" | "orbitRight" | "tiltUp" | "tiltDown"
  | "riseUp" | "dollyLeft" | "dollyRight" | "isoDrift" | "heroTilt";

export interface CameraMove {
  preset: CameraPresetId;
  intensity: number;       // 0..1, scales the preset's delta (quality-bar §2 limits apply at 1)
  easing: EasingId;
  float: number;           // 0..1 subtle ambient sway layered on top (quality-bar §2.4)
  progressRange?: [number, number]; // [0..1] range of preset progress covered by this shot
}

export interface CameraPose {
  yaw: number;             // degrees, orbit around target (+ = camera moves right)
  pitch: number;           // degrees (+ = camera above, looking down)
  roll: number;            // degrees
  distance: number;        // multiple of the fit distance (1 = stage exactly fills frame)
  panX: number;            // stage units
  panY: number;            // stage units
  fov: number;             // vertical degrees; long lens (18-30) by default
}

export interface ScrollSpec {
  enabled: boolean;        // opt-in; never auto-enabled
  stops: number[];         // 0..1 positions in scrollable range, ascending, first is 0
  hold: number;            // seconds held at each stop
  easing: EasingId;
}

export type TextAnimId = "none" | "fadeUp" | "maskReveal" | "blurIn" | "wordStagger" | "typewriter";
export type Anchor = "top-left" | "top" | "top-right" | "left" | "center" | "right"
  | "bottom-left" | "bottom" | "bottom-right";

export interface TextLayer {
  id: string;
  text: string;
  role: "title" | "subtitle" | "caption" | "label";
  font: "display" | "body";
  size: number;            // % of frame height (e.g. 6 = 6%)
  anchor: Anchor;
  align: "left" | "center" | "right";
  color: string;           // "" = Style.textColor
  animation: TextAnimId;
  delay: number;           // seconds from shot start
  logoAssetId?: string;    // render a logo above the text
}

export interface Transition {
  kind: "cut" | "fade" | "blur" | "push" | "zoom" | "wipe";
  duration: number;        // seconds, overlaps the previous shot (see §5)
  easing: EasingId;
  direction?: "left" | "right" | "up" | "down";
}

export interface CursorKey { t: number; x: number; y: number; click?: boolean } // x,y 0..1 of device screen
export interface CursorSpec { enabled: boolean; style: "arrow" | "pointer" | "dot"; keys: CursorKey[] }

export interface Shot {
  id: string;
  duration: number;        // seconds, 1..30
  layout: Layout;
  camera: CameraMove;
  entrance: "none" | "rise" | "scale" | "stagger"; // how layout nodes appear at shot start (quality-bar §2.2)
  scroll?: ScrollSpec;     // honoured only for single-device layouts
  cursor?: CursorSpec;     // honoured only for single-device layouts
  texts: TextLayer[];
  transitionIn: Transition;// for shots[0], used as the loop wrap transition when doc.loop
  styleOverrides?: Partial<Style>;
}

export interface AudioTrack { assetId: string; volume: number; fadeIn: number; fadeOut: number; offset: number }

export type DestinationId = "custom" | "web-embed" | "dribbble" | "instagram-feed" | "instagram-story"
  | "linkedin" | "x" | "presentation-4k";

export type ExportQuality = "web" | "high" | "master";
export type ExportFormat = "mp4" | "webm" | "bundle" | "gif" | "png";

export interface ExportSettings {
  destination: DestinationId;
  resolution: number; // short side in px (16:9 1080 → 1920×1080, 4:3 1200 → 1600×1200, 4:5 1080 → 1080×1350)
  fps: number;
  quality: ExportQuality;
  format: ExportFormat;
  supersample: number;
  motionBlur: boolean;
}

export interface ProjectDoc {
  version: 2;
  id: string;
  name: string;
  createdAt: number;       // epoch ms (set by the store, never read by motion/engine)
  updatedAt: number;
  aspect: Aspect;
  loop: boolean;
  assets: AssetRef[];
  style: Style;
  shots: Shot[];           // length >= 1
  audio?: AudioTrack;
  export: ExportSettings;
  templateId?: string;     // last applied template (informational)
}
