import type { ProjectDoc, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import type { Template, TemplateBuildContext } from "./types";
import { paletteBackground } from "./looks";
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
    {
      key: "mobile4",
      role: "mobile",
      required: false,
      prefer: "any",
      label: "Mobile screenshot 4",
    },
    {
      key: "mobile5",
      role: "mobile",
      required: false,
      prefer: "any",
      label: "Mobile screenshot 5",
    },
  ],
  defaultDuration: 8,
  build: (ctx: TemplateBuildContext) => {
    // fillSlots reuses an asset when a slot has no distinct one; the optional slots must
    // not repeat a phone within the column window (quality-bar §4).
    const assets = [
      ...new Set(
        [
          ctx.slots.mobile1?.id,
          ctx.slots.mobile2?.id,
          ctx.slots.mobile3?.id,
          ctx.slots.mobile4?.id,
          ctx.slots.mobile5?.id,
        ].filter((id): id is string => Boolean(id)),
      ),
    ];

    const baseStyle: Style = {
      ...defaultStyle(),
      ...ctx.style,
      background: paletteBackground("fog"),
      textColor: "",
      frameAppearance: "light",
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
