import { canEncodeVideo } from "mediabunny";
import { calculateBitrate } from "./destinations";
import type { ExportQuality } from "../doc/types";

export interface CodecProbeResult {
  avc: boolean;
  vp9: boolean;
  av1: boolean;
  canExport4K: boolean;
  recommendedContainer: "mp4" | "webm";
  recommendedCodec: "avc" | "vp9" | "av1";
  fallbackMessage?: string;
}

export interface ProbeOptions {
  width: number;
  height: number;
  fps: number;
  quality: ExportQuality;
}

/**
 * Checks video encoder capabilities via Mediabunny for AVC, VP9, and AV1.
 * Gates 4K on browser encoder support and memory limits.
 */
export async function probeVideoEncoders(options: ProbeOptions): Promise<CodecProbeResult> {
  const { width, height, fps, quality } = options;

  // In test / headless Node environments without WebCodecs VideoEncoder:
  const hasWebCodecs = typeof window !== "undefined" && "VideoEncoder" in window;

  let avcSupported = true;
  let vp9Supported = true;
  let av1Supported = false;

  if (hasWebCodecs) {
    const avcBitrate = calculateBitrate(quality, "avc", width, height, fps);
    const vp9Bitrate = calculateBitrate(quality, "vp9", width, height, fps);
    const av1Bitrate = calculateBitrate(quality, "av1", width, height, fps);

    try {
      const [canAvc, canVp9, canAv1] = await Promise.all([
        canEncodeVideo("avc", { width, height, frameRate: fps, bitrate: avcBitrate }).catch(() => false),
        canEncodeVideo("vp9", { width, height, frameRate: fps, bitrate: vp9Bitrate }).catch(() => false),
        canEncodeVideo("av1", { width, height, frameRate: fps, bitrate: av1Bitrate }).catch(() => false),
      ]);

      avcSupported = canAvc;
      vp9Supported = canVp9;
      av1Supported = canAv1;
    } catch {
      // Keep sensible fallbacks
      avcSupported = true;
      vp9Supported = true;
    }
  }

  // 4K Gate: Check 3840x2160 support plus device memory estimate
  let canExport4K: boolean;
  if (width >= 3840 || height >= 3840) {
    const memGb =
      typeof navigator !== "undefined" && "deviceMemory" in navigator
        ? (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8
        : 8;

    // 4K requires either AVC or VP9 at 4K resolution and at least 4GB RAM
    canExport4K = (avcSupported || vp9Supported) && memGb >= 4;
  } else {
    canExport4K = true;
  }

  let recommendedContainer: "mp4" | "webm" = "mp4";
  let recommendedCodec: "avc" | "vp9" | "av1" = "avc";
  let fallbackMessage: string | undefined;

  if (avcSupported) {
    recommendedContainer = "mp4";
    recommendedCodec = "avc";
  } else if (vp9Supported) {
    recommendedContainer = "webm";
    recommendedCodec = "vp9";
    fallbackMessage = "MP4 isn't available in this browser; exporting WebM (VP9).";
  } else if (av1Supported) {
    recommendedContainer = "webm";
    recommendedCodec = "av1";
    fallbackMessage = "MP4 isn't available in this browser; exporting WebM (AV1).";
  }

  if ((width >= 3840 || height >= 2160) && !avcSupported && vp9Supported) {
    fallbackMessage = "MP4 isn't available at 4K in this browser; exporting WebM.";
  }

  return {
    avc: avcSupported,
    vp9: vp9Supported,
    av1: av1Supported,
    canExport4K,
    recommendedContainer,
    recommendedCodec,
    fallbackMessage,
  };
}
