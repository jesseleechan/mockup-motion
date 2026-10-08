import { clampAudioTrack } from "../audio/mix";
import { normalizeGradientAngle } from "./gradient-angle";
import { defaultCameraMove, defaultExport, defaultShot, defaultStyle } from "./defaults";
import type {
  Aspect,
  AssetRef,
  AudioTrack,
  AssetRole,
  Background,
  BrowserChrome,
  CameraMove,
  CameraPresetId,
  DeviceFinish,
  DeviceKind,
  EasingId,
  ExportSettings,
  FontRef,
  Layout,
  ProjectDoc,
  ShadowPreset,
  Shot,
  Style,
  TextAnimId,
  TextLayer,
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
const VALID_CAMERA_PRESETS: readonly CameraPresetId[] = [
  "static",
  "pushIn",
  "pullBack",
  "orbitLeft",
  "orbitRight",
  "tiltUp",
  "tiltDown",
  "riseUp",
  "dollyLeft",
  "dollyRight",
  "isoDrift",
  "heroTilt",
];
const VALID_SHADOW_PRESETS: readonly ShadowPreset[] = ["none", "soft", "medium", "dramatic"];
const VALID_DEVICE_FINISHES: readonly DeviceFinish[] = ["graphite", "silver", "black", "sand"];
const VALID_BROWSER_CHROMES: readonly BrowserChrome[] = ["standard", "minimal", "none"];
const VALID_DEVICE_KINDS: readonly DeviceKind[] = ["browser", "phone", "tablet", "laptop", "card"];
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
const VALID_TEXT_ANIMS: readonly TextAnimId[] = [
  "none",
  "fadeUp",
  "maskReveal",
  "blurIn",
  "wordStagger",
  "typewriter",
];
const VALID_ANCHORS: readonly TextLayer["anchor"][] = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
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
        const id = a.id.trim();
        const kind = a.kind === "font" || a.kind === "audio" ? a.kind : "image";
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
        if (Array.isArray(a.palette))
          ref.palette = a.palette.filter((p: unknown): p is string => typeof p === "string");
        if (a.meta && typeof a.meta === "object") ref.meta = a.meta;
        if (typeof a.family === "string") ref.family = a.family;
        if (typeof a.durationSec === "number") ref.durationSec = a.durationSec;
        if (Array.isArray(a.peaks)) {
          ref.peaks = a.peaks.filter((p: unknown): p is number => typeof p === "number");
        }

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
    background: sanitizeBackground(rawStyle.background, assetIdSet, warnings),
    frameAppearance: rawStyle.frameAppearance === "dark" ? "dark" : "light",
    deviceFinish: includesValue(VALID_DEVICE_FINISHES, rawStyle.deviceFinish)
      ? rawStyle.deviceFinish
      : defaults.style.deviceFinish,
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
    fonts: sanitizeFonts(rawStyle.fonts, defaults.style.fonts),
    textColor: typeof rawStyle.textColor === "string" ? rawStyle.textColor : "",
    accent:
      typeof rawStyle.accent === "string" && rawStyle.accent
        ? rawStyle.accent
        : defaults.style.accent,
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
    motionBlur: Boolean(rawExport.motionBlur),
  };

  // Shots
  const shots: Shot[] = [];
  if (Array.isArray(d.shots)) {
    for (let i = 0; i < d.shots.length; i++) {
      const s = d.shots[i];
      if (s && typeof s === "object") {
        const sanitizedShot = sanitizeShot(s as Record<string, unknown>, assetIdSet, warnings, i);
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

  const doc: ProjectDoc = {
    version: 2,
    id: typeof d.id === "string" && d.id ? d.id : crypto.randomUUID(),
    name: typeof d.name === "string" && d.name.trim() ? d.name.trim() : "Untitled presentation",
    createdAt: typeof d.createdAt === "number" && d.createdAt > 0 ? d.createdAt : Date.now(),
    updatedAt: typeof d.updatedAt === "number" && d.updatedAt > 0 ? d.updatedAt : Date.now(),
    aspect: includesValue(VALID_ASPECTS, d.aspect) ? d.aspect : "16:9",
    loop: typeof d.loop === "boolean" ? d.loop : true,
    assets,
    style,
    shots,
    export: exp,
  };

  if (typeof d.templateId === "string" && d.templateId) {
    doc.templateId = d.templateId;
  }

  const audio = sanitizeAudio(d.audio, assets, warnings);
  if (audio) doc.audio = audio;

  return { doc, warnings };
}

function sanitizeAudio(raw: unknown, assets: AssetRef[], warnings: string[]): AudioTrack | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const assetId = typeof a.assetId === "string" ? a.assetId : "";
  if (!assets.some((x) => x.id === assetId && x.kind === "audio")) {
    warnings.push(`Music asset '${assetId}' not found. Removed the music track.`);
    return null;
  }
  return clampAudioTrack({
    assetId,
    volume: typeof a.volume === "number" ? a.volume : 0.8,
    fadeIn: typeof a.fadeIn === "number" ? a.fadeIn : 0.5,
    fadeOut: typeof a.fadeOut === "number" ? a.fadeOut : 1.5,
    offset: typeof a.offset === "number" ? a.offset : 0,
  });
}

function sanitizeBackground(bg: unknown, assetIds: Set<string>, warnings: string[]): Background {
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
      return {
        kind: "mesh",
        colors:
          Array.isArray(b.colors) && b.colors.length >= 3
            ? b.colors.slice(0, 5).map((c) => (typeof c === "string" ? c : "#F1EDE6"))
            : ["#1B1B2F", "#3A2F4F", "#6B4E71", "#C3A6A0"],
        drift: clamp(typeof b.drift === "number" ? b.drift : 0.05, 0, 1),
        seed: typeof b.seed === "number" ? b.seed : 42,
      };
    case "ambient": {
      const assetId = typeof b.assetId === "string" ? b.assetId : "";
      if (!assetIds.has(assetId)) {
        warnings.push(
          `Background ambient screenshot asset '${assetId}' not found. Cleared asset reference.`,
        );
        return {
          kind: "ambient",
          assetId: "",
          blur: clamp(typeof b.blur === "number" ? b.blur : 0.8, 0, 1),
          dim: clamp(typeof b.dim === "number" ? b.dim : 0.2, 0, 1),
        };
      }
      return {
        kind: "ambient",
        assetId,
        blur: clamp(typeof b.blur === "number" ? b.blur : 0.8, 0, 1),
        dim: clamp(typeof b.dim === "number" ? b.dim : 0.2, 0, 1),
      };
    }
    case "image": {
      const assetId = typeof b.assetId === "string" ? b.assetId : "";
      if (!assetIds.has(assetId)) {
        warnings.push(`Background image asset '${assetId}' not found. Cleared asset reference.`);
        return {
          kind: "image",
          assetId: "",
          dim: clamp(typeof b.dim === "number" ? b.dim : 0, 0, 1),
        };
      }
      return {
        kind: "image",
        assetId,
        dim: clamp(typeof b.dim === "number" ? b.dim : 0, 0, 1),
      };
    }
    default:
      return defaultStyle().background;
  }
}

