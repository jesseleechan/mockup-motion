import type { ProjectDoc, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import type { Template, TemplateBuildContext } from "./types";
import { loopWrapCrossfade, paletteBackground } from "./looks";
import { buildTemplatePreviewDoc } from "./demo-preview";

export const responsivePairTemplate: Template = {
  id: "responsive-pair",
  name: "Responsive Pair",
  description: "Desktop browser and mobile phone presented in an overlapping responsive harmony.",
  category: "responsive",
  slots: [
    {
      key: "desktop1",
      role: "desktop",
      required: true,
      prefer: "tall",
      label: "Desktop screenshot",
    },
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
    const desktopAsset = ctx.slots.desktop1;
    const mobileAsset = ctx.slots.mobile1;

    const baseStyle: Style = {
      ...defaultStyle(),
      ...ctx.style,
      background: paletteBackground("mist"),
      frameAppearance: "light",
      deviceFinish: "silver",
      shadow: "soft",
      browserChrome: "standard",
    };

    const isPortrait = ctx.aspect === "9:16" || ctx.aspect === "4:5";

    const shot = defaultShot({
      kind: "pair",
      arrangement: isPortrait ? "side" : "overlap",
      desktopId: desktopAsset?.id ?? "",
      mobileId: mobileAsset?.id ?? "",
    });

    shot.duration = 6;
    shot.transitionIn = loopWrapCrossfade();
    shot.entrance = "stagger";
    shot.camera = {
      preset: "orbitRight",
      intensity: 0.6,
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
  return buildTemplatePreviewDoc(responsivePairTemplate);
}
