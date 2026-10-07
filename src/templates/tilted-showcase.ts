import type { ProjectDoc, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import type { Template, TemplateBuildContext } from "./types";
import { paletteBackground, paletteTextColor } from "./looks";
import { buildTemplatePreviewDoc } from "./demo-preview";

export const tiltedShowcaseTemplate: Template = {
  id: "tilted-showcase",
  name: "Tilted Showcase",
  description: "Dynamic perspective tilt showcasing desktop web apps with subtle floating motion.",
  category: "single",
  slots: [
    {
      key: "desktop1",
      role: "desktop",
      required: true,
      prefer: "any",
      label: "Desktop screenshot",
    },
  ],
  defaultDuration: 6,
  build: (ctx: TemplateBuildContext) => {
    const asset = ctx.slots.desktop1;
    const baseStyle: Style = {
      ...defaultStyle(),
      ...ctx.style,
      background: paletteBackground("graphite"),
      textColor: paletteTextColor("graphite"),
      frameAppearance: "dark",
      vignette: 0.08,
      shadow: "medium",
      deviceFinish: "graphite",
      browserChrome: "standard",
    };

    const shot = defaultShot({
      kind: "single",
      device: "browser",
      assetId: asset?.id ?? "",
    });

    shot.duration = 6;
    shot.camera = {
      preset: "heroTilt",
      intensity: 1.0,
      easing: "smooth",
      float: 0.5,
    };

    return {
      style: baseStyle,
      shots: [shot],
      loop: true,
    };
  },
};

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(tiltedShowcaseTemplate);
}
