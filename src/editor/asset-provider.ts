import type { AssetProvider, TextRaster } from "../engine/Engine";
import { getBlob } from "../storage/blobs";
import { rasterizeText } from "../text";

export function createEditorAssetProvider(): AssetProvider {
  const cache = new Map<string, ImageBitmap>();

  return {
    async getImage(assetId: string, maxWidth: number): Promise<ImageBitmap> {
      const cacheKey = `${assetId}:${maxWidth}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      try {
        let blob: Blob | null = null;

        // 1. Try to fetch from IndexedDB blobs
        if (assetId) {
          blob = await getBlob(assetId);
        }

        // 2. If not found in IndexedDB, try fetching if assetId is a URL or demo path
        if (!blob && assetId && (assetId.startsWith("/") || assetId.startsWith("http") || assetId.startsWith("blob:") || assetId.startsWith("data:"))) {
          const res = await fetch(assetId);
          if (res.ok) {
            blob = await res.blob();
          }
        }

        // 3. Fallback to default demo asset
        if (!blob) {
          const fallbackRes = await fetch("/demo/aurelia/desktop-hero.webp");
          if (fallbackRes.ok) {
            blob = await fallbackRes.blob();
          }
        }

        if (blob && typeof createImageBitmap !== "undefined") {
          let bmp = await createImageBitmap(blob);
          if (bmp.width > maxWidth) {
            const scale = maxWidth / bmp.width;
            const targetH = Math.round(bmp.height * scale);
            bmp.close();
            bmp = await createImageBitmap(blob, {
              resizeWidth: maxWidth,
              resizeHeight: targetH,
              resizeQuality: "high",
            });
          }
          cache.set(cacheKey, bmp);
          return bmp;
        }
      } catch (err) {
        console.warn(`[AssetProvider] Failed to load asset ${assetId}:`, err);
      }

      // Fallback placeholder canvas
      const width = maxWidth;
      const height = Math.round((maxWidth * 9) / 16);
      const canvas =
        typeof OffscreenCanvas !== "undefined"
          ? new OffscreenCanvas(width, height)
          : document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
      if (ctx) {
        ctx.fillStyle = "#1e1e24";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#7c93ff";
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(assetId ? `Mockup: ${assetId.slice(0, 16)}` : "No screenshot selected", width / 2, height / 2);
      }
      const bmp = await createImageBitmap(canvas);
      cache.set(cacheKey, bmp);
      return bmp;
    },

    async getText(layer, style, frameHeightPx): Promise<TextRaster> {
      return rasterizeText(layer, style, frameHeightPx);
    },
  };
}
