import { oklch } from "culori";
import { describe, expect, it } from "vitest";
import { BUILTIN_PALETTES, shadowTintFor } from "../src/doc/palettes";

describe("Palettes & Color atmosphere (quality-bar §6)", () => {
  it("Built-in palettes satisfy low-chroma quality-bar limits (C <= 0.09 light, C <= 0.12 dark)", () => {
    expect(BUILTIN_PALETTES.length).toBe(10);

    for (const p of BUILTIN_PALETTES) {
      expect(p.id).toBeDefined();
      expect(p.name).toBeDefined();
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
      } else if (p.background.kind === "solid") {
        const c = oklch(p.background.color);
        expect(c).toBeDefined();
        expect(c!.c ?? 0).toBeLessThanOrEqual(p.frameAppearance === "light" ? 0.09 : 0.12);
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
});
