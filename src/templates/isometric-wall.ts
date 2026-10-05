import type { ProjectDoc, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import type { Template, TemplateBuildContext } from "./types";
import { buildTemplatePreviewDoc } from "./demo-preview";

export const isometricWallTemplate: Template = {
  id: "isometric-wall",
  name: "Isometric Wall",
  description: "Expansive isometric grid of project mockups drifting smoothly across the screen.",
  category: "portfolio",
  slots: [
    {
      key: "desktop1",
      role: "desktop",
      required: true,
      prefer: "any",
      label: "Desktop screenshot 1",
    },
    {
      key: "desktop2",
      role: "desktop",
      required: true,
      prefer: "any",
      label: "Desktop screenshot 2",
    },
    {
      key: "desktop3",
      role: "desktop",
      required: true,
      prefer: "any",
      label: "Desktop screenshot 3",
    },
    {
      key: "desktop4",
      role: "desktop",
      required: false,
      prefer: "any",
      label: "Desktop screenshot 4",
    },
  ],
  defaultDuration: 8,
  build: (ctx: TemplateBuildContext) => {
    const assets = [
      ctx.slots.desktop1?.id,
      ctx.slots.desktop2?.id,
      ctx.slots.desktop3?.id,
      ctx.slots.desktop4?.id,
    ].filter((id): id is string => Boolean(id));

    const baseStyle: Style = {
      ...defaultStyle(),
      ...ctx.style,
      background: {
        kind: "solid",
        color: "#F5F3EF",
      },
      shadow: "soft",
      browserChrome: "standard",
    };

    const shot = defaultShot({
      kind: "wall",
      columns: 4,
      speed: 0.3,
      assetIds: assets.length > 0 ? assets : [""],
    });

    shot.duration = 8;
    shot.camera = {
      preset: "isoDrift",
      intensity: 0.5,
      easing: "smooth",
      float: 0,
    };

    return {
      style: baseStyle,
      shots: [shot],
      loop: true,
    };
  },
};

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(isometricWallTemplate);
}
