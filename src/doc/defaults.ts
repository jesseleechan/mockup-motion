import type { Aspect, CameraMove, ExportSettings, Layout, ProjectDoc, Shot, Style } from "./types";

export function defaultStyle(): Style {
  return {
    background: {
      kind: "gradient",
      stops: ["#F1EDE6", "#E3DCD0"],
      angle: 135,
    },
    frameAppearance: "light",
    deviceFinish: "silver",
    browserChrome: "standard",
    browserUrl: "",
    shadow: "soft",
    grain: 0.25,
    vignette: 0.06,
    fonts: {
      display: { source: "builtin", family: "Inter Display", weight: 600 },
      body: { source: "builtin", family: "Inter", weight: 400 },
    },
    textColor: "",
    accent: "#7C93FF",
  };
}

export function defaultExport(): ExportSettings {
  return {
    destination: "custom",
    resolution: 1080,
    fps: 30,
    quality: "high",
    format: "mp4",
    supersample: 1.5,
    motionBlur: false,
  };
}

export function defaultCameraMove(): CameraMove {
  return {
    preset: "pushIn",
    intensity: 0.5,
    easing: "smooth",
    float: 0.3,
  };
}

export function defaultShot(layout?: Layout): Shot {
  return {
    id: crypto.randomUUID(),
    duration: 5,
    layout: layout ?? {
      kind: "single",
      device: "browser",
      assetId: "",
    },
    camera: defaultCameraMove(),
    entrance: "none",
    texts: [],
    transitionIn: {
      kind: "cut",
      duration: 0,
      easing: "quintInOut",
    },
  };
}

export function createDoc(partial?: Partial<ProjectDoc>): ProjectDoc {
  const now = Date.now();
  const base: ProjectDoc = {
    version: 2,
    id: crypto.randomUUID(),
    name: "Untitled presentation",
    createdAt: now,
    updatedAt: now,
    aspect: "16:9" as Aspect,
    loop: true,
    assets: [],
    style: defaultStyle(),
    shots: [defaultShot()],
    export: defaultExport(),
  };

  if (!partial) return base;

  return {
    ...base,
    ...partial,
    style: partial.style ? { ...base.style, ...partial.style } : base.style,
    export: partial.export ? { ...base.export, ...partial.export } : base.export,
    shots: partial.shots && partial.shots.length > 0 ? partial.shots : base.shots,
  };
}
