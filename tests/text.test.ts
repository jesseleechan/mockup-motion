import { describe, expect, it } from "vitest";
import { defaultStyle } from "../src/doc/defaults";
import { BUILTIN_PALETTES } from "../src/doc/palettes";
import type { TextLayer } from "../src/doc/types";
import { parseFontFamily } from "../src/assets/fonts";
import {
  getAutoTextColor,
  getContrastRatio,
  rasterizeText,
  wrapBalancedText,
} from "../src/text/rasterize";
import { textFrame } from "../src/motion/text-anim";
import { resolveLayout } from "../src/motion/layouts";

describe("WP-10 Text & Typography Unit Tests", () => {
  const baseTitleLayer: TextLayer = {
    id: "layer-title-1",
    text: "Showcase Your Work With Confidence",
    role: "title",
    font: "display",
    size: 6.0,
    anchor: "center",
    align: "center",
    color: "",
    animation: "fadeUp",
    delay: 0,
  };

  it("raster height scales linearly with frameHeightPx at 720, 1080, and 2160 (±1 px)", async () => {
    const style = defaultStyle();

    const raster720 = await rasterizeText(baseTitleLayer, style, 720);
    const raster1080 = await rasterizeText(baseTitleLayer, style, 1080);
    const raster2160 = await rasterizeText(baseTitleLayer, style, 2160);

    // Scaling ratio from 1080
    const ratio720 = raster720.height / raster1080.height;
    const ratio2160 = raster2160.height / raster1080.height;

    expect(ratio720).toBeCloseTo(720 / 1080, 2);
    expect(ratio2160).toBeCloseTo(2160 / 1080, 2);

    // Check exact height linearity within ±1 px
    const expected720 = Math.round((raster1080.height * 720) / 1080);
    const expected2160 = Math.round((raster1080.height * 2160) / 1080);

    expect(Math.abs(raster720.height - expected720)).toBeLessThanOrEqual(1);
    expect(Math.abs(raster2160.height - expected2160)).toBeLessThanOrEqual(1);
  });

  it("balanced wrapping wraps titles at 22 chars or fewer and minimizes variance across 10 fixture titles", () => {
    const fixtureTitles = [
      "The Next Generation of Creative Tools",
      "Crafting Calm Digital Experiences",
      "Designed for Modern Product Teams",
      "Build Faster Ship With Total Confidence",
      "An Elegant Presentation for Web Designers",
      "Introducing the Studio Portfolio Reel",
      "Simple Powerful Intelligent Motion Mockups",
      "Curated Typography and Smooth Perspective",
      "Local First Professional Video Export",
      "Showcase Your Web Design to the World",
    ];

    expect(fixtureTitles.length).toBe(10);

    for (const title of fixtureTitles) {
      const lines = wrapBalancedText(title, 22);

      // Verify that all lines (except words inherently longer than 22 chars) are <= 22 chars
      for (const line of lines) {
        const wordsInLine = line.split(/\s+/);
        const maxWordLength = Math.max(...wordsInLine.map((w) => w.length));
        if (maxWordLength <= 22) {
          expect(line.length).toBeLessThanOrEqual(22);
        }
      }

      // Verify lines are non-empty and reconstruct the full text
      expect(lines.length).toBeGreaterThanOrEqual(1);
      const reconstructed = lines.join(" ");
      expect(reconstructed).toBe(title);

      // Verify variance is minimized (no single lone orphan word when balanced split is possible)
      if (lines.length > 1) {
        const lengths = lines.map((l) => l.length);
        const maxLen = Math.max(...lengths);
        const minLen = Math.min(...lengths);
        // Line lengths should be reasonably close to each other
        expect(maxLen - minLen).toBeLessThanOrEqual(14);
      }
    }
  });

  it("auto-contrast meets WCAG targets on Bone, Graphite, and Dusk", () => {
    // 1. Bone (light palette)
    const bone = BUILTIN_PALETTES.find((p) => p.id === "bone")!;
    expect(bone).toBeDefined();
    const boneTextColor = getAutoTextColor(bone.background, "caption");
    // Bone background hex: #F1EDE6
    const boneContrast = getContrastRatio("#F1EDE6", boneTextColor);
    // WCAG target >= 4.5:1 for captions/labels, >= 3:1 for titles
    expect(boneContrast).toBeGreaterThanOrEqual(4.5);

    // 2. Graphite (dark palette)
    const graphite = BUILTIN_PALETTES.find((p) => p.id === "graphite")!;
    expect(graphite).toBeDefined();
    const graphiteTextColor = getAutoTextColor(graphite.background, "caption");
    const graphiteContrast = getContrastRatio("#141417", graphiteTextColor);
    expect(graphiteContrast).toBeGreaterThanOrEqual(4.5);

    // 3. Dusk (dark mesh palette)
    const dusk = BUILTIN_PALETTES.find((p) => p.id === "dusk")!;
    expect(dusk).toBeDefined();
    const duskTextColor = getAutoTextColor(dusk.background, "caption");
    // Average color of Dusk is dark (< 0.4)
    // Test contrast against the dark background base
    const duskContrast = getContrastRatio("#1B1B2F", duskTextColor);
    expect(duskContrast).toBeGreaterThanOrEqual(4.5);
  });

  it("clamps text size below 1.6% of frame height up to 1.6%", async () => {
    const style = defaultStyle();
    const tinyLayer: TextLayer = {
      ...baseTitleLayer,
      size: 0.5, // requested 0.5% (below 1.6%)
    };

    const minAllowedLayer: TextLayer = {
      ...baseTitleLayer,
      size: 1.6, // requested exactly 1.6%
    };

    const rasterTiny = await rasterizeText(tinyLayer, style, 1080);
    const rasterMin = await rasterizeText(minAllowedLayer, style, 1080);

    // Since tinyLayer was clamped to 1.6%, both rasters should have identical dimensions
    expect(rasterTiny.height).toBe(rasterMin.height);
    expect(rasterTiny.width).toBe(rasterMin.width);
  });

  it("parseFontFamily extracts family from TTF/OTF name table or cleans fallback filename", () => {
    // 1. Fallback filename cleanup
    expect(parseFontFamily(new ArrayBuffer(0), "CabinetGrotesk-Bold.woff2")).toBe(
      "CabinetGrotesk Bold",
    );
    expect(parseFontFamily(new ArrayBuffer(4), "satoshi_regular.ttf")).toBe("satoshi regular");

    // 2. Synthesize a valid minimal sfnt name table with family name "TestFont"
    // Header (12 bytes) + 1 Table Record (16 bytes) = 28 bytes header
    // name table: format=0 (2 bytes), count=1 (2 bytes), stringOffset=18 (2 bytes)
    // 1 NameRecord (12 bytes)
    // String storage ("TestFont" in Mac Roman: 8 bytes)
    const nameStr = "TestFont";
    const strLen = nameStr.length;
    const nameTableSize = 6 + 12 + strLen;
    const totalSize = 28 + nameTableSize;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    // sfnt version 0x00010000
    view.setUint32(0, 0x00010000);
    view.setUint16(4, 1); // 1 table

    // Table record 0: 'name' tag
    view.setUint32(12, 0x6e616d65); // 'name'
    view.setUint32(16, 0); // checksum
    view.setUint32(20, 28); // offset to name table
    view.setUint32(24, nameTableSize); // length

    // name table header
    view.setUint16(28, 0); // format 0
    view.setUint16(30, 1); // count 1
    view.setUint16(32, 18); // stringOffset from start of name table (6 + 12 = 18)

    // NameRecord 0 (Mac Roman, platform 1, encoding 0, language 0, nameID 1)
    view.setUint16(34, 1); // platformID 1 (Mac)
    view.setUint16(36, 0); // encodingID 0
    view.setUint16(38, 0); // languageID 0
    view.setUint16(40, 1); // nameID 1 (Font Family)
    view.setUint16(42, strLen); // length
    view.setUint16(44, 0); // offset from stringOffset

    // String storage
    for (let i = 0; i < strLen; i++) {
      view.setUint8(28 + 18 + i, nameStr.charCodeAt(i));
    }

    const parsed = parseFontFamily(buffer, "fallback.ttf");
    expect(parsed).toBe("TestFont");
  });

  it("kinetic text animations match quality-bar timings across time", () => {
    const layer: TextLayer = {
      ...baseTitleLayer,
      animation: "fadeUp",
    };

    // t < 0: not yet started
    const before = textFrame(layer, 4, -0.5);
    expect(before.opacity).toBe(0);

    // t = 0: starts
    const at0 = textFrame(layer, 4, 0);
    expect(at0.opacity).toBe(0);

    // t = 0.4: partially revealed
    const atMid = textFrame(layer, 4, 0.4);
    expect(atMid.opacity).toBeGreaterThan(0.5);
    expect(atMid.opacity).toBeLessThan(1.0);

    // t = 0.8: fully revealed
    const atEnd = textFrame(layer, 4, 0.8);
    expect(atEnd.opacity).toBeCloseTo(1.0, 2);

    // Test maskReveal has non-zero clip transitioning to 0
    const maskLayer: TextLayer = { ...baseTitleLayer, animation: "maskReveal" };
    const maskEarly = textFrame(maskLayer, 4, 0.2);
    expect(maskEarly.words[0].clip).toBeGreaterThan(0);
    const maskDone = textFrame(maskLayer, 4, 1.0);
    expect(maskDone.words[0].clip).toBe(0);

    // Test blurIn has blur transitioning to 0
    const blurLayer: TextLayer = { ...baseTitleLayer, animation: "blurIn" };
    const blurEarly = textFrame(blurLayer, 4, 0.1);
    expect(blurEarly.words[0].blur).toBeGreaterThan(0);
    const blurDone = textFrame(blurLayer, 4, 1.0);
    expect(blurDone.words[0].blur).toBe(0);
  });

  it("layout.kind === 'title' resolves to 0 device nodes", () => {
    const nodes = resolveLayout({ kind: "title" }, "16:9", [], 0, 5);
    expect(nodes).toEqual([]);
  });
});
