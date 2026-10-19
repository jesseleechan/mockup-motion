import type { AssetRef, AssetRole, ScrollSpec, Style } from "../doc/types";
import { defaultShot, defaultStyle } from "../doc/defaults";
import { minDurationFor, scrollableFramesFor } from "../motion/scroll";
import { screenAspectFor } from "../motion/layouts/types";
import type { Template, TemplateBuildContext, TemplateCategory } from "./types";
import { presetToneStyle, type PresetTones } from "./looks";

const SCROLL_STORY_DURATION = 10;

// Fog's designed dark counterpart is Graphite; its first stop is Onyx, so the top of the frame
// reads like the flat presets' dark (quality-bar §6).
const SCROLL_STORY_TONES: PresetTones = { light: "fog", dark: "graphite" };

const SCROLL_STORY_SCROLL: ScrollSpec = {
  enabled: true,
  stops: [0, 0.33, 0.66, 1.0],
  hold: 0.8,
  easing: "smooth",
};

interface ScrollStoryOptions {
  id: string;
  name: string;
  description: string;
  /** The screenshot size: a browser window for desktop, a phone for mobile. */
  role: Extract<AssetRole, TemplateCategory>;
  label: string;
}

/**
 * The shot length for a scroll through `asset` on `device`: 10 s, or longer when the page needs
 * it to stay under 0.9 viewport heights per second (quality-bar §2.2), rounded up to 0.5 s. On a
 * phone the viewport is the screen below the status bar (§3.3).
 */
export function scrollStoryDuration(
  device: "browser" | "phone",
  asset: AssetRef | undefined,
): number {
  const scrollableFrames = scrollableFramesFor(device, screenAspectFor(device, asset), asset);
  const needed = Math.ceil(minDurationFor(SCROLL_STORY_SCROLL, scrollableFrames) * 2) / 2;
  return Math.max(SCROLL_STORY_DURATION, needed);
}

/** Scroll Story in one size: one tall screenshot read section by section, on Fog. */
export function scrollStoryTemplate(options: ScrollStoryOptions): Template {
  const { id, name, description, role, label } = options;
  const device = role === "mobile" ? "phone" : "browser";
  const slotKey = `${role}1`;
  return {
    id,
    name,
    description,
    category: role,
    slots: [{ key: slotKey, role, required: true, prefer: "tall", label }],
    defaultDuration: SCROLL_STORY_DURATION,
    tones: SCROLL_STORY_TONES,
    build: (ctx: TemplateBuildContext) => {
      const asset = ctx.slots[slotKey];

      const style: Style = {
        ...defaultStyle(),
        ...ctx.style,
        ...presetToneStyle("light", SCROLL_STORY_TONES),
        shadow: "soft",
        browserChrome: "standard",
      };

      const shot = defaultShot({ kind: "single", device, assetId: asset?.id ?? "" });
      shot.duration = scrollStoryDuration(device, asset);
      // Per quality-bar §2.5: One dominant move; scroll shots use camera intensity <= 0.3
      shot.camera = {
        preset: "pushIn",
        intensity: 0.2,
        easing: "smooth",
        float: 0.05,
      };
      // Scroll is explicitly enabled only for the Scroll Story presets
      shot.scroll = { ...SCROLL_STORY_SCROLL, stops: [...SCROLL_STORY_SCROLL.stops] };

      return { style, shots: [shot], loop: false };
    },
  };
}
