import { formatHex, oklch } from "culori";
import type { Background, FrameAppearance } from "./types";

export interface BuiltinPalette {
  id: string;
  name: string;
  background: Background;
  frameAppearance: FrameAppearance;
  textColor: string;
  shadowTint: string;
}

/**
 * Computes shadow tint for a background per quality-bar §5:
 * dominant hue of the background at 25% lightness (L = 0.25 in OKLCH), with subtle chroma.
 */
export function shadowTintFor(background: Background): string {
  let sampleColor = "#F1EDE6";

  switch (background.kind) {
    case "solid":
      sampleColor = background.color;
      break;
    case "gradient":
      sampleColor = background.stops[0] ?? "#F1EDE6";
      break;
    case "mesh":
      sampleColor = background.colors[0] ?? "#1B1B2F";
      break;
    case "ambient":
    case "image":
      sampleColor = "#141417";
      break;
  }

  const parsed = oklch(sampleColor);
  if (!parsed) {
    return "#151518";
  }

  // Preserve hue, fix lightness at 0.25, keep chroma low (max 0.04) for realistic shadow tinting
  const tint = oklch({
    mode: "oklch",
    l: 0.25,
    c: Math.min(parsed.c ?? 0.015, 0.04),
    h: parsed.h ?? 0,
  });

  return formatHex(tint) ?? "#151518";
}

/**
 * 9 Built-in curated palettes from quality-bar §6.
 * Low chroma (C <= 0.09 for light, C <= 0.12 for dark) creates calm, premium presentation backgrounds.
 */
export const BUILTIN_PALETTES: BuiltinPalette[] = [
  // 1. Bone (Warm Light Neutral) - OKLCH C ~0.02
  {
    id: "bone",
    name: "Bone",
    background: {
      kind: "gradient",
      stops: ["#F1EDE6", "#E3DCD0"],
      angle: 315,
      angleConvention: "css",
    },
    frameAppearance: "light",
    textColor: "#1C1917",
    shadowTint: shadowTintFor({ kind: "solid", color: "#E3DCD0" }),
  },
  // 2. Fog (Cool Light Grey) - OKLCH C ~0.01
  {
    id: "fog",
    name: "Fog",
    background: {
      kind: "gradient",
      stops: ["#EEF1F4", "#D9DFE6"],
      angle: 315,
      angleConvention: "css",
    },
    frameAppearance: "light",
    textColor: "#0F172A",
    shadowTint: shadowTintFor({ kind: "solid", color: "#D9DFE6" }),
  },
  // 3. Graphite (Deep Neutral Charcoal) - OKLCH C ~0.01
  {
    id: "graphite",
    name: "Graphite",
    background: {
      kind: "gradient",
      stops: ["#141417", "#2A2A30"],
      angle: 305,
      angleConvention: "css",
    },
    frameAppearance: "dark",
    textColor: "#F4F4F5",
    shadowTint: shadowTintFor({ kind: "solid", color: "#141417" }),
  },
  // 4. Ink (Atmospheric Midnight Navy) - OKLCH C ~0.04
  {
    id: "ink",
    name: "Ink",
    background: {
      kind: "gradient",
      stops: ["#0D1424", "#1F2B45"],
      angle: 300,
      angleConvention: "css",
    },
    frameAppearance: "dark",
    textColor: "#F8FAFC",
    shadowTint: shadowTintFor({ kind: "solid", color: "#0D1424" }),
  },
  // 5. Sage (Soft Organic Green) - OKLCH C ~0.02
  {
    id: "sage",
    name: "Sage",
    background: {
      kind: "gradient",
      stops: ["#E4E9E1", "#C9D3C4"],
      angle: 315,
      angleConvention: "css",
    },
    frameAppearance: "light",
    textColor: "#1B221B",
    shadowTint: shadowTintFor({ kind: "solid", color: "#C9D3C4" }),
  },
  // 6. Clay (Warm Earthen Terracotta) - OKLCH C ~0.03
  {
    id: "clay",
    name: "Clay",
    background: {
      kind: "gradient",
      stops: ["#EBDDD3", "#D2B8A6"],
      angle: 315,
      angleConvention: "css",
    },
    frameAppearance: "light",
    textColor: "#261914",
    shadowTint: shadowTintFor({ kind: "solid", color: "#D2B8A6" }),
  },
  // 7. Dusk (Moody Warm Twilight Mesh) - OKLCH C ~0.04-0.06
  {
    id: "dusk",
    name: "Dusk",
    background: {
      kind: "mesh",
      colors: ["#1B1B2F", "#3A2F4F", "#6B4E71", "#C3A6A0"],
      drift: 0.05,
      seed: 42,
    },
    frameAppearance: "dark",
    textColor: "#FAF5FF",
    shadowTint: shadowTintFor({ kind: "solid", color: "#1B1B2F" }),
  },
  // 8. Mist (Ethereal Morning Pastel Mesh) - OKLCH C ~0.02
  {
    id: "mist",
    name: "Mist",
    background: {
      kind: "mesh",
      colors: ["#E9EEF5", "#D7E0EE", "#EDE3F0", "#F6EFE6"],
      drift: 0.04,
      seed: 108,
    },
    frameAppearance: "light",
    textColor: "#18181B",
    shadowTint: shadowTintFor({ kind: "solid", color: "#D7E0EE" }),
  },
  // 9. Ash (Flat Light Grey, sampled from the Frames and slider references) - OKLCH C ~0.004
  {
    id: "ash",
    name: "Ash",
    background: { kind: "solid", color: "#DFE1E3" },
    frameAppearance: "light",
    textColor: "#18181B",
    shadowTint: shadowTintFor({ kind: "solid", color: "#DFE1E3" }),
  },
];
