import type { AssetProvider, TextRaster } from "../engine/Engine";
import { keepTopRows } from "../engine/textures/top-rows";
import { DEMO_ASSETS } from "../lab/demo-assets";
import { getBlob } from "../storage/blobs";
import { rasterizeText } from "../text";
import { DecodeCache, type Decoded } from "./decode-cache";

export function createEditorAssetProvider(): AssetProvider {
  // Decodes are lent: the engine hands each one back (releaseImage) when no texture shows it any
  // more, and the last one back closes it. The provider holds only what a texture still uses.
  const decodes = new DecodeCache();

  return {
    getImage(assetId: string, maxWidth: number, rows: number | null = null): Promise<ImageBitmap> {
      return decodes.borrow(assetId, maxWidth, rows, () => decodeAsset(assetId, maxWidth, rows));
    },

    releaseImage(bitmap: ImageBitmap): void {
      decodes.release(bitmap);
    },

    async getText(line, frameHeightPx): Promise<TextRaster> {
      return rasterizeText(line, frameHeightPx);
    },
  };
}

/** The asset at `maxWidth` or narrower, cut to the rows `rows` keeps (textureRows). */
async function decodeAsset(
  assetId: string,
  maxWidth: number,
  rows: number | null,
): Promise<Decoded> {
  try {
    let blob: Blob | null = null;

    // 1. Try to fetch from IndexedDB blobs
    if (assetId) {
      blob = await getBlob(assetId);
    }

    // 2. Demo content has no stored blob; resolve it through the demo manifest
    const demo = assetId ? DEMO_ASSETS.get(assetId) : undefined;
    if (!blob && demo) {
      const res = await fetch(demo.url);
      if (!res.ok) throw new Error(`Failed to fetch ${demo.url}: HTTP ${res.status}`);
      blob = await res.blob();
    }

    // 3. If not found in IndexedDB, try fetching if assetId is a URL or demo path
    if (
      !blob &&
      assetId &&
      (assetId.startsWith("/") ||
        assetId.startsWith("http") ||
        assetId.startsWith("blob:") ||
        assetId.startsWith("data:"))
    ) {
      const res = await fetch(assetId);
      if (res.ok) {
        blob = await res.blob();
      }
    }

    // 4. Fallback to default demo asset
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
      return await keepTopRows(bmp, rows);
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
  const ctx = canvas.getContext("2d") as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (ctx) {
    ctx.fillStyle = "#1e1e24";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#7c93ff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      assetId ? `Mockup: ${assetId.slice(0, 16)}` : "No screenshot selected",
      width / 2,
      height / 2,
    );
  }
  return { bitmap: await createImageBitmap(canvas), held: null };
}
