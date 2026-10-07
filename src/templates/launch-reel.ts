import type { ProjectDoc, Shot, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import type { Template, TemplateBuildContext } from "./types";
import { paletteBackground, paletteTextColor } from "./looks";
import { buildTemplatePreviewDoc } from "./demo-preview";

export const launchReelTemplate: Template = {
  id: "launch-reel",
  name: "Launch Reel",
  description:
    "Cinematic multi-shot launch video: animated title reveal, desktop hero, responsive pair, and branded end card.",
  category: "reel",
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
    {
      key: "logo1",
      role: "logo",
      required: false,
      prefer: "any",
      label: "Brand logo",
    },
  ],
  defaultDuration: 13,
  build: (ctx: TemplateBuildContext) => {
    const desktopAsset = ctx.slots.desktop1;
    const mobileAsset = ctx.slots.mobile1;
    const logoAsset = ctx.slots.logo1;
    const projectName = ctx.projectName || "Product Launch";

    const baseStyle: Style = {
      ...defaultStyle(),
      ...ctx.style,
      // The primary screenshot, blurred, sets the mood; graphite when there is none yet.
      // Dim 0.55 (F11 suggested 0.35) keeps white text above 4.5:1 on light screenshots
      // (quality-bar §7); the demo's blurred hero is about sRGB 150 undimmed.
      background: desktopAsset
        ? { kind: "ambient", assetId: desktopAsset.id, blur: 1, dim: 0.55 }
        : paletteBackground("graphite"),
      textColor: paletteTextColor("graphite"),
      frameAppearance: "light",
      shadow: "medium",
      deviceFinish: "graphite",
      browserChrome: "standard",
    };

    // Shot 1: Title card (2.5s): the name over the blurred screenshot, no device yet
    const shot1: Shot = {
      ...defaultShot({ kind: "title" }),
      id: "shot-title",
      duration: 2.5,
      entrance: "rise",
      camera: {
        preset: "pushIn",
        intensity: 0.3,
        easing: "smooth",
        float: 0.1,
      },
      texts: [
        {
          id: "txt-intro",
          role: "label",
          text: "INTRODUCING",
          color: "",
          font: "display",
          size: 2.2,
          anchor: "top",
          align: "center",
          animation: "fadeUp",
          delay: 0.2,
        },
        {
          id: "txt-title",
          role: "title",
          text: projectName,
          color: "#FFFFFF",
          font: "display",
          size: 6,
          anchor: "center",
          align: "center",
          animation: "fadeUp",
          delay: 0.4,
        },
      ],
    };

    // Shot 2: Quiet hero desktop (4s)
    const shot2: Shot = {
      ...defaultShot({
        kind: "single",
        device: "browser",
        assetId: desktopAsset?.id ?? "",
      }),
      id: "shot-hero",
      duration: 4.0,
      transitionIn: {
        kind: "blur",
        duration: 0.6,
        easing: "smooth",
      },
      camera: {
        preset: "pushIn",
        intensity: 0.6,
        easing: "smooth",
        float: 0.15,
      },
    };

    // Shot 3: Responsive pair (4s)
    const isPortrait = ctx.aspect === "9:16" || ctx.aspect === "4:5";
    const shot3: Shot = {
      ...defaultShot({
        kind: "pair",
        arrangement: isPortrait ? "side" : "overlap",
        desktopId: desktopAsset?.id ?? "",
        mobileId: mobileAsset?.id ?? "",
      }),
      id: "shot-pair",
      duration: 4.0,
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
        float: 0.2,
      },
    };

    // Shot 4: Branded end card (2.5s), text only like the title card
    const shot4: Shot = {
      ...defaultShot({ kind: "title" }),
      id: "shot-end",
      duration: 2.5,
      transitionIn: {
        kind: "fade",
        duration: 0.6,
        easing: "smooth",
      },
      camera: {
        preset: "pullBack",
        intensity: 0.4,
        easing: "smooth",
        float: 0.1,
      },
      texts: [
        {
          id: "txt-end-title",
          role: "title",
          text: projectName,
          color: "#FFFFFF",
          font: "display",
          size: 6,
          anchor: "center",
          align: "center",
          animation: "fadeUp",
          delay: 0.2,
        },
        {
          id: "txt-end-subtitle",
          role: "subtitle",
          text: logoAsset ? "Available now" : "mockupmotion.app",
          color: "",
          font: "body",
          size: 2.4,
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
  return buildTemplatePreviewDoc(launchReelTemplate);
}
