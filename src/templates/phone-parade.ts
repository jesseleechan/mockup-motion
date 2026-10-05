import type { ProjectDoc, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import type { Template, TemplateBuildContext } from "./types";
import { buildTemplatePreviewDoc } from "./demo-preview";

export const phoneParadeTemplate: Template = {
  id: "phone-parade",
  name: "Phone Parade",
  description: "Continuous vertical scrolling columns showcasing mobile experiences in motion.",
  category: "mobile",
  slots: [
    {
      key: "mobile1",
      role: "mobile",
      required: true,
      prefer: "any",
      label: "Mobile screenshot 1",
    },
    {
      key: "mobile2",
      role: "mobile",
      required: true,
      prefer: "any",
      label: "Mobile screenshot 2",
    },
    {
      key: "mobile3",
      role: "mobile",
      required: true,
      prefer: "any",
      label: "Mobile screenshot 3",
    },
  ],
  defaultDuration: 8,
  build: (ctx: TemplateBuildContext) => {
    const assets = [
      ctx.slots.mobile1?.id,
      ctx.slots.mobile2?.id,
      ctx.slots.mobile3?.id,
    ].filter((id): id is string => Boolean(id));

    const baseStyle: Style = {
      ...defaultStyle(),
      ...ctx.style,
      background: {
        kind: "solid",
        color: "#1E2024",
      },
      textColor: "#F1F5F9",
      shadow: "soft",
      deviceFinish: "graphite",
    };

    const isPortrait = ctx.aspect === "9:16" || ctx.aspect === "4:5";
    const columnCount = isPortrait ? 2 : 3;

    const shot = defaultShot({
      kind: "columns",
      columns: columnCount,
      tilt: 12,
      speed: 0.4,
      assetIds: assets.length > 0 ? assets : [""],
    });

    shot.duration = 8;
    shot.camera = {
      preset: "static",
      intensity: 0,
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
  return buildTemplatePreviewDoc(phoneParadeTemplate);
}
