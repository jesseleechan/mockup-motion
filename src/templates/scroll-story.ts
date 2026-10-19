import type { ProjectDoc, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import type { Template, TemplateBuildContext } from "./types";
import { presetToneStyle, type PresetTones } from "./looks";
import { buildTemplatePreviewDoc } from "./demo-preview";

// Fog's designed dark counterpart is Graphite; its first stop is Onyx, so the top of the frame
// reads like the flat presets' dark (quality-bar §6).
const SCROLL_STORY_TONES: PresetTones = { light: "fog", dark: "graphite" };

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
  tones: SCROLL_STORY_TONES,
  build: (ctx: TemplateBuildContext) => {
    const asset = ctx.slots.desktop1;
    const isMobileAsset = asset?.role === "mobile";

    // The brand's text colour stays; only the fill and its frame look come from the tone.
    const { background, frameAppearance } = presetToneStyle("light", SCROLL_STORY_TONES);
    const baseStyle: Style = {
      ...defaultStyle(),
      ...ctx.style,
      background,
      frameAppearance,
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
