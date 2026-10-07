import type { ProjectDoc, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import type { Template, TemplateBuildContext } from "./types";
import { loopWrapCrossfade, paletteBackground } from "./looks";
import { buildTemplatePreviewDoc } from "./demo-preview";

export const responsiveTrioTemplate: Template = {
  id: "responsive-trio",
  name: "Responsive Trio",
  description: "Desktop, tablet, and mobile frames spanning across devices in an elegant line.",
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
      key: "tablet1",
      role: "desktop",
      required: false,
      prefer: "any",
      label: "Tablet screenshot",
    },
    {
      key: "mobile1",
      role: "mobile",
      required: true,
      prefer: "any",
      label: "Mobile screenshot",
    },
  ],
  defaultDuration: 7,
  build: (ctx: TemplateBuildContext) => {
    const desktopAsset = ctx.slots.desktop1;
    const tabletAsset = ctx.slots.tablet1 ?? ctx.slots.desktop1;
    const mobileAsset = ctx.slots.mobile1;

    const baseStyle: Style = {
      ...defaultStyle(),
      ...ctx.style,
      background: paletteBackground("fog"),
      frameAppearance: "light",
      shadow: "soft",
      browserChrome: "standard",
    };

    const shot = defaultShot({
      kind: "trio",
      desktopId: desktopAsset?.id ?? "",
      tabletId: tabletAsset?.id ?? "",
      mobileId: mobileAsset?.id ?? "",
    });

    shot.duration = 7;
    shot.transitionIn = loopWrapCrossfade();
    shot.entrance = "stagger";
    shot.camera = {
      preset: "dollyLeft",
      intensity: 0.6,
      easing: "smooth",
      float: 0.15,
    };

    return {
      style: baseStyle,
      shots: [shot],
      loop: true,
    };
  },
};

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(responsiveTrioTemplate);
}
