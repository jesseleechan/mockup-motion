import type { AssetProvider, TextRaster } from "../engine/Engine";
import { rasterizeText } from "../text";

export function createLabAssetProvider(): AssetProvider {
  const cache = new Map<string, ImageBitmap>();

  return {
    async getImage(assetId: string, maxWidth: number): Promise<ImageBitmap> {
      const cacheKey = `${assetId}:${maxWidth}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      let src = "/demo/aurelia.png";
      if (assetId.startsWith("http") || assetId.startsWith("/") || assetId.startsWith("blob:")) {
        src = assetId;
      }

      try {
        const res = await fetch(src);
        const blob = await res.blob();
        let bmp: ImageBitmap;
        if (typeof createImageBitmap !== "undefined") {
          // If maxWidth is smaller than source, resize
          bmp = await createImageBitmap(blob);
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
        } else {
          throw new Error("createImageBitmap unavailable");
        }
        cache.set(cacheKey, bmp);
        return bmp;
      } catch {
        // Fallback: create mock canvas bitmap with test grid
        const canvas =
          typeof OffscreenCanvas !== "undefined"
            ? new OffscreenCanvas(maxWidth, Math.round((maxWidth * 9) / 16))
            : document.createElement("canvas");
        canvas.width = maxWidth;
        canvas.height = Math.round((maxWidth * 9) / 16);
        const ctx = canvas.getContext("2d") as
          CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
        if (ctx) {
          ctx.fillStyle = "#222";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#fff";
          ctx.font = "24px sans-serif";
          ctx.fillText(`Asset: ${assetId}`, 20, 50);
        }
        const bmp = await createImageBitmap(canvas);
        cache.set(cacheKey, bmp);
        return bmp;
      }
    },

    async getText(layer, style, frameHeightPx): Promise<TextRaster> {
      return rasterizeText(layer, style, frameHeightPx);
    },
  };
}
