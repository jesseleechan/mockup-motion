import { normalizeGradientAngle } from "./gradient-angle";
import { defaultCameraMove, defaultExport, defaultShot, defaultStyle } from "./defaults";
import { applyLegacyLook, legacyLook, mapLegacyLayout } from "./legacy-layouts";
import {
  clampSliderStep,
  fixedShotCamera,
  fixedShotDuration,
  MAX_SHOT_DURATION,
} from "../motion/layouts/duration";
import type {
  Aspect,
  AssetMeta,
  AssetRef,
  AssetRole,
  Background,
  BrowserChrome,
  CameraMove,
  CameraPresetId,
  CaptureSection,
  DeviceKind,
  EasingId,
  ExportSettings,
  Layout,
  ProjectDoc,
  ShadowPreset,
  Shot,
  Style,
  Transition,
} from "./types";

const VALID_ASPECTS: readonly Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
const VALID_EASINGS: readonly EasingId[] = [
  "linear",
  "gentle",
  "smooth",
  "expoOut",
  "quintInOut",
  "backOut",
  "spring",
  "slide",
];
const VALID_CAMERA_PRESETS: readonly CameraPresetId[] = ["static", "pushIn"];
const VALID_SHADOW_PRESETS: readonly ShadowPreset[] = ["none", "soft", "medium", "dramatic"];
const VALID_BROWSER_CHROMES: readonly BrowserChrome[] = ["standard", "none"];
// Saved laptops and tablets (cut on 19 Oct 2026) are unknown kinds, so they load as browsers.
const VALID_DEVICE_KINDS: readonly DeviceKind[] = ["browser", "phone", "card"];
const VALID_RESOLUTIONS = [720, 1080, 1200, 1440, 2160] as const;
const VALID_FPS = [24, 30, 60] as const;
const VALID_QUALITIES = ["web", "high", "master"] as const;
const VALID_FORMATS = ["mp4", "webm"] as const;
const VALID_SUPERSAMPLES = [1, 1.5, 2] as const;
const VALID_TRANSITIONS: readonly Transition["kind"][] = [
  "cut",
  "fade",
  "blur",
  "push",
  "zoom",
  "wipe",
];
function clamp(val: number, min: number, max: number): number {
  if (Number.isNaN(val) || typeof val !== "number") return min;
  return Math.max(min, Math.min(max, val));
}

function includesValue<T>(list: readonly T[], val: unknown): val is T {
  return list.includes(val as T);
}

