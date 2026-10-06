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

interface CacheEntry {
  managed: ManagedTexture;
  /** The width this entry was decoded for; the bitmap may be narrower (small source). */
  requestedWidth: number;
  /** Strip bitmaps sliced here. Provider bitmaps are never closed by this class. */
  ownedBitmaps: ImageBitmap[];
}

/**
 * GPU textures for image assets: one entry per asset, at the largest width any
 * document has asked for since the asset was last released by `retainOnly`.
 */
export class TextureManager {
  private cache = new Map<string, CacheEntry>();
  private pending = new Map<string, Promise<ManagedTexture | null>>();
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

  /** The largest loaded texture for an asset, or null when none is loaded. */
  getLoadedTexture(assetId: string): ManagedTexture | null {
    return this.cache.get(assetId)?.managed ?? null;
  }

  /**
   * Loads an asset through the provider, downscaled to the needed width,
   * tiled into vertical strips if taller than maxTextureSize, and configured
   * with SRGBColorSpace, mipmaps, and maximum anisotropy. Reuses a loaded entry
   * that is at least as wide; a wider request replaces it.
   */
  async getTexture(
    assetId: string,
    targetWidthPx: number,
    provider: AssetProvider,
  ): Promise<ManagedTexture | null> {
    if (!assetId) return null;

    const cached = this.cache.get(assetId);
    if (cached && cached.requestedWidth >= targetWidthPx) return cached.managed;

    const pendingKey = `${assetId}:${targetWidthPx}`;
    const inFlight = this.pending.get(pendingKey);
    if (inFlight) return inFlight;

    const load = this.load(assetId, targetWidthPx, provider).finally(() => {
      this.pending.delete(pendingKey);
    });
    this.pending.set(pendingKey, load);
    return load;
  }

  private async load(
    assetId: string,
    targetWidthPx: number,
    provider: AssetProvider,
  ): Promise<ManagedTexture | null> {
    let bitmap: ImageBitmap;
    try {
      bitmap = await provider.getImage(assetId, targetWidthPx);
    } catch (err) {
      // A missing asset renders the empty screen; debugInfo() reports it unloaded.
      console.warn(`[TextureManager] Failed to load asset ${assetId}:`, err);
      return null;
    }

    const width = bitmap.width;
    const height = bitmap.height;
    const stripMaxHeight = Math.min(this.maxTextureSize, 4096);
    const strips: TextureStrip[] = [];
    const ownedBitmaps: ImageBitmap[] = [];

    if (height <= stripMaxHeight) {
      strips.push({ texture: this.createTexture(bitmap), yOffset: 0, height });
    } else {
      // Tile tall images into vertical strips
      const stripCount = Math.ceil(height / stripMaxHeight);
      for (let i = 0; i < stripCount; i++) {
        const yOffset = i * stripMaxHeight;
        const stripHeight = Math.min(stripMaxHeight, height - yOffset);
        const stripBitmap = await createImageBitmap(bitmap, 0, yOffset, width, stripHeight);
        ownedBitmaps.push(stripBitmap);
        strips.push({ texture: this.createTexture(stripBitmap), yOffset, height: stripHeight });
      }
    }

    const managed: ManagedTexture = {
      assetId,
      width,
      height,
      strips,
      bottomRowColor: this.extractBottomRowColor(bitmap),
    };

    // A wider load may have finished first; keep whichever is wider.
    const existing = this.cache.get(assetId);
    if (existing && existing.requestedWidth >= targetWidthPx) {
      this.release({ managed, requestedWidth: targetWidthPx, ownedBitmaps });
      return existing.managed;
    }
    if (existing) this.release(existing);
    this.cache.set(assetId, { managed, requestedWidth: targetWidthPx, ownedBitmaps });
    return managed;
  }

  /** Disposes textures for every asset not in `assetIds`. */
  retainOnly(assetIds: Iterable<string>): void {
    const keep = new Set(assetIds);
    for (const [assetId, entry] of this.cache) {
      if (keep.has(assetId)) continue;
      this.release(entry);
      this.cache.delete(assetId);
    }
  }

  private release(entry: CacheEntry): void {
    for (const strip of entry.managed.strips) strip.texture.dispose();
    for (const bitmap of entry.ownedBitmaps) bitmap.close();
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
    for (const entry of this.cache.values()) this.release(entry);
    this.cache.clear();
  }
}
