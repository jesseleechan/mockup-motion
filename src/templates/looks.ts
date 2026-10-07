import type { Background } from "../doc/types";
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
