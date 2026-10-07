import type { ProjectDoc, Shot, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import type { Template, TemplateBuildContext } from "./types";
import { paletteBackground, paletteTextColor } from "./looks";
import { buildTemplatePreviewDoc } from "./demo-preview";

export const caseStudyReelTemplate: Template = {
  id: "case-study-reel",
  name: "Case Study Reel",
  description: "Sequential walkthrough of 3 core pages with dynamic alternating camera angles, transitions, and captions.",
  category: "reel",
  slots: [
    {
      key: "desktop1",
      role: "desktop",
      required: true,
      prefer: "tall",
      label: "Overview page",
    },
    {
      key: "desktop2",
      role: "desktop",
      required: true,
      prefer: "any",
      label: "Features page",
    },
    {
      key: "desktop3",
      role: "desktop",
      required: true,
      prefer: "any",
      label: "Workflow page",
    },
  ],
  defaultDuration: 13,
  build: (ctx: TemplateBuildContext) => {
    const page1 = ctx.slots.desktop1;
    const page2 = ctx.slots.desktop2 ?? page1;
    const page3 = ctx.slots.desktop3 ?? page1;

    const baseStyle: Style = {
      ...defaultStyle(),
      ...ctx.style,
      background: paletteBackground("graphite"),
      textColor: paletteTextColor("graphite"),
      frameAppearance: "light",
      accent: "#3B82F6",
      shadow: "medium",
      deviceFinish: "graphite",
      browserChrome: "standard",
    };

    // Page 1: 3.5s, orbitLeft
    const shot1: Shot = {
      ...defaultShot({
        kind: "single",
        device: "browser",
        assetId: page1?.id ?? "",
      }),
      id: "shot-page-1",
      duration: 3.5,
      camera: {
        preset: "orbitLeft",
        intensity: 0.6,
        easing: "smooth",
        float: 0.1,
      },
      texts: [
        {
          id: "cap-1",
          role: "label",
          text: "01 / OVERVIEW",
          color: "#9CA3AF",
          font: "display",
          size: 2.0,
          anchor: "top",
          align: "center",
          animation: "fadeUp",
          delay: 0.2,
        },
      ],
    };

    // Page 2: 3.5s, pushIn, push transition
    const shot2: Shot = {
      ...defaultShot({
        kind: "single",
        device: "browser",
        assetId: page2?.id ?? "",
      }),
      id: "shot-page-2",
      duration: 3.5,
      transitionIn: {
        kind: "push",
        duration: 0.5,
        easing: "smooth",
        direction: "left",
      },
      camera: {
        preset: "pushIn",
        intensity: 0.6,
        easing: "smooth",
        float: 0.1,
      },
      texts: [
        {
          id: "cap-2",
          role: "label",
          text: "02 / DEEP DIVE",
          color: "#9CA3AF",
          font: "display",
          size: 2.0,
          anchor: "top",
          align: "center",
          animation: "fadeUp",
          delay: 0.2,
        },
      ],
    };

    // Page 3: 3.5s, orbitRight, push transition
    const shot3: Shot = {
      ...defaultShot({
        kind: "single",
        device: "browser",
        assetId: page3?.id ?? "",
      }),
      id: "shot-page-3",
      duration: 3.5,
      transitionIn: {
        kind: "push",
        duration: 0.5,
        easing: "smooth",
        direction: "left",
      },
      camera: {
        preset: "orbitRight",
        intensity: 0.6,
        easing: "smooth",
        float: 0.1,
      },
      texts: [
        {
          id: "cap-3",
          role: "label",
          text: "03 / WORKFLOW",
          color: "#9CA3AF",
          font: "display",
          size: 2.0,
          anchor: "top",
          align: "center",
          animation: "fadeUp",
          delay: 0.2,
        },
      ],
    };

    // End card: 2.5s, text over the background so it never collides with a device
    const shot4: Shot = {
      ...defaultShot({ kind: "title" }),
      id: "shot-summary",
      duration: 2.5,
      transitionIn: {
        kind: "fade",
        duration: 0.6,
        easing: "smooth",
      },
      camera: {
        preset: "pullBack",
        intensity: 0.5,
        easing: "smooth",
        float: 0.1,
      },
      texts: [
        {
          id: "txt-case-title",
          role: "title",
          text: ctx.projectName || "Case Study",
          color: "#FFFFFF",
          font: "display",
          size: 6,
          anchor: "center",
          align: "center",
          animation: "fadeUp",
          delay: 0.2,
        },
        {
          id: "txt-case-sub",
          role: "subtitle",
          text: "Full story at studio.design",
          color: "#9CA3AF",
          font: "body",
          size: 2.2,
          anchor: "bottom",
          align: "center",
          animation: "fadeUp",
          delay: 0.4,
        },
      ],
    };

    return {
      style: baseStyle,
      shots: [shot1, shot2, shot3, shot4],
      loop: false,
    };
  },
};

export function previewDoc(): ProjectDoc {
  return buildTemplatePreviewDoc(caseStudyReelTemplate);
}
