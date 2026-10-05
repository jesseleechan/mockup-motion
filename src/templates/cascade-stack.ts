import type { ProjectDoc, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import type { Template, TemplateBuildContext } from "./types";
import { buildTemplatePreviewDoc } from "./demo-preview";

export const cascadeStackTemplate: Template = {
  id: "cascade-stack",
  name: "Cascade Stack",
  description: "Layered deck of desktop cards pulling back in depth with staggered elevation.",
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
  defaultDuration: 6,
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
        kind: "gradient",
        stops: ["#EEF2F6", "#E2E8F0"],
        angle: 330,
        angleConvention: "css",
      },
      shadow: "medium",
      browserChrome: "standard",
    };

    const shot = defaultShot({
      kind: "stack",
      assetIds: assets.length > 0 ? assets : [""],
      device: "card",
      spread: 0.25,
    });

    shot.duration = 6;
    shot.entrance = "stagger";
    shot.camera = {
      preset: "pullBack",
      intensity: 0.7,
      easing: "smooth",
      float: 0.2,
    };

    return {
      style: baseStyle,
      shots: [shot],
      loop: true,
    };
  },
};

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(cascadeStackTemplate);
}
