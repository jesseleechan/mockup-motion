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
}

export interface ProbeOptions {
  width: number;
  height: number;
  fps: number;
  quality: ExportQuality;
}

async function canEncode(
  codec: "avc" | "vp9" | "av1",
  { width, height, fps, quality }: ProbeOptions,
): Promise<boolean> {
  const bitrate = calculateBitrate(quality, codec, width, height, fps);
  try {
    return await canEncodeVideo(codec, { width, height, frameRate: fps, bitrate });
  } catch (error) {
    // A rejected probe means this browser can't encode the codec at this size.
    console.warn(`Encoder probe for ${codec} at ${width}×${height} failed:`, error);
    return false;
  }
}

/**
 * Checks which video encoders this browser has at the export size and frame rate (AVC,
 * VP9, AV1). Without WebCodecs nothing can be encoded. Gates 4K on device memory.
 */
export async function probeVideoEncoders(options: ProbeOptions): Promise<CodecProbeResult> {
  const { width, height } = options;
  const hasWebCodecs = typeof VideoEncoder !== "undefined";

  const [avc, vp9, av1] = hasWebCodecs
    ? await Promise.all([
        canEncode("avc", options),
        canEncode("vp9", options),
        canEncode("av1", options),
      ])
    : [false, false, false];

  // 4K gate: 3840×2160 support plus at least 4 GB of device memory
  let canExport4K = true;
  if (width >= 3840 || height >= 3840) {
    const memGb =
      typeof navigator !== "undefined" && "deviceMemory" in navigator
        ? ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8)
        : 8;
    canExport4K = (avc || vp9) && memGb >= 4;
  }

  const recommendedCodec = avc ? "avc" : vp9 ? "vp9" : av1 ? "av1" : "avc";
  return {
    avc,
    vp9,
    av1,
    canExport4K,
    recommendedContainer: recommendedCodec === "avc" ? "mp4" : "webm",
    recommendedCodec,
  };
}
