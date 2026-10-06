import { describe, it, expect } from "vitest";
import {
  DESTINATION_PRESETS,
  outputDimensions,
  calculateBitrate,
  keyframeIntervalFor,
  estimateFileSize,
  formatFileSize,
} from "../src/export/destinations";
import { generateEmbedHtml, createWebEmbedBundle } from "../src/export/bundle";
import { encodeGif } from "../src/export/gif";
import { probeVideoEncoders } from "../src/export/probe";
import { verifyExportBlob } from "../src/export/verify";
import type { Aspect, DestinationId } from "../src/doc/types";
import { unzipSync } from "fflate";

describe("WP-16: Export v2, Destinations, Web-Embed Bundle, and GIF", () => {
  describe("Destinations & Dimensions (src/export/destinations.ts)", () => {
    it("exports all 7 platform destination presets with verified configurations", () => {
      const expectedIds: DestinationId[] = [
        "web-embed",
        "dribbble",
        "instagram-feed",
        "instagram-story",
        "linkedin",
        "x",
        "presentation-4k",
        "custom",
      ];

      for (const id of expectedIds) {
        const preset = DESTINATION_PRESETS[id];
        expect(preset).toBeDefined();
        expect(preset.name).toBeTruthy();
        expect(preset.resolution).toBeGreaterThan(0);
        expect(preset.fps).toBeGreaterThanOrEqual(15);
      }
    });

    it("outputDimensions rounds to even numbers and short side resolution per contracts §2", () => {
      const aspects: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];

      for (const aspect of aspects) {
        for (const res of [720, 1080, 1200, 1440, 2160]) {
          const dims = outputDimensions(aspect, res);
          expect(dims.width % 2).toBe(0);
          expect(dims.height % 2).toBe(0);
          expect(Math.min(dims.width, dims.height)).toBe(res);
        }
      }

      // Exact platform dimension verifications
      // Dribbble: 4:3 at 1200 short side -> 1600 × 1200
      expect(outputDimensions("4:3", 1200)).toEqual({ width: 1600, height: 1200 });

      // Instagram Feed: 4:5 at 1080 short side -> 1080 × 1350
      expect(outputDimensions("4:5", 1080)).toEqual({ width: 1080, height: 1350 });

      // Instagram Story: 9:16 at 1080 short side -> 1080 × 1920
      expect(outputDimensions("9:16", 1080)).toEqual({ width: 1080, height: 1920 });

      // Presentation 4K: 16:9 at 2160 short side -> 3840 × 2160
      expect(outputDimensions("16:9", 2160)).toEqual({ width: 3840, height: 2160 });
    });

    it("calculateBitrate matches WP-16 §3 formulas exactly", () => {
      // 1080p30 H.264
      const webBitrate = calculateBitrate("web", "avc", 1920, 1080, 30);
      const highBitrate = calculateBitrate("high", "avc", 1920, 1080, 30);
      const masterBitrate = calculateBitrate("master", "avc", 1920, 1080, 30);

      expect(webBitrate).toBe(6_000_000);
      expect(highBitrate).toBe(16_000_000);
      expect(masterBitrate).toBe(28_000_000);

      // AV1/VP9 is 55% of H.264
      const vp9Bitrate = calculateBitrate("high", "vp9", 1920, 1080, 30);
      expect(vp9Bitrate).toBe(Math.round(16_000_000 * 0.55));

      // Scaling by fps: (fps/30)^0.75
      const high60Bitrate = calculateBitrate("high", "avc", 1920, 1080, 60);
      const expected60 = Math.round(16_000_000 * Math.pow(60 / 30, 0.75));
      expect(high60Bitrate).toBe(expected60);
    });

    it("keyframeIntervalFor assigns 4s for web and 2s for high/master", () => {
      expect(keyframeIntervalFor("web")).toBe(4);
      expect(keyframeIntervalFor("high")).toBe(2);
      expect(keyframeIntervalFor("master")).toBe(2);
    });

    it("estimateFileSize and formatFileSize produce consistent human-readable numbers", () => {
      const estimated = estimateFileSize(
        {
          destination: "web-embed",
          resolution: 1080,
          fps: 30,
          quality: "high",
          format: "mp4",
          supersample: 1,
          motionBlur: false,
        },
        "16:9",
        8.0,
      );

      // 16 Mbps * 8s / 8 = 16 MB = 16,000,000 bytes
      expect(estimated).toBe(16_000_000);
      expect(formatFileSize(estimated)).toBe("15.3 MB");
      expect(formatFileSize(500 * 1024)).toBe("500 KB");
    });
  });

  describe("Web-Embed Bundle (src/export/bundle.ts)", () => {
    it("generateEmbedHtml contains video markup, sources, and accessibility reduce-motion script", () => {
      const html = generateEmbedHtml("aurelia-hero", 1920, 1080, "vp9");

      expect(html).toContain('<video autoplay muted loop playsinline preload="metadata"');
      expect(html).toContain('poster="aurelia-hero-poster.webp"');
      expect(html).toContain('width="1920" height="1080"');
      expect(html).toContain('<source src="aurelia-hero.webm" type=\'video/webm; codecs="vp09.00.41.08"\'>');
      expect(html).toContain('<source src="aurelia-hero.mp4" type=\'video/mp4\'>');
      expect(html).toContain("prefers-reduced-motion: reduce");
      expect(html).toContain("v.pause()");
    });

    it("createWebEmbedBundle creates a valid zip containing 4 files and a valid snippet", async () => {
      const mp4Blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "video/mp4" });
      const webmBlob = new Blob([new Uint8Array([5, 6, 7, 8])], { type: "video/webm" });
      const posterBlob = new Blob([new Uint8Array([9, 10, 11, 12])], { type: "image/webp" });

      const { zipBlob, embedSnippet } = await createWebEmbedBundle({
        projectName: "Product Launch",
        width: 1920,
        height: 1080,
        mp4Blob,
        webmBlob,
        posterBlob,
        webmCodec: "vp9",
      });

      expect(zipBlob).toBeDefined();
      expect(zipBlob.type).toBe("application/zip");
      expect(zipBlob.size).toBeGreaterThan(0);
      expect(embedSnippet).toContain("product-launch.mp4");

      // Inspect zip entries using fflate
      const buffer = await zipBlob.arrayBuffer();
      const unzipped = unzipSync(new Uint8Array(buffer));
      const fileNames = Object.keys(unzipped);

      expect(fileNames).toContain("product-launch.mp4");
      expect(fileNames).toContain("product-launch.webm");
      expect(fileNames).toContain("product-launch-poster.webp");
      expect(fileNames).toContain("embed.html");
      expect(fileNames.length).toBe(4);
    });

    it("createWebEmbedBundle leaves out the MP4 when the browser could not encode one (F09)", async () => {
      const webmBlob = new Blob([new Uint8Array([5, 6, 7, 8])], { type: "video/webm" });
      const posterBlob = new Blob([new Uint8Array([9, 10, 11, 12])], { type: "image/webp" });

      const { zipBlob, embedSnippet } = await createWebEmbedBundle({
        projectName: "Product Launch",
        width: 1920,
        height: 1080,
        webmBlob,
        posterBlob,
      });

      const unzipped = unzipSync(new Uint8Array(await zipBlob.arrayBuffer()));
      expect(Object.keys(unzipped).sort()).toEqual([
        "embed.html",
        "product-launch-poster.webp",
        "product-launch.webm",
      ]);
      expect(embedSnippet).toContain('<source src="product-launch.webm"');
      expect(embedSnippet).not.toContain(".mp4");
    });
  });

  describe("GIF Export (src/export/gif.ts)", () => {
    it("encodeGif encodes frames into a valid GIF blob with palette and dithering", () => {
      const width = 64;
      const height = 64;
      const frameCount = 6;
      const frames: Uint8ClampedArray[] = [];

      for (let i = 0; i < frameCount; i++) {
        const frame = new Uint8ClampedArray(width * height * 4);
        for (let p = 0; p < width * height; p++) {
          const idx = p * 4;
          frame[idx] = (i * 40) % 256; // R
          frame[idx + 1] = (p % 256);   // G
          frame[idx + 2] = 180;         // B
          frame[idx + 3] = 255;         // A
        }
        frames.push(frame);
      }

      let progressCount = 0;
      const result = encodeGif(
        frames,
        { width, height, fps: 15, dither: true },
        () => {
          progressCount++;
        },
      );

      expect(result.blob).toBeDefined();
      expect(result.mime).toBe("image/gif");
      expect(result.bytes).toBeGreaterThan(100);
      expect(result.exceedsSizeWarning).toBe(false);
      expect(progressCount).toBe(frameCount);
    });
  });

  describe("Probe & Verification (src/export/probe.ts & verify.ts)", () => {
    it("probeVideoEncoders returns recommended container and codec fallback", async () => {
      const res = await probeVideoEncoders({
        width: 1920,
        height: 1080,
        fps: 30,
        quality: "high",
      });

      expect(res).toBeDefined();
      expect(["mp4", "webm"]).toContain(res.recommendedContainer);
      expect(["avc", "vp9", "av1"]).toContain(res.recommendedCodec);
    });

    it("verifyExportBlob handles empty and image blobs safely", async () => {
      const emptyBlob = new Blob([], { type: "video/mp4" });
      const emptyRes = await verifyExportBlob(emptyBlob, {
        width: 1920,
        height: 1080,
        duration: 5,
        fps: 30,
      });
      expect(emptyRes.valid).toBe(false);
      expect(emptyRes.warnings.length).toBeGreaterThan(0);

      const gifBlob = new Blob([new Uint8Array([71, 73, 70])], { type: "image/gif" });
      const gifRes = await verifyExportBlob(gifBlob, {
        width: 640,
        height: 360,
        duration: 3,
        fps: 15,
      });
      expect(gifRes.valid).toBe(true);
    });
  });
});
