import type { Background, Style, Transition } from "../doc/types";
import { BUILTIN_PALETTES } from "../doc/palettes";

export type PaletteId =
  "bone" | "fog" | "graphite" | "ink" | "sage" | "clay" | "dusk" | "mist" | "ash" | "onyx";

function palette(id: PaletteId) {
  const found = BUILTIN_PALETTES.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown palette: ${id}`);
  return found;
}

/** A copy of a built-in palette's background (quality-bar §6); `angle` overrides a gradient's. */
export function paletteBackground(id: PaletteId, angle?: number): Background {
  const background = structuredClone(palette(id).background);
  if (background.kind === "gradient" && angle !== undefined) background.angle = angle;
  return background;
}

/** The palette's text colour, chosen for contrast against its background. */
export function paletteTextColor(id: PaletteId): string {
  return palette(id).textColor;
}

/**
 * The background tone of the slider and Frames presets: their flat Ash fill (the default) or
 * its dark counterpart, Onyx. Both are solids, so grain and vignette stay 0 (quality-bar §6).
 */
export type PresetTone = "light" | "dark";

const TONE_PALETTE: Record<PresetTone, PaletteId> = { light: "ash", dark: "onyx" };
const TONES: PresetTone[] = ["light", "dark"];

/** The style fields a preset tone sets. */
export function presetToneStyle(
  tone: PresetTone,
): Pick<Style, "background" | "textColor" | "frameAppearance"> {
  const id = TONE_PALETTE[tone];
  return {
    background: paletteBackground(id),
    textColor: paletteTextColor(id),
    frameAppearance: palette(id).frameAppearance,
  };
}

/** Switches a style (say a draft's) to the tone's fill and text colour; grain and vignette stay. */
export function setPresetTone(style: Style, tone: PresetTone): void {
  Object.assign(style, presetToneStyle(tone));
}

/** The tone whose background the style shows, or undefined for any other background. */
export function presetToneOf(style: Pick<Style, "background">): PresetTone | undefined {
  const { background } = style;
  if (background.kind !== "solid") return undefined;
  const color = background.color.toUpperCase();
  return TONES.find((tone) => {
    const fill = palette(TONE_PALETTE[tone]).background;
    return fill.kind === "solid" && fill.color.toUpperCase() === color;
  });
}

/**
 * The loop wrap crossfade (quality-bar §2.2: 0.8 s) for a single-shot loop whose last
 * frame differs from its first. A one-way camera move (pushIn, heroTilt, orbits, dollies)
 * ends away from its start pose, so a cut back to t = 0 would pop. Marquees need it too: at
 * 0.12 frame widths per second a shot cannot travel a whole asset period, so a cut would
 * swap every screen.
 */
export function loopWrapCrossfade(): Transition {
  return { kind: "fade", duration: 0.8, easing: "quintInOut" };
}
