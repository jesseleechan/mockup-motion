import * as THREE from "three";
import type { AssetProvider } from "../Engine";

// Image sources are top-down: row 0 is v=0. Never rely on flipY for
// ImageBitmap, OffscreenCanvas, or VideoFrame because WebGL may ignore it.

export interface TextureStrip {
  texture: THREE.Texture;
  yOffset: number; // in pixels from top of full image
  height: number; // in pixels
}

export interface ManagedTexture {
  assetId: string;
  width: number;
  height: number;
  strips: TextureStrip[];
  bottomRowColor?: [number, number, number, number]; // RGBA 0..1
}

export class TextureManager {
  private cache = new Map<string, ManagedTexture>();
  private maxTextureSize: number;
  private maxAnisotropy: number;

  constructor(maxTextureSize: number = 4096, maxAnisotropy: number = 1) {
    this.maxTextureSize = maxTextureSize;
    this.maxAnisotropy = maxAnisotropy;
  }

  setMaxAnisotropy(anisotropy: number): void {
    this.maxAnisotropy = anisotropy;
  }

  setMaxTextureSize(size: number): void {
    this.maxTextureSize = size;
  }

  getLoadedTexture(assetId: string): ManagedTexture | null {
    for (const managed of this.cache.values()) {
      if (managed.assetId === assetId) return managed;
    }
    return null;
  }

  /**
   * Loads an asset through the provider, downscaled to the needed width,
   * tiled into vertical strips if taller than maxTextureSize, and configured
   * with SRGBColorSpace, mipmaps, and maximum anisotropy.
   */
  async getTexture(
    assetId: string,
    targetWidthPx: number,
    provider: AssetProvider,
  ): Promise<ManagedTexture | null> {
    if (!assetId) return null;

    // Cache key incorporates requested target width to avoid redundant decodes
    const cacheKey = `${assetId}:${targetWidthPx}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const bitmap = await provider.getImage(assetId, targetWidthPx);
      const width = bitmap.width;
      const height = bitmap.height;

      const stripMaxHeight = Math.min(this.maxTextureSize, 4096);
      const strips: TextureStrip[] = [];

      if (height <= stripMaxHeight) {
        const texture = this.createTexture(bitmap);
        strips.push({ texture, yOffset: 0, height });
      } else {
        // Tile tall images into vertical strips
        const stripCount = Math.ceil(height / stripMaxHeight);
        for (let i = 0; i < stripCount; i++) {
          const yOffset = i * stripMaxHeight;
          const currentStripHeight = Math.min(stripMaxHeight, height - yOffset);

          let stripBitmap: ImageBitmap;
          if (typeof createImageBitmap !== "undefined") {
            stripBitmap = await createImageBitmap(bitmap, 0, yOffset, width, currentStripHeight);
          } else {
            // Fallback for environments without createImageBitmap slice
            stripBitmap = bitmap;
          }

          const texture = this.createTexture(stripBitmap);
          strips.push({ texture, yOffset, height: currentStripHeight });
        }
      }

      // Sample bottom-row color if canvas is available
      let bottomRowColor: [number, number, number, number] | undefined;
      try {
        bottomRowColor = this.extractBottomRowColor(bitmap);
      } catch {
        // Fallback if readback fails
      }

      const managed: ManagedTexture = {
        assetId,
        width,
        height,
        strips,
        bottomRowColor,
      };

      this.cache.set(cacheKey, managed);
      return managed;
    } catch (err) {
      console.warn(`[TextureManager] Failed to load asset ${assetId}:`, err);
      return null;
    }
  }

  private createTexture(imageSource: ImageBitmap | HTMLCanvasElement): THREE.Texture {
    const texture = new THREE.Texture(imageSource);
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = this.maxAnisotropy;
    texture.needsUpdate = true;
    return texture;
  }

  private extractBottomRowColor(bitmap: ImageBitmap): [number, number, number, number] | undefined {
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(bitmap.width, 1);
    } else if (typeof document !== "undefined") {
      canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = 1;
    } else {
      return undefined;
    }

    const ctx = canvas.getContext("2d") as
      CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) return undefined;

    ctx.drawImage(bitmap, 0, bitmap.height - 1, bitmap.width, 1, 0, 0, bitmap.width, 1);
    const data = ctx.getImageData(0, 0, bitmap.width, 1).data;

    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    const pixelCount = bitmap.width;

    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      a += data[i + 3];
    }

    return [
      r / (pixelCount * 255),
      g / (pixelCount * 255),
      b / (pixelCount * 255),
      a / (pixelCount * 255),
    ];
  }

  dispose(): void {
    for (const managed of this.cache.values()) {
      for (const strip of managed.strips) {
        strip.texture.dispose();
      }
    }
    this.cache.clear();
  }
}
