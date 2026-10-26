/**
 * Human labels for document enums and ids (F08). The UI never shows a raw id such as
 * "pushIn" or "row1:col3"; every control, card and hint reads its copy from here.
 */
import type {
  AssetRole,
  BrowserChrome,
  CameraPresetId,
  DestinationId,
  DeviceKind,
  EasingId,
  Layout,
  Shot,
  ShadowPreset,
} from "../doc/types";
import type { TemplateCategory } from "../templates";

export const LAYOUT_LABELS: Record<Layout["kind"], string> = {
  single: "Single device",
  rows: "Desktop frames",
  columns: "Mobile frames",
  slider: "Slider",
  orbit: "Orbit",
  tour: "Site tour",
  responsive: "Responsive scroll",
  pageColumns: "Page columns",
};

export const DEVICE_LABELS: Record<DeviceKind, string> = {
  browser: "Browser",
  phone: "Phone",
  card: "Card",
};

export const CAMERA_LABELS: Record<CameraPresetId, string> = {
  static: "Still",
  pushIn: "Push in",
};

export const CAMERA_PRESET_ORDER: CameraPresetId[] = ["static", "pushIn"];

export const EASING_LABELS: Record<EasingId, string> = {
  smooth: "Smooth",
  gentle: "Gentle",
  quintInOut: "Decisive",
  expoOut: "Ease out",
  backOut: "Overshoot",
  spring: "Spring",
  slide: "Slide",
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
  none: "None",
};

export const ASSET_ROLE_LABELS: Record<AssetRole, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
  logo: "Logo",
  background: "Background",
  other: "Other",
};

/** Short names for the export destination picker. */
export const DESTINATION_LABELS: Record<DestinationId, string> = {
  video: "Video",
  dribbble: "Dribbble",
  "instagram-feed": "Instagram",
  "instagram-story": "Story",
  "presentation-4k": "4K presentation",
  "web-embed": "Web bundle",
  custom: "Custom",
};

/** The template tabs, which match the preset pairs' names (Frames plan §8). */
export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  both: "Desktop + mobile",
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
  return `${shotSubject(layout)} · ${CAMERA_LABELS[shot.camera.preset]}`;
}

/** The shot card's subject. The Frames presets read as their own names (Frames plan D3, D4). */
function shotSubject(layout: Layout): string {
  if (layout.kind === "single") return DEVICE_LABELS[layout.device];
  if (layout.kind === "slider" && layout.arrangement === "deck") {
    return layout.shape === "mobile" ? "Mobile stack" : "Desktop stack";
  }
  if (layout.kind === "tour") {
    return layout.device === "phone" ? "Mobile site tour" : "Desktop site tour";
  }
  if (layout.kind === "pageColumns") {
    return layout.shape === "mobile" ? "Mobile page columns" : "Desktop page columns";
  }
  return LAYOUT_LABELS[layout.kind];
}

/** "19.5 s", "20 s": whole seconds drop the decimal. */
export function formatSeconds(seconds: number): string {
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} s`;
}
