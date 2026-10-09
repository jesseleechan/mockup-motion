import type { ProjectDoc, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import type { Template, TemplateBuildContext } from "./types";
import { paletteBackground } from "./looks";
import { buildTemplatePreviewDoc } from "./demo-preview";

export const scrollStoryTemplate: Template = {
  id: "scroll-story",
  name: "Scroll Story",
  description:
    "Reads the entire webpage section by section with smooth scrolling and comfortable pauses.",
  category: "desktop",
  slots: [
    {
      key: "desktop1",
      role: "desktop",
      required: true,
      prefer: "tall",
      label: "Full page screenshot",
    },
  ],
  defaultDuration: 10,
  build: (ctx: TemplateBuildContext) => {
    const asset = ctx.slots.desktop1;
    const isMobileAsset = asset?.role === "mobile";

    const baseStyle: Style = {
      ...defaultStyle(),
      ...ctx.style,
      background: paletteBackground("fog"),
      frameAppearance: "light",
      shadow: "soft",
      browserChrome: "standard",
    };

    const shot = defaultShot({
      kind: "single",
      device: isMobileAsset ? "phone" : "browser",
      assetId: asset?.id ?? "",
    });

    shot.duration = 10;
    // Per quality-bar §2.5: One dominant move; scroll shots use camera intensity <= 0.3
    shot.camera = {
      preset: "pushIn",
      intensity: 0.2,
      easing: "smooth",
      float: 0.05,
    };

    // Scroll is explicitly enabled only for scroll-story
    shot.scroll = {
      enabled: true,
      stops: [0, 0.33, 0.66, 1.0],
      hold: 0.8,
      easing: "smooth",
    };

    return {
      style: baseStyle,
      shots: [shot],
      loop: false,
    };
  },
};

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(scrollStoryTemplate);
}