export function sanitizeDoc(raw: unknown): { doc: ProjectDoc; warnings: string[] } {
  const warnings: string[] = [];
  const defaults = {
    style: defaultStyle(),
    export: defaultExport(),
  };

  if (!raw || typeof raw !== "object") {
    warnings.push("Input document was not an object. Replaced with default document.");
    return {
      doc: {
        version: 2,
        id: crypto.randomUUID(),
        name: "Untitled presentation",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        aspect: "16:9",
        loop: true,
        assets: [],
        style: defaults.style,
        shots: [defaultShot()],
        export: defaults.export,
      },
      warnings,
    };
  }

  const d = raw as Record<string, unknown>;

  // Assets
  const assets: AssetRef[] = [];
  const assetIdSet = new Set<string>();

  if (Array.isArray(d.assets)) {
    for (const a of d.assets) {
      if (a && typeof a === "object" && typeof a.id === "string" && a.id.trim()) {
        // Music was removed (October 2026). Drop saved audio assets, or they would
        // come back below as broken images.
        if (a.kind === "audio") continue;
        const id = a.id.trim();
        const kind = a.kind === "font" ? a.kind : "image";
        const ref: AssetRef = {
          id,
          kind,
          name: typeof a.name === "string" ? a.name : "Asset",
          mime:
            typeof a.mime === "string"
              ? a.mime
              : kind === "image"
                ? "image/png"
                : "application/octet-stream",
          bytes: typeof a.bytes === "number" && a.bytes >= 0 ? a.bytes : 0,
        };
        if (typeof a.width === "number") ref.width = a.width;
        if (typeof a.height === "number") ref.height = a.height;
        if (typeof a.role === "string") ref.role = a.role as AssetRole;
        if (a.meta && typeof a.meta === "object") ref.meta = sanitizeAssetMeta(a.meta);
        if (typeof a.family === "string") ref.family = a.family;

        assets.push(ref);
        assetIdSet.add(id);
      }
    }
  }

  // Style
  const rawStyle = (d.style && typeof d.style === "object" ? d.style : {}) as Record<
    string,
    unknown
  >;
  const style: Style = {
    background: sanitizeBackground(rawStyle.background),
    frameAppearance: rawStyle.frameAppearance === "dark" ? "dark" : "light",
    // Device finishes were removed: a saved `deviceFinish` is dropped, so every phone loads in
    // the one finish (quality-bar §3.3). The removed `minimal` chrome loads as `standard`.
    browserChrome: includesValue(VALID_BROWSER_CHROMES, rawStyle.browserChrome)
      ? rawStyle.browserChrome
      : defaults.style.browserChrome,
    browserUrl: typeof rawStyle.browserUrl === "string" ? rawStyle.browserUrl : "",
    shadow: includesValue(VALID_SHADOW_PRESETS, rawStyle.shadow)
      ? rawStyle.shadow
      : defaults.style.shadow,
    grain: clamp(typeof rawStyle.grain === "number" ? rawStyle.grain : defaults.style.grain, 0, 1),
    vignette: clamp(
      typeof rawStyle.vignette === "number" ? rawStyle.vignette : defaults.style.vignette,
      0,
      1,
    ),
  };

  // Export
  const rawExport = (d.export && typeof d.export === "object" ? d.export : {}) as Record<
    string,
    unknown
  >;
  const exp: ExportSettings = {
    destination:
      typeof rawExport.destination === "string"
        ? (rawExport.destination as ExportSettings["destination"])
        : "custom",
    resolution: includesValue(VALID_RESOLUTIONS, rawExport.resolution)
      ? rawExport.resolution
      : 1080,
    fps: includesValue(VALID_FPS, rawExport.fps) ? rawExport.fps : 30,
    quality: includesValue(VALID_QUALITIES, rawExport.quality) ? rawExport.quality : "high",
    format: includesValue(VALID_FORMATS, rawExport.format) ? rawExport.format : "mp4",
    supersample: includesValue(VALID_SUPERSAMPLES, rawExport.supersample)
      ? rawExport.supersample
      : 1.5,
  };

  // Shots
  const aspect: Aspect = includesValue(VALID_ASPECTS, d.aspect) ? d.aspect : "16:9";
  const shots: Shot[] = [];
  if (Array.isArray(d.shots)) {
    for (let i = 0; i < d.shots.length; i++) {
      const s = d.shots[i];
      if (s && typeof s === "object") {
        const sanitizedShot = sanitizeShot(
          s as Record<string, unknown>,
          assetIdSet,
          aspect,
          warnings,
          i,
        );
        if (sanitizedShot) {
          shots.push(sanitizedShot);
        }
      }
    }
  }

  if (shots.length === 0) {
    warnings.push("No valid shots found in document. Created a default shot.");
    shots.push(defaultShot());
  }

  // A scrolling responsive layout lasts its holds plus moves, which depend on its screenshots
  // (contracts.md §5), so its length is set once the assets are known.
  for (const shot of shots) {
    const fixed = fixedShotDuration(shot.layout, shot.scroll, assets);
    if (fixed !== null) shot.duration = fixed;
  }

  const doc: ProjectDoc = {
    version: 2,
    id: typeof d.id === "string" && d.id ? d.id : crypto.randomUUID(),
    name: typeof d.name === "string" && d.name.trim() ? d.name.trim() : "Untitled presentation",
    createdAt: typeof d.createdAt === "number" && d.createdAt > 0 ? d.createdAt : Date.now(),
    updatedAt: typeof d.updatedAt === "number" && d.updatedAt > 0 ? d.updatedAt : Date.now(),
    aspect,
    loop: typeof d.loop === "boolean" ? d.loop : true,
    assets,
    style,
    shots,
    export: exp,
  };

  if (typeof d.templateId === "string" && d.templateId) {
    doc.templateId = d.templateId;
  }

  return { doc, warnings };
}

