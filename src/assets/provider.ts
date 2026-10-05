import type { Style, TextLayer } from "../doc/types";
import { rasterizeText, type TextRaster } from "../text/rasterize";

export interface AssetProvider {
  /** Decoded image, downscaled with high-quality resampling so width <= maxWidth. */
  getImage(assetId: string, maxWidth: number): Promise<ImageBitmap>;
  /** Pre-rasterised text layer at the given output height. */
  getText(layer: TextLayer, style: Style, frameHeightPx: number): Promise<TextRaster>;
}

export function bucketWidth(targetWidth: number): number {
  if (targetWidth <= 256) return 256;
  const k = Math.ceil(2 * Math.log2(targetWidth));
  return Math.round(Math.pow(2, k / 2));
}

interface CacheEntry {
  bitmap: ImageBitmap;
  bytes: number;
  lastUsed: number;
}

const MAX_CACHE_BYTES = 512 * 1024 * 1024; // 512 MB

export function createAssetProvider(
  getBlob: (assetId: string) => Promise<Blob | null>,
): AssetProvider {
  const cache = new Map<string, CacheEntry>();
  let currentCacheBytes = 0;

  function evictIfNeeded() {
    while (currentCacheBytes > MAX_CACHE_BYTES && cache.size > 0) {
      // Find least recently used
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of cache.entries()) {
        if (entry.lastUsed < oldestTime) {
          oldestTime = entry.lastUsed;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        const entry = cache.get(oldestKey)!;
        entry.bitmap.close();
        currentCacheBytes -= entry.bytes;
        cache.delete(oldestKey);
      } else {
        break;
      }
    }
  }

  async function decodeWithResize(blob: Blob, targetWidth: number): Promise<ImageBitmap> {
    try {
      // Modern browsers: native resizeWidth option on createImageBitmap
      return await createImageBitmap(blob, {
        resizeWidth: targetWidth,
        resizeQuality: "high",
      });
    } catch (_err) {
      // Fallback: full decode then step-down halving on OffscreenCanvas
      const fullBitmap = await createImageBitmap(blob);
      if (fullBitmap.width <= targetWidth || typeof OffscreenCanvas === "undefined") {
        return fullBitmap;
      }

      let currentW = fullBitmap.width;
      let currentH = fullBitmap.height;
      const targetH = Math.round((currentH * targetWidth) / currentW);

      let canvas = new OffscreenCanvas(currentW, currentH);
      const ctx = canvas.getContext("2d");
      if (!ctx) return fullBitmap;

      ctx.drawImage(fullBitmap, 0, 0);
      fullBitmap.close();

      // Step-down halving
      while (currentW / 2 >= targetWidth) {
        const halfW = Math.round(currentW / 2);
        const halfH = Math.round(currentH / 2);
        const nextCanvas = new OffscreenCanvas(halfW, halfH);
        const nextCtx = nextCanvas.getContext("2d");
        if (!nextCtx) break;
        nextCtx.imageSmoothingEnabled = true;
        nextCtx.imageSmoothingQuality = "high";
        nextCtx.drawImage(canvas, 0, 0, halfW, halfH);
        canvas = nextCanvas;
        currentW = halfW;
        currentH = halfH;
      }

      // Final resize to exact targetWidth
      if (currentW !== targetWidth) {
        const finalCanvas = new OffscreenCanvas(targetWidth, targetH);
        const finalCtx = finalCanvas.getContext("2d");
        if (finalCtx) {
          finalCtx.imageSmoothingEnabled = true;
          finalCtx.imageSmoothingQuality = "high";
          finalCtx.drawImage(canvas, 0, 0, targetWidth, targetH);
          return finalCanvas.transferToImageBitmap();
        }
      }

      return canvas.transferToImageBitmap();
    }
  }

  return {
    async getImage(assetId: string, maxWidth: number): Promise<ImageBitmap> {
      const bucket = bucketWidth(maxWidth);
      const cacheKey = `${assetId}:${bucket}`;

      const existing = cache.get(cacheKey);
      if (existing) {
        existing.lastUsed = Date.now();
        return existing.bitmap;
      }

      const blob = await getBlob(assetId);
      if (!blob) {
        throw new Error(`Asset not found: ${assetId}`);
      }

      const bitmap = await decodeWithResize(blob, bucket);
      const bytes = bitmap.width * bitmap.height * 4;

      const entry: CacheEntry = {
        bitmap,
        bytes,
        lastUsed: Date.now(),
      };

      cache.set(cacheKey, entry);
      currentCacheBytes += bytes;
      evictIfNeeded();

      return bitmap;
    },

    async getText(layer: TextLayer, style: Style, frameHeightPx: number): Promise<TextRaster> {
      return rasterizeText(layer, style, frameHeightPx);
    },
  };
}
