import type { Background, Transition } from "../doc/types";
import { BUILTIN_PALETTES } from "../doc/palettes";

export type PaletteId = "bone" | "fog" | "graphite" | "ink" | "sage" | "clay" | "dusk" | "mist";

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
 * The loop wrap crossfade (quality-bar §2.2: 0.8 s) for a single-shot loop whose last
 * frame differs from its first. A one-way camera move (pushIn, heroTilt, orbits, dollies)
 * ends away from its start pose, so a cut back to t = 0 would pop. Marquees need it too: at
 * 0.12 frame widths per second a shot cannot travel a whole asset period, so a cut would
 * swap every screen.
 */
export function loopWrapCrossfade(): Transition {
  return { kind: "fade", duration: 0.8, easing: "quintInOut" };
}
