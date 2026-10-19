export type Aspect = "16:9" | "9:16" | "1:1" | "4:5" | "4:3";
export type AssetRole = "desktop" | "mobile" | "tablet" | "logo" | "background" | "other";
export type EasingId =
  | "linear" | "gentle" | "smooth" | "expoOut" | "quintInOut" | "backOut" | "spring" | "slide";

/** A section of a captured page: its key (`id`, else `tag.class`) and top edge in image px. */
export interface CaptureSection {
  id: string;
  top: number;
}

export interface AssetMeta {
  tall?: boolean;          // image analysis (WP-13)
  hasStatusBar?: boolean;  // image analysis (WP-06)
  bottomColor?: string;    // image analysis (WP-06)
  sections?: CaptureSection[]; // from the capture's JSON, ascending (Responsive Scroll)
  page?: string;           // the capture's URL: pairs a desktop and a mobile capture of one page
}

export interface AssetRef {
  id: string;
  kind: "image" | "font";
  name: string;
  mime: string;
  bytes: number;
  width?: number;          // image px
  height?: number;         // image px
  role?: AssetRole;        // auto-detected (assets/roles.ts), user-editable
  meta?: AssetMeta;
  family?: string;         // font: CSS family name registered via FontFace
}

export type Background =
  | { kind: "solid"; color: string }
  | { kind: "gradient"; stops: string[]; angle: number; angleConvention?: "css" }; // CSS: 0 up, 90 right, 180 down. Unmarked persisted v2 = legacy math.

export type ShadowPreset = "none" | "soft" | "medium" | "dramatic";
export type FrameAppearance = "light" | "dark";
export type BrowserChrome = "standard" | "none";

export interface Style {
  background: Background;
  frameAppearance: FrameAppearance;
  browserChrome: BrowserChrome;
  browserUrl: string;      // shown in URL pill; "" hides text
  shadow: ShadowPreset;
  grain: number;           // 0..1 (0.25 ≈ quality-bar default)
  vignette: number;        // 0..1
}

export type DeviceKind = "browser" | "phone" | "card";

export type Layout =
  | { kind: "single"; device: DeviceKind; assetId: string }
  | { kind: "rows"; assetIds: string[]; rows: 1 | 2 | 3; device: "browser" | "card"; tilt: number;
      cardHeight?: number; gap?: number; travel: "period" }
  | { kind: "columns"; assetIds: string[]; columns: 2 | 3 | 4 | 5; tilt: number;
      device?: "phone" | "card"; cardWidth?: number; gap?: number; travel: "period" }
  | { kind: "slider"; assetIds: string[]; axis: "x" | "y"; shape: "mobile" | "desktop"; step: number;
      arrangement?: "carousel" | "deck" }
  | { kind: "orbit"; assetIds: string[]; shape: "mobile" | "desktop"; step: number }
  | { kind: "responsive"; desktopId: string; mobileId: string };
// rows and columns are Frames (Desktop Frames, Mobile Frames): lanes that each move exactly one
// asset period per loop, so the speed follows the shot duration. tilt: degrees of 3D tilt for the
// whole group (the presets use 0).
// slider.axis x: cards move left, the next comes in from the right. axis y: cards move up.
// slider.shape: mobile = portrait cards at the phone screen aspect; desktop = landscape cards.
// slider.step: seconds per screenshot, 1.6..4.0. Shot duration = assetIds.length × step. The
// step follows Shot.pace (Brisk 1.6, Default 2.0, Calm 2.4 s, clamped); so does a Frames shot's
// duration and Responsive Scroll's hold.
// slider.arrangement: "carousel" (default when unset: Desktop Slider, Mobile Slider) or "deck"
// (Desktop Stack, Mobile Stack): the front card leaves along the axis and the deck moves forward
// one slot per step, with the same step timing and duration.
// orbit: the screenshots on a ring seen from slightly above, cards always facing the camera. Each
// step turns the next card (from the right) to the front. shape and step as for slider; at most
// the first 6 screenshots are shown, so a shot lasts min(N, 6) × step.
// responsive: a desktop card (1.6) and a mobile card (0.4615) of one page that scroll together
// (Responsive Scroll, quality-bar §4): side by side at 16:9, 4:3 and 1:1, stacked at 4:5 and 9:16.
// rows.cardHeight: stage units (default: the per-row-count value). rows.gap: stage units between
// cards and rows (default: 0.14 × width across, 0.06 down).
// columns.device (default "phone") and columns.cardWidth and gap mirror rows, turned 90°. "card"
// draws portrait cards at the phone screen aspect 0.4615, whatever the image's own aspect.
// cardWidth: stage units (card height = cardWidth / 0.4615). gap: stage units between cards and
// columns.
// travel: always "period". Saved rows and columns from before 19 Oct 2026 without it were tilted
// marquees; loading maps them to Frames (src/doc/legacy-layouts.ts).

// The other ten moves were removed on 19 October 2026; a saved one loads as "static".
export type CameraPresetId = "static" | "pushIn";

export interface CameraMove {
  preset: CameraPresetId;
  intensity: number;       // 0..1, scales the preset's delta (quality-bar §2 limits apply at 1)
  easing: EasingId;
  float: number;           // 0..1 subtle ambient sway layered on top (quality-bar §2.4)
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
  sections?: string[];     // responsive: section keys to stop at after the top, in page order.
                           // Unset = the default stops; `stops` is the fallback without section data
  hold: number;            // seconds held at each stop
  easing: EasingId;
}

// The loop wrap: a cut, or a fade from the shot's end into its start (contracts.md §5). Blur,
// push, zoom and wipe went with multi-shot reels on 19 Oct 2026; saved ones load as fades.
export interface Transition {
  kind: "cut" | "fade";
  duration: number;        // seconds the wrap fade overlaps the end of the shot
  easing: EasingId;
}

export interface Shot {
  id: string;
  duration: number;        // seconds, 1..30
  layout: Layout;
  camera: CameraMove;
  scroll?: ScrollSpec;     // honoured for single-device and responsive layouts
  transitionIn: Transition;// the loop wrap transition when doc.loop
  styleOverrides?: Partial<Style>;
  // Calm or Brisk; unset is Default. Sliders, stacks, orbits, Frames and Responsive Scroll set
  // their step, duration or hold from it (src/motion/pace.ts, quality-bar §2.2).
  pace?: "calm" | "brisk";
}

export type DestinationId = "custom" | "web-embed" | "dribbble" | "instagram-feed" | "instagram-story"
  | "linkedin" | "x" | "presentation-4k";

export type ExportQuality = "web" | "high" | "master";
export type ExportFormat = "mp4" | "webm" | "bundle" | "png";

export interface ExportSettings {
  destination: DestinationId;
  resolution: number; // short side in px (16:9 1080 → 1920×1080, 4:3 1200 → 1600×1200, 4:5 1080 → 1080×1350)
  fps: number;
  quality: ExportQuality;
  format: ExportFormat;
  supersample: number;
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
  shots: Shot[];           // exactly one (multi-shot reels were cut on 19 Oct 2026)
  export: ExportSettings;
  templateId?: string;     // last applied template (informational)
}
