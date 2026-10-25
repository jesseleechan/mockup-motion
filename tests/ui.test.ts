import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateScrubValue } from "../src/ui";

const THEME_CSS = readFileSync(new URL("../src/ui/theme.css", import.meta.url), "utf8");

// Helper to calculate relative luminance of #RRGGBB
function hexToLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = hexToLuminance(hex1);
  const l2 = hexToLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("WP-05 Design System & UI Primitives", () => {
  describe("ScrubLabel Value Calculations", () => {
    it("calculates standard horizontal drag delta", () => {
      // 10 pixels moved with pixelsPerStep = 2 -> 5 steps
      const val = calculateScrubValue({
        startValue: 10,
        deltaX: 10,
        shiftKey: false,
        altKey: false,
        step: 1,
        pixelsPerStep: 2,
      });
      expect(val).toBe(15);
    });

    it("applies Shift modifier for 10x step scaling", () => {
      const val = calculateScrubValue({
        startValue: 10,
        deltaX: 10,
        shiftKey: true,
        altKey: false,
        step: 1,
        pixelsPerStep: 2,
      });
      expect(val).toBe(60); // 10 + 5 * 10 = 60
    });

    it("applies Alt modifier for 0.1x step scaling", () => {
      const val = calculateScrubValue({
        startValue: 10,
        deltaX: 10,
        shiftKey: false,
        altKey: true,
        step: 1,
        pixelsPerStep: 2,
      });
      expect(val).toBe(10.5); // 10 + 5 * 0.1 = 10.5
    });

    it("clamps to min and max boundaries", () => {
      const clampedMax = calculateScrubValue({
        startValue: 90,
        deltaX: 50,
        shiftKey: false,
        altKey: false,
        step: 1,
        max: 100,
        pixelsPerStep: 2,
      });
      expect(clampedMax).toBe(100);

      const clampedMin = calculateScrubValue({
        startValue: 10,
        deltaX: -50,
        shiftKey: false,
        altKey: false,
        step: 1,
        min: 0,
        pixelsPerStep: 2,
      });
      expect(clampedMin).toBe(0);
    });
  });

  // The tokens as src/ui/theme.css declares them: light under :root, dark twice (a dark system
  // under System, and a picked Dark).
  describe("Theme Token Contrast Ratios", () => {
    const light = tokens(":root");
    const dark = { ...light, ...tokens(':root[data-theme="dark"]') };
    const SURFACES = ["--color-bg", "--color-panel", "--color-paper", "--color-field"];

    it("gives a dark system and a picked Dark the same tokens", () => {
      expect(tokens(':root:not([data-theme="light"])')).toEqual(tokens(':root[data-theme="dark"]'));
    });

    for (const [name, theme] of [
      ["light", light],
      ["dark", dark],
    ] as const) {
      it(`${name}: --color-text and --color-text-2 keep 4.5:1 on every surface`, () => {
        for (const fg of ["--color-text", "--color-text-2"]) {
          for (const bg of SURFACES) {
            expect(contrast(theme, fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      });

      it(`${name}: accent and danger text, and text on accent and primary fills, keep 4.5:1`, () => {
        expect(contrast(theme, "--color-accent", "--color-panel")).toBeGreaterThanOrEqual(4.5);
        expect(contrast(theme, "--color-danger", "--color-panel")).toBeGreaterThanOrEqual(4.5);
        expect(contrast(theme, "--color-accent-ink", "--color-accent")).toBeGreaterThanOrEqual(4.5);
        // The primary button: paper on ink.
        expect(contrast(theme, "--color-paper", "--color-text")).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
});

/** The custom properties of the rule in theme.css with exactly this selector. */
function tokens(selector: string): Record<string, string> {
  const start = THEME_CSS.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`theme.css has no "${selector}" rule`);
  const body = THEME_CSS.slice(start, THEME_CSS.indexOf("}", start));
  const declarations = body.matchAll(/(--[\w-]+):\s*([^;]+);/g);
  return Object.fromEntries([...declarations].map(([, name, value]) => [name, value.trim()]));
}

function contrast(theme: Record<string, string>, fg: string, bg: string): number {
  for (const value of [theme[fg], theme[bg]]) {
    if (!/^#[0-9a-f]{6}$/i.test(value ?? "")) throw new Error(`${fg} or ${bg} isn't a hex colour`);
  }
  return contrastRatio(theme[fg], theme[bg]);
}