function sanitizeFonts(fonts: unknown, fallback: Style["fonts"]): Style["fonts"] {
  if (!fonts || typeof fonts !== "object") return fallback;
  const f = fonts as Record<string, unknown>;

  const cleanFontRef = (r: unknown, def: FontRef): FontRef => {
    if (!r || typeof r !== "object") return def;
    const ref = r as Record<string, unknown>;
    return {
      source: ref.source === "asset" ? "asset" : "builtin",
      family: typeof ref.family === "string" && ref.family ? ref.family : def.family,
      weight: typeof ref.weight === "number" ? clamp(ref.weight, 100, 900) : def.weight,
    };
  };

  return {
    display: cleanFontRef(f.display, fallback.display),
    body: cleanFontRef(f.body, fallback.body),
  };
}

function sanitizeShot(
  s: Record<string, unknown>,
  assetIds: Set<string>,
  warnings: string[],
  shotIndex: number,
): Shot | null {
  const layout = sanitizeLayout(s.layout, assetIds, warnings, shotIndex);
  if (!layout) {
    warnings.push(`Shot ${shotIndex} had an invalid layout and was dropped.`);
    return null;
  }

  const camera: CameraMove = sanitizeCamera(s.camera);
  const entrance = ["none", "rise", "scale", "stagger"].includes(s.entrance as string)
    ? (s.entrance as Shot["entrance"])
    : "none";

  const transitionIn: Transition = sanitizeTransition(s.transitionIn);

  const texts: TextLayer[] = [];
  if (Array.isArray(s.texts)) {
    for (const t of s.texts) {
      if (t && typeof t === "object") {
        texts.push(sanitizeTextLayer(t as Record<string, unknown>, assetIds));
      }
    }
  }

  const shot: Shot = {
    id: typeof s.id === "string" && s.id ? s.id : crypto.randomUUID(),
    duration: clamp(typeof s.duration === "number" ? s.duration : 5, 1, 30),
    layout,
    camera,
    entrance,
    texts,
    transitionIn,
  };

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
  }

  if (s.styleOverrides && typeof s.styleOverrides === "object") {
    // Preserve partial overrides; normalize their background using the same
    // persistence boundary as document style. Other fields keep existing semantics.
    const overrides = s.styleOverrides as Partial<Style>;
    shot.styleOverrides = {
      ...overrides,
      ...(overrides.background
        ? { background: sanitizeBackground(overrides.background, assetIds, warnings) }
        : {}),
    };
  }

  return shot;
}

