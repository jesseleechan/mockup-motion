import { defaultExport, defaultStyle } from "./defaults";
import { sanitizeDoc } from "./validate";
import type {
  Aspect,
  AssetRef,
  Background,
  CameraMove,
  CameraPresetId,
  DeviceFinish,
  DeviceKind,
  ExportSettings,
  Layout,
  ProjectDoc,
  ShadowPreset,
  Shot,
  Style,
  TextLayer,
} from "./types";

// V1 types copied verbatim so migrate.ts has zero dependencies on legacy src/types.ts
export type V1AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";
export type V1Layout = "hero" | "rows" | "grid" | "columns" | "pair";
export type V1Frame = "browser" | "rounded" | "none" | "phone";
export type V1DeviceFrameFinish = "midnight" | "titanium" | "silver" | "gold";

export interface V1UploadedImage {
  id: string;
  name: string;
  url: string;
  imageElement?: unknown;
  blob?: Blob;
  width: number;
  height: number;
  aspectRatio: number;
  category?: "desktop" | "mobile";
  crop?: number;
}

export interface V1Composition {
  layout: V1Layout;
  scale: number;
  spacing: number;
  rotation: number;
  count: number;
  alignment: "center" | "left" | "right";
  assetIds: { primary: string; mobile: string };
  frame: {
    type: V1Frame;
    appearance: "light" | "dark";
    radius: number;
    border: number;
    finish: V1DeviceFrameFinish;
    title: string;
    status: boolean;
  };
  image: { fit: "cover" | "contain"; crop: number };
  background: {
    type: "solid" | "gradient" | "spotlight" | "image";
    color: string;
    secondColor: string;
    angle: number;
    intensity: number;
    imageId: string;
  };
  motion: {
    type: "still" | "drift" | "glide" | "zoom";
    duration: number;
    amount: number;
    direction: "forward" | "reverse";
    easing: "smooth" | "linear";
    loop: boolean;
    hold: number;
  };
  contentMotion: { enabled: boolean; start: number; end: number; hold: number };
  effects: { shadow: number; blur: number; offset: number; reflection: number };
  brand: {
    title: string;
    subtitle: string;
    color: string;
    size: number;
    position: "top" | "bottom";
    logoId: string;
  };
}

export interface V1ExportSettings {
  resolution: 720 | 1080;
  fps: 30 | 60;
  quality: "standard" | "high";
  format: "mp4" | "webm";
}

export interface V1Project {
  version: 1;
  name: string;
  presetId: string;
  customized: boolean;
  aspectRatio: V1AspectRatio;
  composition: V1Composition;
  images: V1UploadedImage[];
  exportSettings: V1ExportSettings;
}

/**
 * The built-in template each v1 preset became. Presets whose template was removed (clean-hero,
 * soft-studio, phone-spotlight, responsive-pair) migrate without a template: their shots come
 * from the v1 composition either way, and `templateId` is informational.
 */
export const LEGACY_PRESET_TO_TEMPLATE: Record<string, string> = {
  "midnight-rows": "portfolio-rows",
  "gallery-wall": "isometric-wall",
  "angled-gallery": "portfolio-rows",
  "phone-columns": "phone-parade",
};

