import { describe, expect, it } from "vitest";
import type { ExportSettings } from "../src/doc/types";
import {
  calculateBitrate,
  estimateFileSize,
  MOTION_BLUR_SAMPLES,
  motionBlurShutter,
} from "../src/export/destinations";
import { exportFilename, planExport, type ExportPlan } from "../src/export/plan";

const settings = (patch: Partial<ExportSettings> = {}): ExportSettings => ({
  destination: "custom",
  resolution: 1080,
  fps: 30,
  quality: "high",
  format: "mp4",
  supersample: 1,
  motionBlur: false,
  ...patch,
});

const BOTH = { avc: true, vp9: true };
const VP9_ONLY = { avc: false, vp9: true };
const AVC_ONLY = { avc: true, vp9: false };
const NONE = { avc: false, vp9: false };

function planned(...args: Parameters<typeof planExport>): ExportPlan {
  const result = planExport(...args);
  if (!result.ok) throw new Error(`Expected a plan, got: ${result.error}`);
  return result.plan;
}

describe("F09: export plan matches what is written", () => {
  it("keeps MP4 when H.264 is available", () => {
    const plan = planned(settings(), "16:9", 6, BOTH);
    expect(plan.settings.format).toBe("mp4");
    expect(plan.label).toBe("MP4 · H.264");
    expect(plan.extension).toBe("mp4");
    expect(plan.notice).toBeUndefined();
    expect([plan.width, plan.height, plan.fps, plan.duration]).toEqual([1920, 1080, 30, 6]);
  });

  it("falls back to WebM without H.264, and says so in the label, extension and size", () => {
    const plan = planned(settings(), "16:9", 6, VP9_ONLY);
    expect(plan.settings.format).toBe("webm");
    expect(plan.label).toBe("WebM · VP9");
    expect(plan.extension).toBe("webm");
    expect(plan.notice).toMatch(/exports WebM/);
    // Size from the VP9 bitrate that will be used, not the H.264 one that was asked for
    const vp9Bytes = (calculateBitrate("high", "vp9", 1920, 1080, 30) * 6) / 8;
    expect(plan.bytes).toBe(Math.round(vp9Bytes));
    expect(plan.bytes).toBeLessThan(estimateFileSize(settings(), "16:9", 6));
  });

  it("falls back to MP4 when only H.264 exists and WebM was asked for", () => {
    const plan = planned(settings({ format: "webm" }), "16:9", 6, AVC_ONLY);
    expect(plan.settings.format).toBe("mp4");
    expect(plan.label).toBe("MP4 · H.264");
    expect(plan.notice).toMatch(/exports MP4/);
  });

  it("refuses video formats when the browser has no video encoder", () => {
    for (const format of ["mp4", "webm", "bundle"] as const) {
      const result = planExport(settings({ format }), "16:9", 6, NONE);
      expect(result.ok).toBe(false);
    }
  });

  it("plans a web bundle with only the videos this browser can encode", () => {
    const both = planned(settings({ format: "bundle" }), "16:9", 6, BOTH);
    expect(both.label).toBe("Web bundle · MP4 + WebM");
    expect(both.extension).toBe("zip");
    expect(both.bundleParts).toEqual({ mp4: true, webm: true });
    expect(both.notice).toBeUndefined();

    const webmOnly = planned(settings({ format: "bundle" }), "16:9", 6, VP9_ONLY);
    expect(webmOnly.label).toBe("Web bundle · WebM");
    expect(webmOnly.bundleParts).toEqual({ mp4: false, webm: true });
    expect(webmOnly.notice).toMatch(/MP4 isn't available/);
    expect(webmOnly.bytes).toBeLessThan(both.bytes);
  });

  it("estimates a bundle at the chosen quality for both videos", () => {
    const bundle = settings({ format: "bundle", quality: "master" });
    const mp4 = (calculateBitrate("master", "avc", 1920, 1080, 30) * 6) / 8;
    const webm = (calculateBitrate("master", "vp9", 1920, 1080, 30) * 6) / 8;
    expect(estimateFileSize(bundle, "16:9", 6)).toBe(Math.round(mp4 + webm + 400_000));
  });

  it("plans GIFs at their capped size and frame rate, and stills without timing", () => {
    const gif = planned(settings({ format: "gif", fps: 30 }), "16:9", 4, NONE);
    expect([gif.width, gif.height, gif.fps]).toEqual([1708, 960, 20]);
    expect(gif.extension).toBe("gif");

    const png = planned(settings({ format: "png" }), "4:5", 4, NONE);
    expect([png.width, png.height, png.fps, png.duration]).toEqual([1080, 1350, null, null]);
    expect(png.extension).toBe("png");
  });

  it("names the download with the extension of the real container", () => {
    const plan = planned(settings(), "4:3", 6, VP9_ONLY);
    expect(exportFilename("Aurelia Launch!", "4:3", plan.extension)).toBe(
      "aurelia-launch-4x3.webm",
    );
  });

  it("motion blur uses 8 samples over a 180° shutter", () => {
    expect(MOTION_BLUR_SAMPLES).toBe(8);
    expect(motionBlurShutter(30)).toBeCloseTo(1 / 60, 10);
    expect(motionBlurShutter(60)).toBeCloseTo(1 / 120, 10);
  });
});
