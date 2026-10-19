import type { Background, Style, Transition } from "../doc/types";
import { oklch } from "culori";
import { BUILTIN_PALETTES } from "../doc/palettes";

export type PaletteId = "bone" | "fog" | "graphite" | "ink" | "sage" | "clay" | "ash" | "onyx";

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
 * A preset's background tone: its light fill or its dark one (Video inspector > Background).
 * Anything else is a custom colour.
 */
export type PresetTone = "light" | "dark";

/** A preset's light and dark fills, as palette ids. */
export interface PresetTones {
  light: PaletteId;
  dark: PaletteId;
}

/**
 * The flat fills of the slider, Frames and orbit presets, and of documents without a template:
 * Ash and Onyx. Both are solids, so grain and vignette stay 0 (quality-bar §6).
 */
export const FLAT_TONES: PresetTones = { light: "ash", dark: "onyx" };

const TONES: PresetTone[] = ["light", "dark"];

type ToneStyle = Pick<Style, "background" | "textColor" | "frameAppearance">;

/** A template's light and dark fills; Ash and Onyx unless it declares its own. */
export function templateTones(template: { tones?: PresetTones } | undefined): PresetTones {
  return template?.tones ?? FLAT_TONES;
}

/** The style fields a preset tone sets. */
export function presetToneStyle(tone: PresetTone, tones: PresetTones = FLAT_TONES): ToneStyle {
  const id = tones[tone];
  return {
    background: paletteBackground(id),
    textColor: paletteTextColor(id),
    frameAppearance: palette(id).frameAppearance,
  };
}

/** Switches a style (say a draft's) to the tone's fill and text colour; grain and vignette stay. */
export function setPresetTone(
  style: Style,
  tone: PresetTone,
  tones: PresetTones = FLAT_TONES,
): void {
  Object.assign(style, presetToneStyle(tone, tones));
}

function sameBackground(a: Background, b: Background): boolean {
  if (a.kind === "solid" && b.kind === "solid") {
    return a.color.toUpperCase() === b.color.toUpperCase();
  }
  if (a.kind === "gradient" && b.kind === "gradient") {
    return (
      a.angle === b.angle &&
      a.stops.length === b.stops.length &&
      a.stops.every((stop, i) => stop.toUpperCase() === b.stops[i].toUpperCase())
    );
  }
  return false;
}

/** The tone whose fill the style shows, or undefined for any other (custom) background. */
export function presetToneOf(
  style: Pick<Style, "background">,
  tones: PresetTones = FLAT_TONES,
): PresetTone | undefined {
  return TONES.find((tone) => sameBackground(style.background, palette(tones[tone]).background));
}

/** The colour a background shows first: a solid's colour or a gradient's first stop. */
export function backgroundColor(background: Background): string {
  return background.kind === "solid" ? background.color : (background.stops[0] ?? "#DFE1E3");
}

// Below this OKLCH lightness a custom fill counts as dark and takes Onyx's frame look: the white
// 8% card hairline that keeps a dark screenshot's edge visible on a dark fill (quality-bar §6).
const DARK_FILL_LIGHTNESS = 0.5;

type FillStyle = Pick<Style, "background" | "frameAppearance">;

/** The style fields a custom flat colour sets: the fill and the frame look to match it. */
export function customBackgroundStyle(color: string): FillStyle {
  const lightness = oklch(color)?.l ?? 1;
  const look = lightness < DARK_FILL_LIGHTNESS ? FLAT_TONES.dark : FLAT_TONES.light;
  return { background: { kind: "solid", color }, frameAppearance: palette(look).frameAppearance };
}

/**
 * The fill a tone sets from the Background control: only the background and its frame look, so
 * a template's own text colour (Scroll Story keeps the brand's) is left alone.
 */
export function toneFillStyle(tone: PresetTone, tones: PresetTones = FLAT_TONES): FillStyle {
  const { background, frameAppearance } = presetToneStyle(tone, tones);
  return { background, frameAppearance };
}

/** A key that is equal for equal backgrounds, for remembering which one a UI state belongs to. */
export function backgroundKey(background: Background): string {
  return JSON.stringify(background).toUpperCase();
}

export type BackgroundChoice = PresetTone | "custom";

/**
 * What the Background control shows as selected. `customFor` is the background key Custom was
 * opened on (or last set by the colour field); it holds only while the document still shows that
 * background, so an undo, redo or template change selects from the document again.
 */
export function backgroundChoice(
  style: Pick<Style, "background">,
  tones: PresetTones,
  customFor: string | null,
): BackgroundChoice {
  const tone = presetToneOf(style, tones);
  if (!tone || customFor === backgroundKey(style.background)) return "custom";
  return tone;
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