// The Ash palette's fill (quality-bar §6), which removed screenshot backgrounds load as.
const ASH = "#DFE1E3";

function meshToGradient(colors: unknown): Background {
  const hexes = Array.isArray(colors)
    ? colors.filter((c): c is string => typeof c === "string")
    : [];
  const first = hexes[0] ?? "#1B1B2F";
  const last = hexes[hexes.length - 1] ?? first;
  // The angle and convention of the light built-in gradients (quality-bar §6).
  return { kind: "gradient", stops: [first, last], angle: 315, angleConvention: "css" };
}

function sanitizeBackground(bg: unknown): Background {
  if (!bg || typeof bg !== "object") {
    return defaultStyle().background;
  }
  const b = bg as Record<string, unknown>;
  switch (b.kind) {
    case "solid":
      return { kind: "solid", color: typeof b.color === "string" ? b.color : "#F1EDE6" };
    case "gradient":
      return normalizeGradientAngle({
        kind: "gradient",
        stops:
          Array.isArray(b.stops) && b.stops.length >= 2
            ? b.stops.slice(0, 3).map((s) => (typeof s === "string" ? s : "#F1EDE6"))
            : ["#F1EDE6", "#E3DCD0"],
        angle: typeof b.angle === "number" ? ((b.angle % 360) + 360) % 360 : 135,
        ...(b.angleConvention === "css" ? { angleConvention: "css" as const } : {}),
      });
    case "mesh":
      // Mesh backgrounds were removed: keep their colours as a gradient from first to last.
      return meshToGradient(b.colors);
    case "ambient":
    case "image":
      // Ambient and image backgrounds were removed: they load as the flat Ash fill.
      return { kind: "solid", color: ASH };
    default:
      return defaultStyle().background;
  }
}

function sanitizeShot(
  s: Record<string, unknown>,
  assetIds: Set<string>,
  aspect: Aspect,
  warnings: string[],
  shotIndex: number,
): Shot | null {
  // Title cards and text layers were removed (October 2026). A saved title card has no
  // screenshot to show, so it is dropped; text layers on other shots are dropped silently.
  if ((s.layout as { kind?: unknown } | undefined)?.kind === "title") {
    warnings.push(
      `Shot ${shotIndex} was a title card, which is no longer supported, and was dropped.`,
    );
    return null;
  }
  const layout = sanitizeLayout(s.layout, assetIds, aspect, warnings, shotIndex);
  if (!layout) {
    warnings.push(`Shot ${shotIndex} had an invalid layout and was dropped.`);
    return null;
  }

  const camera: CameraMove = sanitizeCamera(s.camera);
  const entrance = ["none", "rise", "scale", "stagger"].includes(s.entrance as string)
    ? (s.entrance as Shot["entrance"])
    : "none";

  const transitionIn: Transition = sanitizeTransition(s.transitionIn);

  const shot: Shot = {
    id: typeof s.id === "string" && s.id ? s.id : crypto.randomUUID(),
    // A slider or orbit sets its own length (N × step), so its loop stays native (contracts.md §5).
    duration:
      fixedShotDuration(layout) ??
      clamp(typeof s.duration === "number" ? s.duration : 5, 1, MAX_SHOT_DURATION),
    layout,
    // A slider's or orbit's camera is still, so its loop stays native (quality bar §4).
    camera: fixedShotCamera(layout, camera),
    entrance,
    transitionIn,
  };

  // A removed layout takes its preset look's camera, entrance, wrap and length.
  const look =
    s.layout && typeof s.layout === "object"
      ? legacyLook(s.layout as Record<string, unknown>)
      : null;
  if (look) applyLegacyLook(shot, look, aspect);

  if (s.scroll && typeof s.scroll === "object") {
    const sc = s.scroll as Record<string, unknown>;
    shot.scroll = {
      enabled: Boolean(sc.enabled),
      stops: Array.isArray(sc.stops)
        ? sc.stops.map((v) => clamp(Number(v), 0, 1)).sort((a, b) => a - b)
        : [0, 1],
      hold: clamp(typeof sc.hold === "number" ? sc.hold : 0.8, 0, 10),
      easing: includesValue(VALID_EASINGS, sc.easing) ? sc.easing : "smooth",
    };
    // Responsive Scroll's section stops: keys in page order; unset means the default stops.
    if (Array.isArray(sc.sections)) {
      shot.scroll.sections = sc.sections.filter(
        (key): key is string => typeof key === "string" && key !== "",
      );
    }
  }

  if (s.styleOverrides && typeof s.styleOverrides === "object") {
    // Preserve partial overrides; normalize their background using the same
    // persistence boundary as document style. Other fields keep existing semantics.
    const overrides = s.styleOverrides as Partial<Style>;
    shot.styleOverrides = {
      ...overrides,
      ...(overrides.background ? { background: sanitizeBackground(overrides.background) } : {}),
    };
  }

  return shot;
}

