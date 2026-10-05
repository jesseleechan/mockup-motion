import { describe, expect, it } from "vitest";
import { calculateScrubValue } from "../src/ui";

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

  describe("Theme Token Contrast Ratios", () => {
    it("verifies dark mode contrast: --color-text-2 on --color-panel >= 4.5:1", () => {
      // Dark theme: panel = #121215, text-2 = #A1A1AB
      const ratio = contrastRatio("#A1A1AB", "#121215");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("verifies light mode contrast: --color-text-2 on --color-panel >= 4.5:1", () => {
      // Light theme: panel = #FFFFFF, text-2 = #5C5C66
      const ratio = contrastRatio("#5C5C66", "#FFFFFF");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
});
