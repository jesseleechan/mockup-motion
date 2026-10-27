import type { AssetProvider, TextRaster } from "../engine/Engine";
import { holdsRows } from "../engine/textures/sizing";
import { keepTopRows } from "../engine/textures/top-rows";
import { rasterizeText } from "../text";
import { DEMO_ASSETS } from "./demo-assets";
import { labTestImageFromId } from "./test-images";

function isDirectUrl(assetId: string): boolean {
  return assetId.startsWith("http") || assetId.startsWith("/") || assetId.startsWith("blob:");
}

/**
 * Lab asset source: demo ids resolve through `public/demo/manifest.json`; URLs load directly.
 * `lab-test-*` ids are generated pixel fixtures (see `test-images.ts`) and never fetched.
 */
export function resolveLabAssetUrl(assetId: string): string {
  if (isDirectUrl(assetId)) return assetId;
  const demo = DEMO_ASSETS.get(assetId);
  if (!demo) throw new Error(`Unknown demo asset: ${assetId}`);
  return demo.url;
}

export function createLabAssetProvider(): AssetProvider {
  // As the editor's provider: one decode per asset and width, the most rows asked for so far.
  const cache = new Map<string, { bitmap: ImageBitmap; held: number | null }>();

  return {
    async getImage(
      assetId: string,
      maxWidth: number,
      rows: number | null = null,
    ): Promise<ImageBitmap> {
      const cacheKey = `${assetId}:${maxWidth}`;
      const cached = cache.get(cacheKey);
      if (cached && holdsRows(cached.held, rows)) return cached.bitmap;

      // Generated fixtures stay whole; the engine keeps the rows it needs.
      const testImage = await labTestImageFromId(assetId, maxWidth);
      if (testImage) {
        cache.set(cacheKey, { bitmap: testImage, held: null });
        return testImage;
      }

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
      const top = await keepTopRows(bmp, rows);
      cache.set(cacheKey, top);
      return top.bitmap;
    },

    async getText(line, frameHeightPx): Promise<TextRaster> {
      return rasterizeText(line, frameHeightPx);
    },
  };
}