function sanitizeLayout(
  layout: unknown,
  assetIds: Set<string>,
  aspect: Aspect,
  warnings: string[],
  shotIndex: number,
): Layout | null {
  if (!layout || typeof layout !== "object") return null;
  const l = layout as Record<string, unknown>;

  const checkAsset = (id: unknown, field: string): string => {
    if (typeof id !== "string" || !id) return "";
    if (!assetIds.has(id)) {
      warnings.push(
        `Shot ${shotIndex} layout referenced missing asset '${id}' in ${field}. Set to empty.`,
      );
      return "";
    }
    return id;
  };

  const look = legacyLook(l);
  if (look) {
    const ids = Array.isArray(l.assetIds)
      ? l.assetIds.map((id) => checkAsset(id, "assetIds")).filter(Boolean)
      : [];
    return mapLegacyLayout(l, aspect, ids, checkAsset(l.desktopId, "desktopId"));
  }

  switch (l.kind) {
    case "single":
      return {
        kind: "single",
        device: includesValue(VALID_DEVICE_KINDS, l.device) ? l.device : "browser",
        assetId: checkAsset(l.assetId, "assetId"),
      };
    case "responsive":
      return {
        kind: "responsive",
        desktopId: checkAsset(l.desktopId, "desktopId"),
        mobileId: checkAsset(l.mobileId, "mobileId"),
      };
    case "rows": {
      const res: Layout = {
        kind: "rows",
        assetIds: Array.isArray(l.assetIds)
          ? l.assetIds.map((id) => checkAsset(id, "assetIds")).filter(Boolean)
          : [],
        rows: l.rows === 1 || l.rows === 2 || l.rows === 3 ? l.rows : 2,
        device: l.device === "card" ? "card" : "browser",
        tilt: typeof l.tilt === "number" ? l.tilt : 0,
        travel: "period",
      };
      if (typeof l.cardHeight === "number" && Number.isFinite(l.cardHeight)) {
        res.cardHeight = clamp(l.cardHeight, 0.1, 0.8);
      }
      if (typeof l.gap === "number" && Number.isFinite(l.gap)) {
        res.gap = clamp(l.gap, 0, 0.5);
      }
      return res;
    }
    case "columns": {
      const cols = Number(l.columns);
      const columns = cols === 2 || cols === 3 || cols === 4 || cols === 5 ? cols : 3;
      const res: Layout = {
        kind: "columns",
        assetIds: Array.isArray(l.assetIds)
          ? l.assetIds.map((id) => checkAsset(id, "assetIds")).filter(Boolean)
          : [],
        columns,
        tilt: typeof l.tilt === "number" ? l.tilt : 0,
        travel: "period",
      };
      // "phone", the default, stays unset.
      if (l.device === "card") res.device = "card";
      if (typeof l.cardWidth === "number" && Number.isFinite(l.cardWidth)) {
        res.cardWidth = clamp(l.cardWidth, 0.1, 0.8);
      }
      if (typeof l.gap === "number" && Number.isFinite(l.gap)) {
        res.gap = clamp(l.gap, 0, 0.5);
      }
      return res;
    }
    case "slider": {
      const sliderIds = Array.isArray(l.assetIds)
        ? l.assetIds.map((id) => checkAsset(id, "assetIds")).filter(Boolean)
        : [];
      return {
        kind: "slider",
        assetIds: sliderIds,
        axis: l.axis === "y" ? "y" : "x",
        shape: l.shape === "desktop" ? "desktop" : "mobile",
        // Quality bar §2.2: 1.6–4.0 s per step (default 2.0 s), and short enough that one step
        // per screenshot fits in a 30 s shot.
        step: clampSliderStep(
          typeof l.step === "number" && Number.isFinite(l.step) ? l.step : 2,
          sliderIds.length,
        ),
        // Unset is the carousel; saved sliders from before the deck have no arrangement.
        ...(l.arrangement === "deck" || l.arrangement === "carousel"
          ? { arrangement: l.arrangement }
          : {}),
      };
    }
    case "orbit": {
      const orbitIds = Array.isArray(l.assetIds)
        ? l.assetIds.map((id) => checkAsset(id, "assetIds")).filter(Boolean)
        : [];
      return {
        kind: "orbit",
        assetIds: orbitIds,
        shape: l.shape === "desktop" ? "desktop" : "mobile",
        // The slider's step range (quality bar §2.2).
        step: clampSliderStep(
          typeof l.step === "number" && Number.isFinite(l.step) ? l.step : 2,
          orbitIds.length,
        ),
      };
    }
    default:
      return null;
  }
}