function sanitizeLayout(
  layout: unknown,
  assetIds: Set<string>,
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

  switch (l.kind) {
    case "single":
      return {
        kind: "single",
        device: includesValue(VALID_DEVICE_KINDS, l.device) ? l.device : "browser",
        assetId: checkAsset(l.assetId, "assetId"),
      };
    case "pair":
      return {
        kind: "pair",
        desktopId: checkAsset(l.desktopId, "desktopId"),
        mobileId: checkAsset(l.mobileId, "mobileId"),
        arrangement: l.arrangement === "side" ? "side" : "overlap",
      };
    case "trio": {
      const res: Layout = {
        kind: "trio",
        desktopId: checkAsset(l.desktopId, "desktopId"),
        mobileId: checkAsset(l.mobileId, "mobileId"),
      };
      if (typeof l.tabletId === "string") {
        res.tabletId = checkAsset(l.tabletId, "tabletId");
      }
      return res;
    }
    case "rows":
      return {
        kind: "rows",
        assetIds: Array.isArray(l.assetIds)
          ? l.assetIds.map((id) => checkAsset(id, "assetIds")).filter(Boolean)
          : [],
        rows: l.rows === 1 || l.rows === 2 || l.rows === 3 ? l.rows : 2,
        device: l.device === "card" ? "card" : "browser",
        tilt: typeof l.tilt === "number" ? l.tilt : 12,
        speed: clamp(typeof l.speed === "number" ? l.speed : 0.35, 0, 1),
      };
    case "columns": {
      const cols = Number(l.columns);
      const columns = cols === 2 || cols === 3 || cols === 4 || cols === 5 ? cols : 3;
      return {
        kind: "columns",
        assetIds: Array.isArray(l.assetIds)
          ? l.assetIds.map((id) => checkAsset(id, "assetIds")).filter(Boolean)
          : [],
        columns,
        tilt: typeof l.tilt === "number" ? l.tilt : 12,
        speed: clamp(typeof l.speed === "number" ? l.speed : 0.35, 0, 1),
      };
    }
    case "wall": {
      const cols = Number(l.columns);
      const columns = cols === 3 || cols === 4 || cols === 5 ? cols : 4;
      return {
        kind: "wall",
        assetIds: Array.isArray(l.assetIds)
          ? l.assetIds.map((id) => checkAsset(id, "assetIds")).filter(Boolean)
          : [],
        columns,
        speed: clamp(typeof l.speed === "number" ? l.speed : 0.2, 0, 1),
      };
    }
    case "stack":
      return {
        kind: "stack",
        assetIds: Array.isArray(l.assetIds)
          ? l.assetIds.map((id) => checkAsset(id, "assetIds")).filter(Boolean)
          : [],
        device: l.device === "card" ? "card" : "browser",
        spread: clamp(typeof l.spread === "number" ? l.spread : 0.3, 0, 1),
      };
    case "slider":
      return {
        kind: "slider",
        assetIds: Array.isArray(l.assetIds)
          ? l.assetIds.map((id) => checkAsset(id, "assetIds")).filter(Boolean)
          : [],
        axis: l.axis === "y" ? "y" : "x",
        shape: l.shape === "desktop" ? "desktop" : "mobile",
        // Quality bar §2.2: 1.6–4.0 s per step, default 2.0 s.
        step: clamp(typeof l.step === "number" && Number.isFinite(l.step) ? l.step : 2, 1.6, 4),
      };
    case "title":
      return { kind: "title" };
    default:
      return null;
  }
}

function sanitizeCamera(camera: unknown): CameraMove {
  if (!camera || typeof camera !== "object") return defaultCameraMove();
  const c = camera as Record<string, unknown>;
  return {
    preset: includesValue(VALID_CAMERA_PRESETS, c.preset) ? c.preset : "pushIn",
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

function sanitizeTextLayer(t: Record<string, unknown>, assetIds: Set<string>): TextLayer {
  const layer: TextLayer = {
    id: typeof t.id === "string" && t.id ? t.id : crypto.randomUUID(),
    text: typeof t.text === "string" ? t.text : "",
    role: ["title", "subtitle", "caption", "label"].includes(t.role as string)
      ? (t.role as TextLayer["role"])
      : "title",
    font: t.font === "body" ? "body" : "display",
    size: clamp(typeof t.size === "number" ? t.size : 6, 1.6, 20),
    anchor: includesValue(VALID_ANCHORS, t.anchor) ? t.anchor : "center",
    align: t.align === "left" || t.align === "right" ? t.align : "center",
    color: typeof t.color === "string" ? t.color : "",
    animation: includesValue(VALID_TEXT_ANIMS, t.animation) ? t.animation : "none",
    delay: clamp(typeof t.delay === "number" ? t.delay : 0, 0, 30),
  };

  if (typeof t.logoAssetId === "string" && assetIds.has(t.logoAssetId)) {
    layer.logoAssetId = t.logoAssetId;
  }

  return layer;
}
