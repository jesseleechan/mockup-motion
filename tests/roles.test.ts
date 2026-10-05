import { describe, expect, it } from "vitest";
import {
  analyzeImage,
  computeBottomRowColor,
  detectStatusBar,
} from "../src/assets/roles";

describe("WP-13 Role Detection (src/assets/roles.ts)", () => {
  // Helper to generate synthetic RGBA image
  function createSyntheticImage(
    width: number,
    height: number,
    fillRgba: [number, number, number, number] = [255, 255, 255, 255],
  ): Uint8ClampedArray {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fillRgba[0];
      data[i + 1] = fillRgba[1];
      data[i + 2] = fillRgba[2];
      data[i + 3] = fillRgba[3];
    }
    return data;
  }

  // 12 test fixtures covering mobile, tablet, logo, desktop, tall variations, and status bar
  const fixtures = [
    // 1. Standard desktop screenshot (1440x900)
    { name: "desktop-standard", width: 1440, height: 900, hasAlpha: false, expectedRole: "desktop", expectedTall: false },
    // 2. Tall desktop full-page (1440x3600, aspect 0.4 < 0.5)
    { name: "desktop-tall", width: 1440, height: 3600, hasAlpha: false, expectedRole: "desktop", expectedTall: true },
    // 3. Wide desktop / ultrawide (2560x1080)
    { name: "desktop-ultrawide", width: 2560, height: 1080, hasAlpha: false, expectedRole: "desktop", expectedTall: false },
    // 4. Standard mobile viewport (390x844, aspect ~0.462 < 0.75, width <= 1300)
    { name: "mobile-standard", width: 390, height: 844, hasAlpha: false, expectedRole: "mobile", expectedTall: false },
    // 5. Tall mobile full-page (390x1200, aspect 0.325 < 0.4)
    { name: "mobile-tall", width: 390, height: 1200, hasAlpha: false, expectedRole: "mobile", expectedTall: true },
    // 6. Mobile @3x high res (1170x2532, aspect ~0.462)
    { name: "mobile-3x", width: 1170, height: 2532, hasAlpha: false, expectedRole: "mobile", expectedTall: false },
    // 7. Small mobile screen (360x640)
    { name: "mobile-small", width: 360, height: 640, hasAlpha: false, expectedRole: "mobile", expectedTall: false },
    // 8. Tablet portrait (1640x2360, width >= 1500, aspect 0.695 in [0.65, 0.85])
    { name: "tablet-portrait", width: 1640, height: 2360, hasAlpha: false, expectedRole: "tablet", expectedTall: false },
    // 9. Tablet high-res (2048x2732, width >= 1500, aspect 0.75 in [0.65, 0.85])
    { name: "tablet-large", width: 2048, height: 2732, hasAlpha: false, expectedRole: "tablet", expectedTall: false },
    // 10. Logo icon with transparent background (512x512, <= 20% opaque)
    { name: "logo-transparent", width: 512, height: 512, hasAlpha: true, opaqueFraction: 0.12, expectedRole: "logo", expectedTall: false },
    // 11. Small brand mark (256x256, <= 20% opaque)
    { name: "logo-mark", width: 256, height: 256, hasAlpha: true, opaqueFraction: 0.08, expectedRole: "logo", expectedTall: false },
    // 12. Square image without transparency (800x800, opaque) -> desktop
    { name: "desktop-card", width: 800, height: 800, hasAlpha: false, expectedRole: "desktop", expectedTall: false },
  ];

  it("classifies 12 test fixtures with 100% correct roles and tall flags", () => {
    for (const f of fixtures) {
      const result = analyzeImage({
        width: f.width,
        height: f.height,
        hasAlpha: f.hasAlpha,
        opaqueFraction: f.opaqueFraction,
      });

      expect(result.role, `Failed on ${f.name}`).toBe(f.expectedRole);
      expect(result.tall, `Failed tall flag on ${f.name}`).toBe(f.expectedTall);
    }
  });

  it("detects status bar on mobile screenshots with top glyph clusters", () => {
    const width = 390;
    const height = 844;
    // White background
    const rgba = createSyntheticImage(width, height, [255, 255, 255, 255]);

    // Draw dark glyph clusters in the top strip (left third: time, right third: battery/wifi)
    // Left cluster (time)
    for (let y = 12; y < 26; y++) {
      for (let x = 20; x < 65; x++) {
        const idx = (y * width + x) * 4;
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
      }
    }
    // Right cluster (battery/wifi)
    for (let y = 12; y < 26; y++) {
      for (let x = 320; x < 365; x++) {
        const idx = (y * width + x) * 4;
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
      }
    }

    const hasStatus = detectStatusBar(rgba, width, height);
    expect(hasStatus).toBe(true);

    // Image without status bar (clean flat header)
    const cleanRgba = createSyntheticImage(width, height, [240, 240, 240, 255]);
    expect(detectStatusBar(cleanRgba, width, height)).toBe(false);
  });

  it("computes bottom-row average color accurately", () => {
    const width = 100;
    const height = 50;
    const rgba = createSyntheticImage(width, height, [255, 255, 255, 255]);

    // Set bottom row to a specific color (#123456 -> R=18, G=52, B=86)
    const startIdx = (height - 1) * width * 4;
    for (let x = 0; x < width; x++) {
      const idx = startIdx + x * 4;
      rgba[idx] = 18;
      rgba[idx + 1] = 52;
      rgba[idx + 2] = 86;
      rgba[idx + 3] = 255;
    }

    const hex = computeBottomRowColor(rgba, width, height);
    expect(hex.toLowerCase()).toBe("#123456");
  });
});
