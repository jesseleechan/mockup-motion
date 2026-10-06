/**
 * Destination presets, platform dimensions, bitrates, and file size estimation.
 * Current platform specifications verified as of 2026-10-05:
 * - Dribbble: 4:3 or 16:9, max 1600x1200 or 1920x1080, MP4/GIF under 20MB. (Source: Dribbble Help Center)
 * - Instagram Feed: 4:5 vertical (1080x1350) or 1:1 square (1080x1080), 30 fps, MP4 H.264. (Source: Meta for Creators)
 * - Instagram/TikTok Story: 9:16 vertical (1080x1920), 30 fps, MP4 H.264. (Source: Meta & TikTok Business Help)
 * - LinkedIn / X: 16:9 landscape (1920x1080), 30 fps, MP4 H.264. (Source: LinkedIn Marketing Solutions & X Developer Platform)
 * - Presentation 4K: 16:9 UHD (3840x2160), 30 fps, high bitrate master MP4.
 */

import type {
  Aspect,
  DestinationId,
  ExportFormat,
  ExportQuality,
  ExportSettings,
} from "../doc/types";

export interface DestinationPreset {
  id: DestinationId;
  name: string;
  description: string;
  aspect: Aspect;
  resolution: number; // short side
  fps: number;
  quality: ExportQuality;
  format: ExportFormat;
  supersample: number;
  motionBlur: boolean;
}

export const DESTINATION_PRESETS: Record<DestinationId, DestinationPreset> = {
  "web-embed": {
    id: "web-embed",
    name: "Website Embed",
    description: "Self-hosted video bundle with MP4, WebM, poster, and copyable embed code.",
    aspect: "16:9",
    resolution: 1080,
    fps: 30,
    quality: "web",
    format: "bundle",
    supersample: 1.0,
    motionBlur: false,
  },
  dribbble: {
    id: "dribbble",
    name: "Dribbble",
    description: "Optimized for Dribbble shots (1600 × 1200) with crisp 4:3 presentation.",
    aspect: "4:3",
    resolution: 1200, // short side -> 1600 x 1200
    fps: 30,
    quality: "high",
    format: "mp4",
    supersample: 1.0,
    motionBlur: false,
  },
  "instagram-feed": {
    id: "instagram-feed",
    name: "Instagram Feed",
    description: "Portrait 4:5 framing (1080 × 1350) maximizing mobile feed vertical real estate.",
    aspect: "4:5",
    resolution: 1080, // short side -> 1080 x 1350
    fps: 30,
    quality: "high",
    format: "mp4",
    supersample: 1.0,
    motionBlur: false,
  },
  "instagram-story": {
    id: "instagram-story",
    name: "Instagram / TikTok",
    description: "Full vertical 9:16 (1080 × 1920) for Stories, Reels, and TikTok.",
    aspect: "9:16",
    resolution: 1080, // short side -> 1080 x 1920
    fps: 30,
    quality: "high",
    format: "mp4",
    supersample: 1.0,
    motionBlur: false,
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    description: "Standard 16:9 landscape (1920 × 1080) for professional feeds and carousels.",
    aspect: "16:9",
    resolution: 1080,
    fps: 30,
    quality: "high",
    format: "mp4",
    supersample: 1.0,
    motionBlur: false,
  },
  x: {
    id: "x",
    name: "X (Twitter)",
    description: "Landscape 16:9 video optimized for X media timeline cards.",
    aspect: "16:9",
    resolution: 1080,
    fps: 30,
    quality: "high",
    format: "mp4",
    supersample: 1.0,
    motionBlur: false,
  },
  "presentation-4k": {
    id: "presentation-4k",
    name: "Presentation 4K",
    description: "Master quality 4K UHD (3840 × 2160) for keynote screens and stage displays.",
    aspect: "16:9",
    resolution: 2160,
    fps: 30,
    quality: "master",
    format: "mp4",
    supersample: 1.0,
    motionBlur: false,
  },
  custom: {
    id: "custom",
    name: "Custom",
    description: "Manual control over all resolution, frame rate, quality, and container options.",
    aspect: "16:9",
    resolution: 1080,
    fps: 30,
    quality: "high",
    format: "mp4",
    supersample: 1.0,
    motionBlur: false,
  },
};

/**
 * Calculates output dimensions where `resolution` is the short side,
 * rounding to even numbers required by video encoders.
 */
