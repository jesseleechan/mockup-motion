import type { AssetProvider, TextRaster } from "../engine/Engine";
import { rasterizeText } from "../text";
import { DEMO_ASSETS } from "./demo-assets";

function isDirectUrl(assetId: string): boolean {
  return assetId.startsWith("http") || assetId.startsWith("/") || assetId.startsWith("blob:");
}

/** Lab asset source: demo ids resolve through `public/demo/manifest.json`; URLs load directly. */
export function resolveLabAssetUrl(assetId: string): string {
  if (isDirectUrl(assetId)) return assetId;
  const demo = DEMO_ASSETS.get(assetId);
  if (!demo) throw new Error(`Unknown demo asset: ${assetId}`);
  return demo.url;
}

export function createLabAssetProvider(): AssetProvider {
  const cache = new Map<string, ImageBitmap>();

  return {
    async getImage(assetId: string, maxWidth: number): Promise<ImageBitmap> {
      const cacheKey = `${assetId}:${maxWidth}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const src = resolveLabAssetUrl(assetId);
      const res = await fetch(src);
      if (!res.ok) throw new Error(`Failed to fetch ${src}: HTTP ${res.status}`);
      const blob = await res.blob();
      let bmp = await createImageBitmap(blob);
      if (bmp.width > maxWidth) {
        const targetH = Math.round((bmp.height * maxWidth) / bmp.width);
        bmp.close();
        bmp = await createImageBitmap(blob, {
          resizeWidth: maxWidth,
          resizeHeight: targetH,
          resizeQuality: "high",
        });
      }
      cache.set(cacheKey, bmp);
      return bmp;
    },

    async getText(layer, style, frameHeightPx): Promise<TextRaster> {
      return rasterizeText(layer, style, frameHeightPx);
    },
  };
}
