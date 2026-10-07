import type { ProjectDoc, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import type { Template, TemplateBuildContext } from "./types";
import { loopWrapCrossfade, paletteBackground, paletteTextColor } from "./looks";
import { buildTemplatePreviewDoc } from "./demo-preview";

export const portfolioRowsTemplate: Template = {
  id: "portfolio-rows",
  name: "Portfolio Rows",
  description: "Alternating horizontal marquee rows of desktop cards with clean perspective tilt.",
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
      background: paletteBackground("graphite"),
      textColor: paletteTextColor("graphite"),
      frameAppearance: "dark",
      shadow: "soft",
      deviceFinish: "graphite",
    };

    const isPortrait = ctx.aspect === "9:16" || ctx.aspect === "4:5";
    const rowCount = isPortrait ? 3 : 2;

    const shot = defaultShot({
      kind: "rows",
      rows: rowCount,
      device: "browser",
      tilt: 8,
      speed: 0.35,
      assetIds: assets.length > 0 ? assets : [""],
    });

    shot.duration = 8;
    shot.transitionIn = loopWrapCrossfade();
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
  return buildTemplatePreviewDoc(portfolioRowsTemplate);
}