export function outputDimensions(
  aspect: Aspect,
  resolution: number,
): { width: number; height: number } {
  let w: number;
  let h: number;

  switch (aspect) {
    case "16:9":
      h = resolution;
      w = Math.round((resolution * 16) / 9);
      break;
    case "9:16":
      w = resolution;
      h = Math.round((resolution * 16) / 9);
      break;
    case "1:1":
      w = resolution;
      h = resolution;
      break;
    case "4:5":
      w = resolution;
      h = Math.round((resolution * 5) / 4);
      break;
    case "4:3":
      h = resolution;
      w = Math.round((resolution * 4) / 3);
      break;
  }

  // Ensure even dimensions
  w = w % 2 === 0 ? w : w + 1;
  h = h % 2 === 0 ? h : h + 1;

  return { width: w, height: h };
}

/**
 * Calculates target encoding bitrate in bits per second per WP-16 §3:
 * - H.264 at 1080p30: web 6 Mbps, high 16 Mbps, master 28 Mbps.
 * - AV1/VP9 is 55% of those.
 * - Scale by pixel count and (fps/30)^0.75.
 */
export function calculateBitrate(
  quality: ExportQuality,
  codec: "avc" | "vp9" | "av1",
  width: number,
  height: number,
  fps: number,
): number {
  let baseBps = 16_000_000; // high
  if (quality === "web") baseBps = 6_000_000;
  if (quality === "master") baseBps = 28_000_000;

  // AV1 and VP9 are ~55% of H.264 bitrate at equivalent perceptual quality
  if (codec === "av1" || codec === "vp9") {
    baseBps *= 0.55;
  }

  const pixelScale = (width * height) / (1920 * 1080);
  const fpsScale = Math.pow(Math.max(1, fps) / 30, 0.75);

  return Math.round(baseBps * pixelScale * fpsScale);
}

/**
 * Keyframe interval in seconds per WP-16 §3:
 * 2s for standard/master exports, 4s for web embeds to maximize compression.
 */
export function keyframeIntervalFor(quality: ExportQuality): number {
  return quality === "web" ? 4 : 2;
}

/**
 * Motion blur (quality-bar §5, WP-08): 8 sub-frame samples over a 180° shutter, i.e. half
 * a frame interval centred on the frame time.
 */
export const MOTION_BLUR_SAMPLES = 8;

export function motionBlurShutter(fps: number): number {
  return 0.5 / Math.max(1, fps);
}

/** GIF output: short side capped at 960 px (WP-16 §7), 10–20 fps. */
export function gifOutput(
  aspect: Aspect,
  resolution: number,
  fps: number,
): { width: number; height: number; fps: number } {
  return {
    ...outputDimensions(aspect, Math.min(960, resolution)),
    fps: Math.min(20, Math.max(10, fps || 15)),
  };
}

/** Which videos a web bundle holds; each needs its encoder in this browser. */
export interface BundleParts {
  mp4: boolean;
  webm: boolean;
}

/**
 * Estimates final file size in bytes for an export, from the bitrate the encoder is given.
 */
export function estimateFileSize(
  settings: ExportSettings,
  aspect: Aspect,
  durationSeconds: number,
  bundleParts: BundleParts = { mp4: true, webm: true },
): number {
  if (settings.format === "gif") {
    const { width, height, fps } = gifOutput(aspect, settings.resolution, settings.fps);
    const totalFrames = Math.max(1, Math.round(durationSeconds * fps));
    // GIFs with global palette and dither average ~0.25 bytes per pixel per frame
    return Math.round(width * height * totalFrames * 0.25);
  }

  if (settings.format === "png") {
    const { width, height } = outputDimensions(aspect, settings.resolution);
    // Typical uncompressed/deflated RGBA PNG size ~1.5MB at 1080p
    return Math.round(width * height * 0.8);
  }

  const { width, height } = outputDimensions(aspect, settings.resolution);
  // Bitrate is in bits/s -> divide by 8 for bytes
  const videoBytes = (codec: "avc" | "vp9") =>
    (calculateBitrate(settings.quality, codec, width, height, settings.fps) * durationSeconds) / 8;

  // Bundle holds the MP4 and/or WebM, both at the chosen quality, plus a poster (~400 KB)
  if (settings.format === "bundle") {
    const mp4 = bundleParts.mp4 ? videoBytes("avc") : 0;
    const webm = bundleParts.webm ? videoBytes("vp9") : 0;
    return Math.round(mp4 + webm + 400_000);
  }

  return Math.round(videoBytes(settings.format === "webm" ? "vp9" : "avc"));
}

/**
 * Formats byte counts into human-readable strings (e.g. "14.2 MB", "850 KB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