export function migrateV1Project(v1: V1Project): ProjectDoc {
  const assets: AssetRef[] = (v1.images || []).map((img) => ({
    id: img.id,
    kind: "image",
    name: img.name || "Image",
    mime: "image/png",
    bytes: img.blob?.size ?? 0,
    width: img.width,
    height: img.height,
    role: img.category === "mobile" ? "mobile" : "desktop",
    meta: {
      tall: img.height > img.width * 1.5,
    },
  }));

  const comp = v1.composition;
  const primaryId = comp?.assetIds?.primary || assets[0]?.id || "";
  const mobileId =
    comp?.assetIds?.mobile || assets.find((a) => a.role === "mobile")?.id || assets[1]?.id || "";

  // Layout migration
  let layout: Layout;
  const frameType = comp?.frame?.type ?? "browser";
  let singleDevice: DeviceKind = "browser";
  if (frameType === "phone") {
    singleDevice = "phone";
  } else if (frameType === "rounded" || frameType === "none") {
    singleDevice = "card";
  }

  const allAssetIds = assets.map((a) => a.id);

  switch (comp?.layout) {
    case "hero":
      layout = {
        kind: "single",
        device: singleDevice,
        assetId: primaryId,
      };
      break;
    case "pair":
      layout = {
        kind: "pair",
        desktopId: primaryId,
        mobileId,
        arrangement: "overlap",
      };
      break;
    case "rows": {
      const rows = comp.count === 1 || comp.count === 3 ? comp.count : 2;
      layout = {
        kind: "rows",
        assetIds: allAssetIds,
        rows,
        device: singleDevice === "card" ? "card" : "browser",
        tilt: comp.rotation || 12,
        speed: 0.35,
      };
      break;
    }
    case "columns": {
      const columns = [2, 3, 4, 5].includes(comp.count) ? (comp.count as 2 | 3 | 4 | 5) : 3;
      layout = {
        kind: "columns",
        assetIds: allAssetIds,
        columns,
        tilt: comp.rotation || 12,
        speed: 0.35,
      };
      break;
    }
    case "grid":
      layout = {
        kind: "wall",
        assetIds: allAssetIds,
        columns: 4,
        speed: 0.2,
      };
      break;
    default:
      layout = {
        kind: "single",
        device: "browser",
        assetId: primaryId,
      };
  }

  // Camera Move migration
  let cameraPreset: CameraPresetId;
  const motionType = comp?.motion?.type ?? "zoom";
  if (motionType === "drift") {
    cameraPreset = "riseUp";
  } else if (motionType === "glide") {
    cameraPreset = layout.kind === "single" ? "dollyRight" : "static";
  } else if (motionType === "still") {
    cameraPreset = "static";
  } else {
    cameraPreset = "pushIn";
  }

  const intensity = Math.max(0, Math.min(1, (comp?.motion?.amount ?? 20) / 40));
  const camera: CameraMove = {
    preset: cameraPreset,
    intensity,
    easing: comp?.motion?.easing === "linear" ? "linear" : "smooth",
    float: 0.3,
  };

  // Background migration
  let background: Background;
  const bgType = comp?.background?.type ?? "solid";
  if (bgType === "gradient" || bgType === "spotlight") {
    background = {
      kind: "gradient",
      stops: [comp.background.color || "#1F2B45", comp.background.secondColor || "#0D1424"],
      angle: comp.background.angle ?? 135,
      angleConvention: "css",
    };
  } else if (bgType === "image") {
    background = {
      kind: "image",
      assetId: comp.background.imageId || "",
      dim: 0,
    };
  } else {
    background = {
      kind: "solid",
      color: comp?.background?.color || "#F1EDE6",
    };
  }

  // Shadow preset
  const shadowVal = comp?.effects?.shadow ?? 20;
  const shadow: ShadowPreset =
    shadowVal > 40 ? "dramatic" : shadowVal > 15 ? "medium" : shadowVal > 0 ? "soft" : "none";

  // Device finish
  const finishMap: Record<V1DeviceFrameFinish, DeviceFinish> = {
    midnight: "graphite",
    titanium: "silver",
    silver: "silver",
    gold: "sand",
  };
  const deviceFinish: DeviceFinish = comp?.frame?.finish
    ? finishMap[comp.frame.finish] || "silver"
    : "silver";

  const style: Style = {
    ...defaultStyle(),
    background,
    frameAppearance: comp?.frame?.appearance === "dark" ? "dark" : "light",
    deviceFinish,
    browserChrome: frameType === "none" ? "none" : "standard",
    browserUrl: comp?.frame?.title || "",
    shadow,
    grain: 0.25,
    vignette: 0.06,
  };

  // Text layers from brand
  const texts: TextLayer[] = [];
  if (comp?.brand?.title) {
    texts.push({
      id: crypto.randomUUID(),
      text: comp.brand.title,
      role: "title",
      font: "display",
      size: comp.brand.size ? comp.brand.size * 0.1 : 6,
      anchor: comp.brand.position === "bottom" ? "bottom" : "top",
      align: "center",
      color: comp.brand.color || "",
      animation: "fadeUp",
      delay: 0.2,
      logoAssetId: comp.brand.logoId || undefined,
    });
  }
  if (comp?.brand?.subtitle) {
    texts.push({
      id: crypto.randomUUID(),
      text: comp.brand.subtitle,
      role: "subtitle",
      font: "body",
      size: comp.brand.size ? comp.brand.size * 0.05 : 3,
      anchor: comp.brand.position === "bottom" ? "bottom" : "top",
      align: "center",
      color: comp.brand.color || "",
      animation: "fadeUp",
      delay: 0.4,
    });
  }

  // Shot construction
  const shot: Shot = {
    id: crypto.randomUUID(),
    duration: Math.max(1, Math.min(30, comp?.motion?.duration ?? 5)),
    layout,
    camera,
    entrance: "none",
    texts,
    transitionIn: {
      kind: "cut",
      duration: 0,
      easing: "quintInOut",
    },
  };

  if (comp?.contentMotion?.enabled) {
    const end = Math.max(0, Math.min(1, comp.contentMotion.end ?? 1));
    shot.scroll = {
      enabled: true,
      stops: [0, end],
      hold: comp.contentMotion.hold ?? 0.8,
      easing: "smooth",
    };
  }

  // Export settings
  const exp: ExportSettings = {
    ...defaultExport(),
    resolution: v1.exportSettings?.resolution ?? 1080,
    fps: v1.exportSettings?.fps === 60 ? 60 : 30,
    quality: v1.exportSettings?.quality === "standard" ? "web" : "high",
    format: v1.exportSettings?.format === "webm" ? "webm" : "mp4",
  };

  const templateId: string | undefined = LEGACY_PRESET_TO_TEMPLATE[v1.presetId];

  const rawDoc: ProjectDoc = {
    version: 2,
    id: crypto.randomUUID(),
    name: v1.name || "Migrated project",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    aspect: (v1.aspectRatio as Aspect) || "16:9",
    loop: comp?.motion?.loop ?? true,
    assets,
    style,
    shots: [shot],
    export: exp,
    templateId,
  };

  const { doc } = sanitizeDoc(rawDoc);
  return doc;
}
