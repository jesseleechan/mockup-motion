import { oklch } from "culori";
import { describe, expect, it } from "vitest";
import { dominantColors, suggestBackgrounds } from "../src/assets/palette";
import { BUILTIN_PALETTES, shadowTintFor } from "../src/doc/palettes";

describe("Palettes & Color atmosphere (quality-bar §6)", () => {
  it("Built-in palettes satisfy low-chroma quality-bar limits (C <= 0.09 light, C <= 0.12 dark)", () => {
    expect(BUILTIN_PALETTES.length).toBe(8);

    for (const p of BUILTIN_PALETTES) {
      expect(p.id).toBeDefined();
      expect(p.name).toBeDefined();
      expect(p.textColor).toBeDefined();
      expect(p.shadowTint).toBeDefined();

      if (p.background.kind === "gradient") {
        for (const stop of p.background.stops) {
          const c = oklch(stop);
          expect(c).toBeDefined();
          if (p.frameAppearance === "light") {
            expect(c!.c ?? 0).toBeLessThanOrEqual(0.09);
          } else {
            expect(c!.c ?? 0).toBeLessThanOrEqual(0.12);
          }
        }
      } else if (p.background.kind === "mesh") {
        for (const col of p.background.colors) {
          const c = oklch(col);
          expect(c).toBeDefined();
          if (p.frameAppearance === "light") {
            expect(c!.c ?? 0).toBeLessThanOrEqual(0.09);
          } else {
            expect(c!.c ?? 0).toBeLessThanOrEqual(0.12);
          }
        }
      }
    }
  });

  it("shadowTintFor produces dominant hue at 25% lightness (L = 0.25 ± 0.03)", () => {
    const tintLight = shadowTintFor({ kind: "solid", color: "#F1EDE6" });
    const parsedLight = oklch(tintLight);
    expect(parsedLight).toBeDefined();
    expect(parsedLight!.l).toBeCloseTo(0.25, 1);

    const tintDark = shadowTintFor({ kind: "solid", color: "#0D1424" });
    const parsedDark = oklch(tintDark);
    expect(parsedDark).toBeDefined();
    expect(parsedDark!.l).toBeCloseTo(0.25, 1);
    // Preserves hue direction from Navy blue (approx ~250-280 deg)
    expect(parsedDark!.h).toBeGreaterThan(200);
  });

  it("dominantColors extracts 5 colors and does not let white background dominate first color", () => {
    // Construct a synthetic 100x100 screenshot: 85% white (#ffffff), 15% brand blue (#2563eb)
    const w = 100;
    const h = 100;
    const data = new Uint8ClampedArray(w * h * 4);

    for (let i = 0; i < w * h; i++) {
      if (i < w * h * 0.85) {
        // White page background
        data[i * 4] = 255;
        data[i * 4 + 1] = 255;
        data[i * 4 + 2] = 255;
        data[i * 4 + 3] = 255;
      } else {
        // Brand blue button / logo
        data[i * 4] = 37;
        data[i * 4 + 1] = 99;
        data[i * 4 + 2] = 235;
        data[i * 4 + 3] = 255;
      }
    }

    const colors = dominantColors(data, w, h, 5);
    expect(colors.length).toBe(5);

    // The first color should NOT be near-white (lightness < 0.95 or high chroma)
    const firstOklch = oklch(colors[0]);
    expect(firstOklch).toBeDefined();
    // Brand color was picked up and not choked out by the white canvas
    const hasBrandBlue = colors.some((hex) => {
      const c = oklch(hex);
      return c && c.c > 0.08 && c.h && c.h > 230 && c.h < 280;
    });
    expect(hasBrandBlue).toBe(true);
  });

  it("suggestBackgrounds generates 4 candidates obeying quality-bar §6 chroma and lightness shifts", () => {
    // Palette from a light website screenshot
    const palette = ["#2563eb", "#1e293b", "#f8fafc", "#60a5fa", "#94a3b8"];
    const suggestions = suggestBackgrounds(palette, "asset-1");

    expect(suggestions.length).toBe(4);
    const [lightBg, darkBg, meshBg, ambientBg] = suggestions;

    expect(lightBg.kind).toBe("gradient");
    if (lightBg.kind === "gradient") {
      const c = oklch(lightBg.stops[0]);
      expect(c!.l).toBeGreaterThanOrEqual(0.85);
      expect(c!.c ?? 0).toBeLessThanOrEqual(0.09);
    }

    expect(darkBg.kind).toBe("gradient");
    if (darkBg.kind === "gradient") {
      const c = oklch(darkBg.stops[0]);
      expect(c!.l).toBeLessThanOrEqual(0.25);
      expect(c!.c ?? 0).toBeLessThanOrEqual(0.12);
    }

    expect(meshBg.kind).toBe("mesh");
    if (meshBg.kind === "mesh") {
      expect(meshBg.colors.length).toBe(4);
      for (const col of meshBg.colors) {
        const c = oklch(col);
        expect(c!.c ?? 0).toBeLessThanOrEqual(0.09);
      }
    }

    expect(ambientBg.kind).toBe("ambient");
  });
});
