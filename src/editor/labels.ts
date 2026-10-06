/**
 * Human labels for document enums and ids (F08). The UI never shows a raw id such as
 * "pushIn" or "row1:col3"; every control, card and hint reads its copy from here.
 */
import type {
  Anchor,
  AssetRole,
  BrowserChrome,
  CameraPresetId,
  DestinationId,
  DeviceFinish,
  DeviceKind,
  EasingId,
  Layout,
  Shot,
  ShadowPreset,
  TextAnimId,
  TextLayer,
  Transition,
} from "../doc/types";

export const LAYOUT_LABELS: Record<Layout["kind"], string> = {
  single: "Single device",
  pair: "Responsive pair",
  trio: "Responsive trio",
  rows: "Marquee rows",
  columns: "Phone columns",
  wall: "Isometric wall",
  stack: "Cascading stack",
  title: "Title card",
};

export const DEVICE_LABELS: Record<DeviceKind, string> = {
  browser: "Browser",
  phone: "Phone",
  tablet: "Tablet",
  laptop: "Laptop",
  card: "Card",
};

export const CAMERA_LABELS: Record<CameraPresetId, string> = {
  static: "Static",
  pushIn: "Push in",
  pullBack: "Pull back",
  orbitLeft: "Orbit left",
  orbitRight: "Orbit right",
  tiltUp: "Tilt up",
  tiltDown: "Tilt down",
  riseUp: "Rise",
  dollyLeft: "Dolly left",
  dollyRight: "Dolly right",
  isoDrift: "Isometric drift",
  heroTilt: "Hero tilt",
};

/** Picker order: the calm moves first, then the directional pairs, then the showcase angles. */
export const CAMERA_PRESET_ORDER: CameraPresetId[] = [
  "static",
  "pushIn",
  "pullBack",
  "riseUp",
  "orbitLeft",
  "orbitRight",
  "tiltUp",
  "tiltDown",
  "dollyLeft",
  "dollyRight",
  "heroTilt",
  "isoDrift",
];

export const TRANSITION_LABELS: Record<Transition["kind"], string> = {
  cut: "Cut",
  fade: "Fade",
  blur: "Blur",
  push: "Push",
  zoom: "Zoom",
  wipe: "Wipe",
};

export const ENTRANCE_LABELS: Record<Shot["entrance"], string> = {
  none: "None",
  rise: "Rise",
  scale: "Scale up",
  stagger: "Stagger",
};

export const TEXT_ANIMATION_LABELS: Record<TextAnimId, string> = {
  none: "None",
  fadeUp: "Fade up",
  maskReveal: "Mask reveal",
  blurIn: "Blur in",
  wordStagger: "Word stagger",
  typewriter: "Typewriter",
};

export const TEXT_ROLE_LABELS: Record<TextLayer["role"], string> = {
  title: "Title",
  subtitle: "Subtitle",
  caption: "Caption",
  label: "Label",
};

export const EASING_LABELS: Record<EasingId, string> = {
  smooth: "Smooth",
  gentle: "Gentle",
  quintInOut: "Decisive",
  expoOut: "Ease out",
  backOut: "Overshoot",
  spring: "Spring",
  linear: "Linear",
};

export const SHADOW_LABELS: Record<ShadowPreset, string> = {
  none: "None",
  soft: "Soft",
  medium: "Medium",
  dramatic: "Dramatic",
};

export const BROWSER_CHROME_LABELS: Record<BrowserChrome, string> = {
  standard: "Standard",
  minimal: "Minimal",
  none: "None",
};

export const DEVICE_FINISH_LABELS: Record<DeviceFinish, string> = {
  graphite: "Graphite",
  silver: "Silver",
  black: "Black",
  sand: "Sand",
};

export const ASSET_ROLE_LABELS: Record<AssetRole, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
  logo: "Logo",
  background: "Background",
  other: "Other",
};

export const ANCHOR_LABELS: Record<Anchor, string> = {
  "top-left": "Top left",
  top: "Top",
  "top-right": "Top right",
  left: "Left",
  center: "Center",
  right: "Right",
  "bottom-left": "Bottom left",
  bottom: "Bottom",
  "bottom-right": "Bottom right",
};

/** Short names for the export destination picker. LinkedIn and X share one preset. */
export const DESTINATION_LABELS: Record<DestinationId, string> = {
  "web-embed": "Website",
  dribbble: "Dribbble",
  "instagram-feed": "Instagram",
  "instagram-story": "Story",
  linkedin: "LinkedIn & X",
  x: "LinkedIn & X",
  "presentation-4k": "4K presentation",
  custom: "Custom",
};

/** Select options for the given values, labelled from one of the maps above. */
export function optionsFor<T extends string>(
  labels: Record<T, string>,
  values: readonly T[] = Object.keys(labels) as T[],
): { value: T; label: string }[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

/** One-line description of a shot for the timeline card: "Browser · Push in". */
export function shotSummary(shot: Shot): string {
  const { layout } = shot;
  if (layout.kind === "title") return LAYOUT_LABELS.title;
  const subject =
    layout.kind === "single" ? DEVICE_LABELS[layout.device] : LAYOUT_LABELS[layout.kind];
  return `${subject} · ${CAMERA_LABELS[shot.camera.preset]}`;
}
