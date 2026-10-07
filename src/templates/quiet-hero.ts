import type { ProjectDoc, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import type { Template, TemplateBuildContext } from "./types";
import { loopWrapCrossfade, paletteBackground } from "./looks";
import { buildTemplatePreviewDoc } from "./demo-preview";

export const quietHeroTemplate: Template = {
  id: "quiet-hero",
  name: "Quiet Hero",
  description: "Single desktop browser mockup with a subtle push-in over a warm bone canvas.",
  category: "single",
  slots: [
    {
      key: "desktop1",
      role: "desktop",
      required: true,
      prefer: "tall",
      label: "Desktop screenshot",
    },
  ],
  defaultDuration: 6,
  build: (ctx: TemplateBuildContext) => {
    const asset = ctx.slots.desktop1;
    const baseStyle: Style = {
      ...defaultStyle(),
      ...ctx.style,
      background: paletteBackground("bone", 160),
      frameAppearance: "light",
      shadow: "soft",
      browserChrome: "standard",
    };

    const shot = defaultShot({
      kind: "single",
      device: "browser",
      assetId: asset?.id ?? "",
    });

    shot.duration = 6;
    shot.transitionIn = loopWrapCrossfade();
    shot.entrance = "rise";
    shot.camera = {
      preset: "pushIn",
      intensity: 0.7,
      easing: "smooth",
      float: 0.1,
    };

    return {
      style: baseStyle,
      shots: [shot],
      loop: true,
    };
  },
};

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(quietHeroTemplate);
}