function sanitizeCamera(camera: unknown): CameraMove {
  if (!camera || typeof camera !== "object") return defaultCameraMove();
  const c = camera as Record<string, unknown>;
  return {
    // A removed move (orbit, tilt, dolly, ...) or an unknown one loads as a still camera.
    preset: includesValue(VALID_CAMERA_PRESETS, c.preset) ? c.preset : "static",
    intensity: clamp(typeof c.intensity === "number" ? c.intensity : 0.5, 0, 1),
    easing: includesValue(VALID_EASINGS, c.easing) ? c.easing : "smooth",
    float: clamp(typeof c.float === "number" ? c.float : 0.3, 0, 1),
  };
}

function sanitizeTransition(trans: unknown): Transition {
  if (!trans || typeof trans !== "object") {
    return { kind: "cut", duration: 0, easing: "quintInOut" };
  }
  const t = trans as Record<string, unknown>;
  const kind = includesValue(VALID_TRANSITIONS, t.kind) ? t.kind : "cut";
  return {
    kind,
    duration: clamp(typeof t.duration === "number" ? t.duration : 0.7, 0, 5),
    easing: includesValue(VALID_EASINGS, t.easing) ? t.easing : "quintInOut",
    direction: ["left", "right", "up", "down"].includes(t.direction as string)
      ? (t.direction as Transition["direction"])
      : undefined,
  };
}

/**
 * Keeps well-formed section data on a stored asset's meta and drops the rest: sections need a
 * string id and a top ≥ 0, sorted ascending; page must be a string.
 */
function sanitizeAssetMeta(meta: AssetMeta): AssetMeta {
  const clean: AssetMeta = { ...meta };
  if (Array.isArray(meta.sections)) {
    const sections = (meta.sections as unknown[])
      .filter(
        (s): s is CaptureSection =>
          !!s &&
          typeof s === "object" &&
          typeof (s as CaptureSection).id === "string" &&
          (s as CaptureSection).id !== "" &&
          Number.isFinite((s as CaptureSection).top) &&
          (s as CaptureSection).top >= 0,
      )
      .map((s) => ({ id: s.id, top: s.top }))
      .sort((a, b) => a.top - b.top);
    if (sections.length > 0) clean.sections = sections;
    else delete clean.sections;
  } else {
    delete clean.sections;
  }
  if (typeof meta.page !== "string") delete clean.page;
  return clean;
}
