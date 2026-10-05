import type { AssetRef } from "../doc/types";
import { dominantColors } from "./palette";

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/avif"]);

const MAX_BYTES = 35 * 1024 * 1024; // 35 MB
const MAX_MEGAPIXELS = 80_000_000; // 80 MP

export async function validateAndDecodeAsset(
  blob: Blob,
  name: string,
  id = crypto.randomUUID(),
): Promise<{ ref: AssetRef; blob: Blob }> {
  if (!ALLOWED_MIME_TYPES.has(blob.type)) {
    throw new Error(`${name}: use PNG, JPG, WebP, or AVIF.`);
  }

  if (blob.size > MAX_BYTES) {
    throw new Error(`${name}: images must be below 35 MB.`);
  }

  let width = 0;
  let height = 0;

  try {
    if (typeof createImageBitmap !== "undefined") {
      const bitmap = await createImageBitmap(blob);
      width = bitmap.width;
      height = bitmap.height;
      bitmap.close();
    } else if (typeof Image !== "undefined") {
      const url = URL.createObjectURL(blob);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        width = img.naturalWidth;
        height = img.naturalHeight;
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  } catch {
    throw new Error(`${name}: this image couldn't be read.`);
  }

  if (!width || !height) {
    throw new Error(`${name}: this image couldn't be read.`);
  }
  if (width * height > MAX_MEGAPIXELS) {
    throw new Error(`${name}: image is too large. Use an image below 80 megapixels.`);
  }

  const aspect = width / height;
  const role = aspect < 0.75 ? "mobile" : "desktop";
  const tall = height > width * 1.5;

  const ref: AssetRef = {
    id,
    kind: "image",
    name,
    mime: blob.type,
    bytes: blob.size,
    width,
    height,
    role,
    meta: { tall },
  };

  try {
    let canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(64, 64);
    } else if (typeof document !== "undefined") {
      canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
    }
    if (canvas) {
      const ctx = canvas.getContext("2d") as
        CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
      if (ctx && typeof createImageBitmap !== "undefined") {
        const thumbBmp = await createImageBitmap(blob, {
          resizeWidth: 64,
          resizeHeight: 64,
          resizeQuality: "low",
        });
        ctx.drawImage(thumbBmp, 0, 0);
        thumbBmp.close();
        const imgData = ctx.getImageData(0, 0, 64, 64);
        ref.palette = dominantColors(imgData.data, 64, 64);
      }
    }
  } catch {
    // Ignore palette extraction fallback in test or headless environments
  }

  return { ref, blob };
}
