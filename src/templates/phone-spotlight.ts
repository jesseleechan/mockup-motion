import type { ProjectDoc, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import type { Template, TemplateBuildContext } from "./types";
import { paletteBackground, paletteTextColor } from "./looks";
import { buildTemplatePreviewDoc } from "./demo-preview";

export const phoneSpotlightTemplate: Template = {
  id: "phone-spotlight",
  name: "Phone Spotlight",
  description: "Dramatic mobile app spotlight with continuous orbit and gentle elevation float.",
  category: "mobile",
  slots: [
    {
      key: "mobile1",
      role: "mobile",
      required: true,
      prefer: "any",
      label: "Mobile screenshot",
    },
  ],
  defaultDuration: 6,
  build: (ctx: TemplateBuildContext) => {
    const mobileAsset = ctx.slots.mobile1;
    const baseStyle: Style = {
      ...defaultStyle(),
      ...ctx.style,
      background: paletteBackground("dusk"),
      textColor: paletteTextColor("dusk"),
      frameAppearance: "dark",
      shadow: "dramatic",
      // Silver keeps the phone's edge visible against the dark mesh.
      deviceFinish: "silver",
    };

    const shot = defaultShot({
      kind: "single",
      device: "phone",
      assetId: mobileAsset?.id ?? "",
    });

    shot.duration = 6;
    shot.camera = {
      preset: "orbitLeft",
      intensity: 0.8,
      easing: "smooth",
      float: 0.6,
    };

    return {
      style: baseStyle,
      shots: [shot],
      loop: true,
    };
  },
};

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(phoneSpotlightTemplate);
}
