import { applyPalette, GIFEncoder, quantize } from "gifenc";

export interface GifExportOptions {
  width: number;
  height: number;
  fps?: number; // 15 or 20
  dither?: boolean;
}

export interface GifExportProgress {
  frame: number;
  total: number;
  percentage: number;
}

/**
 * Applies Floyd-Steinberg error diffusion dithering to an RGBA buffer
 * against a 256-color palette.
 */
function ditherFloydSteinberg(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  palette: number[][],
): Uint8Array {
  const index = new Uint8Array(width * height);

  // Work on a mutable copy of RGB values with floating point precision for error propagation
  const rBuf = new Float32Array(width * height);
  const gBuf = new Float32Array(width * height);
  const bBuf = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    rBuf[i] = rgba[idx];
    gBuf[i] = rgba[idx + 1];
    bBuf[i] = rgba[idx + 2];
  }

  // Nearest color finder in palette
  const findNearest = (r: number, g: number, b: number): number => {
    let bestIdx = 0;
    let minDist = Infinity;
    for (let p = 0; p < palette.length; p++) {
      const pr = palette[p][0];
      const pg = palette[p][1];
      const pb = palette[p][2];
      const dr = r - pr;
      const dg = g - pg;
      const db = b - pb;
      const dist = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
      if (dist < minDist) {
        minDist = dist;
        bestIdx = p;
      }
    }
    return bestIdx;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const oldR = Math.min(255, Math.max(0, rBuf[i]));
      const oldG = Math.min(255, Math.max(0, gBuf[i]));
      const oldB = Math.min(255, Math.max(0, bBuf[i]));

      const palIdx = findNearest(oldR, oldG, oldB);
      index[i] = palIdx;

      const palColor = palette[palIdx];
      const errR = oldR - palColor[0];
      const errG = oldG - palColor[1];
      const errB = oldB - palColor[2];

      // Diffuse error (7/16, 3/16, 5/16, 1/16)
      if (x + 1 < width) {
        const next = i + 1;
        rBuf[next] += (errR * 7) / 16;
        gBuf[next] += (errG * 7) / 16;
        bBuf[next] += (errB * 7) / 16;
      }
      if (x - 1 >= 0 && y + 1 < height) {
        const next = (y + 1) * width + (x - 1);
        rBuf[next] += (errR * 3) / 16;
        gBuf[next] += (errG * 3) / 16;
        bBuf[next] += (errB * 3) / 16;
      }
      if (y + 1 < height) {
        const next = (y + 1) * width + x;
        rBuf[next] += (errR * 5) / 16;
        gBuf[next] += (errG * 5) / 16;
        bBuf[next] += (errB * 5) / 16;
      }
      if (x + 1 < width && y + 1 < height) {
        const next = (y + 1) * width + (x + 1);
        rBuf[next] += (errR * 1) / 16;
        gBuf[next] += (errG * 1) / 16;
        bBuf[next] += (errB * 1) / 16;
      }
    }
  }

  return index;
}

/**
 * Encodes an array of RGBA frame pixel buffers into an optimized GIF using gifenc.
 * - Global 256-color palette sampled across frames
 * - Optional Floyd-Steinberg error diffusion dithering to prevent gradient banding
 * - Size calculation with 15 MB threshold warning
 */
export function encodeGif(
  frames: Uint8ClampedArray[],
  options: GifExportOptions,
  onProgress?: (p: GifExportProgress) => void,
): { blob: Blob; mime: "image/gif"; bytes: number; exceedsSizeWarning: boolean } {
  const { width, height } = options;
  const fps = Math.min(20, Math.max(10, options.fps ?? 15));
  const delayMs = Math.round(1000 / fps);
  const useDither = options.dither ?? true;

  if (frames.length === 0) {
    throw new Error("Cannot encode GIF without frames");
  }

  // 1. Build a combined sample buffer to quantize a global palette
  const sampleStride = Math.max(1, Math.floor(frames.length / 8));
  const sampledFrames: Uint8ClampedArray[] = [];
  for (let f = 0; f < frames.length; f += sampleStride) {
    sampledFrames.push(frames[f]);
  }

  const sampleTotalLen = sampledFrames.reduce((acc, cur) => acc + cur.length, 0);
  const combinedSample = new Uint8Array(sampleTotalLen);
  let offset = 0;
  for (const sf of sampledFrames) {
    combinedSample.set(sf, offset);
    offset += sf.length;
  }

  // Quantize 256 colors
  const palette = quantize(combinedSample, 256, { format: "rgb565" });

  // 2. Initialize GIF encoder
  const gif = GIFEncoder();

  for (let f = 0; f < frames.length; f++) {
    const rgba = frames[f];
    const indexed = useDither
      ? ditherFloydSteinberg(rgba, width, height, palette)
      : applyPalette(rgba, palette, "rgb565");

    gif.writeFrame(indexed, width, height, {
      palette,
      delay: delayMs,
      repeat: 0, // loop indefinitely
    });

    if (onProgress) {
      onProgress({
        frame: f + 1,
        total: frames.length,
        percentage: Math.round(((f + 1) / frames.length) * 100),
      });
    }
  }

  gif.finish();
  const outputBytes = gif.bytes();
  const blob = new Blob([outputBytes.buffer as ArrayBuffer], { type: "image/gif" });
  const exceedsSizeWarning = outputBytes.length > 15 * 1024 * 1024; // > 15MB warning

  return {
    blob,
    mime: "image/gif",
    bytes: outputBytes.length,
    exceedsSizeWarning,
  };
}
