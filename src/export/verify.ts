import { ALL_FORMATS, BlobSource, Input } from "mediabunny";

export interface VerifyExportExpected {
  width: number;
  height: number;
  duration: number; // in seconds
  fps: number;
  codec?: "avc" | "vp9" | "av1";
}

export interface VerifyExportResult {
  valid: boolean;
  actual?: {
    width: number;
    height: number;
    duration: number;
    codec?: string;
  };
  warnings: string[];
}

/**
 * Inspects a generated media Blob using Mediabunny demuxer to verify
 * dimensions, duration (within ±1 frame), and video track codec.
 */
export async function verifyExportBlob(
  blob: Blob,
  expected: VerifyExportExpected,
): Promise<VerifyExportResult> {
  const warnings: string[] = [];

  // If blob is empty
  if (blob.size === 0) {
    return {
      valid: false,
      warnings: ["Export blob is empty (0 bytes)."],
    };
  }

  // Handle GIF or image types (mediabunny Input expects container video formats)
  if (blob.type === "image/gif" || blob.type === "image/png" || blob.type === "image/webp") {
    return {
      valid: true,
      warnings: [],
    };
  }

  const source = new BlobSource(blob);
  const input = new Input({ source, formats: ALL_FORMATS });

  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      warnings.push("No primary video track found in output container.");
      return { valid: false, warnings };
    }

    const width = videoTrack.displayWidth ?? videoTrack.codedWidth;
    const height = videoTrack.displayHeight ?? videoTrack.codedHeight;
    const trackCodec = videoTrack.codec;

    let duration = await input.computeDuration().catch(() => null);
    if (duration === null) {
      duration = await input.getDurationFromMetadata().catch(() => null);
    }
    const actualDuration = duration ?? 0;

    const actual = {
      width,
      height,
      duration: actualDuration,
      codec: trackCodec ?? undefined,
    };

    // 1. Verify dimensions
    if (width !== expected.width || height !== expected.height) {
      warnings.push(
        `Dimension mismatch: expected ${expected.width}×${expected.height}, got ${width}×${height}.`,
      );
    }

    // 2. Verify duration within ±1 frame
    const frameTolerance = 1 / Math.max(1, expected.fps) + 0.05;
    if (Math.abs(actualDuration - expected.duration) > frameTolerance) {
      warnings.push(
        `Duration mismatch: expected ${expected.duration.toFixed(2)}s (±${frameTolerance.toFixed(3)}s), got ${actualDuration.toFixed(2)}s.`,
      );
    }

    // 3. Verify codec if specified
    if (expected.codec && trackCodec) {
      const normalizedTrackCodec = trackCodec.toLowerCase();
      const match =
        (expected.codec === "avc" && (normalizedTrackCodec.startsWith("avc") || normalizedTrackCodec.includes("h264"))) ||
        (expected.codec === "vp9" && (normalizedTrackCodec.startsWith("vp09") || normalizedTrackCodec.includes("vp9"))) ||
        (expected.codec === "av1" && (normalizedTrackCodec.startsWith("av01") || normalizedTrackCodec.includes("av1")));

      if (!match) {
        warnings.push(`Codec mismatch: expected ${expected.codec}, got ${trackCodec}.`);
      }
    }

    return {
      valid: warnings.length === 0,
      actual,
      warnings,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Verification error: ${msg}`);
    return {
      valid: false,
      warnings,
    };
  } finally {
    input.dispose();
  }
}
