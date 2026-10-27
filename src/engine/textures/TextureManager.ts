import * as THREE from "three";
import type { AssetProvider } from "../Engine";
import { holdsRows, keptRows, moreRows } from "./sizing";

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
  /**
   * The rows the strips hold: the image's height at `width`, or its top rows when no shot
   * scrolls it (textureRows). A screen shows such an image from its top, never past these rows.
   */
  height: number;
  strips: TextureStrip[];
  /** The last row held. An image shorter than its screen is always held whole (textureRows). */
  bottomRowColor?: [number, number, number, number]; // RGBA 0..1
  topRowColor?: [number, number, number, number]; // RGBA 0..1, behind a phone's status bar
}

interface CacheEntry {
  managed: ManagedTexture;
  /** The width this entry was decoded for; the bitmap may be narrower (small source). */
  requestedWidth: number;
  /** The rows this entry was decoded for (textureRows); null holds the whole image. */
  requestedRows: number | null;
  /** Strip bitmaps sliced here. Provider bitmaps are never closed by this class. */
  ownedBitmaps: ImageBitmap[];
  /**
   * The provider's bitmap when the texture shows it itself, handed back to the provider
   * (`releaseImage`) when the entry is released: a WebGL context restore uploads it again.
   * Strips are copies, so a bitmap cut into strips goes back as soon as they are cut.
   */
  borrowed: { bitmap: ImageBitmap; provider: AssetProvider } | null;
}

interface PendingLoad {
  promise: Promise<ManagedTexture | null>;
  width: number;
  rows: number | null;
}

/**
 * GPU textures for image assets: one entry per asset, at the largest width and the most rows
 * any document has asked for since the asset was last released by `retainOnly`. Every bitmap a
 * provider lends goes back to it (`AssetProvider.releaseImage`) once no texture shows it.
 */
export class TextureManager {
  private cache = new Map<string, CacheEntry>();
  // At most one load per asset, so each starts from what the last one kept.
  private pending = new Map<string, PendingLoad>();
  private maxTextureSize: number;
  private maxAnisotropy: number;
  private disposed = false;

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
   * Loads an asset through the provider, downscaled to the needed width, cut to the top `rows`
   * (textureRows; null keeps every row), tiled into vertical strips if taller than
   * maxTextureSize, and configured with SRGBColorSpace, mipmaps, and maximum anisotropy. Reuses
   * a loaded entry that is at least as wide and holds those rows. Otherwise it loads again with
   * at least what the entry holds, so an entry only grows (a document that needs fewer rows keeps
   * the larger decode), and disposes the entry it replaces.
   */
  async getTexture(
    assetId: string,
    targetWidthPx: number,
    provider: AssetProvider,
    rows: number | null = null,
  ): Promise<ManagedTexture | null> {
    if (!assetId) return null;

    const cached = this.cache.get(assetId);
    if (cached && cached.requestedWidth >= targetWidthPx && holdsRows(cached.requestedRows, rows)) {
      return cached.managed;
    }

    const inFlight = this.pending.get(assetId);
    if (inFlight) {
      const enough = inFlight.width >= targetWidthPx && holdsRows(inFlight.rows, rows);
      if (enough) return inFlight.promise;
      // A load for less is running. Let it finish first, so it can't replace this one, then
      // ask again from what it kept.
      await inFlight.promise;
      return this.getTexture(assetId, targetWidthPx, provider, rows);
    }

    const width = Math.max(targetWidthPx, cached?.requestedWidth ?? 0);
    const loadRows = cached ? moreRows(cached.requestedRows, rows) : rows;
    const promise = this.load(assetId, width, loadRows, provider).finally(() => {
      this.pending.delete(assetId);
    });
    this.pending.set(assetId, { promise, width, rows: loadRows });
    return promise;
  }

  private async load(
    assetId: string,
    targetWidthPx: number,
    rows: number | null,
    provider: AssetProvider,
  ): Promise<ManagedTexture | null> {
    let bitmap: ImageBitmap;
    try {
      bitmap = await provider.getImage(assetId, targetWidthPx, rows);
    } catch (err) {
      // A missing asset renders the empty screen; debugInfo() reports it unloaded.
      console.warn(`[TextureManager] Failed to load asset ${assetId}:`, err);
      return null;
    }

    const width = bitmap.width;
    // A provider may return more rows than asked for; the strips hold only those.
    const height = keptRows(rows, width, bitmap.height);
    const stripMaxHeight = Math.min(this.maxTextureSize, 4096);
    const strips: TextureStrip[] = [];
    const ownedBitmaps: ImageBitmap[] = [];
    let entry: CacheEntry | null = null;

    try {
      const showsBitmap = height === bitmap.height && height <= stripMaxHeight;
      if (showsBitmap) {
        strips.push({ texture: this.createTexture(bitmap), yOffset: 0, height });
      } else {
        // Tile tall images into vertical strips; the slices leave out any rows not held.
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
        bottomRowColor: this.extractRowColor(bitmap, height - 1),
        topRowColor: this.extractRowColor(bitmap, 0),
      };
      entry = {
        managed,
        requestedWidth: targetWidthPx,
        requestedRows: rows,
        ownedBitmaps,
        borrowed: showsBitmap ? { bitmap, provider } : null,
      };
    } finally {
      // Nothing shows the provider's bitmap: its strips are copies, or the load failed.
      if (!entry?.borrowed) provider.releaseImage?.(bitmap);
    }

    if (this.disposed) {
      // dispose() ran during this load, so nothing else would ever release the entry.
      this.release(entry);
      return null;
    }
    // No other load of this asset ran meanwhile (getTexture), and this one asked for at least
    // what the entry holds, so it replaces the entry.
    const existing = this.cache.get(assetId);
    if (existing) this.release(existing);
    this.cache.set(assetId, entry);
    return entry.managed;
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
    entry.borrowed?.provider.releaseImage?.(entry.borrowed.bitmap);
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

  /** The mean colour of one pixel row of the image. */
  private extractRowColor(
    bitmap: ImageBitmap,
    row: number,
  ): [number, number, number, number] | undefined {
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

    ctx.drawImage(bitmap, 0, row, bitmap.width, 1, 0, 0, bitmap.width, 1);
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
    this.disposed = true;
    for (const entry of this.cache.values()) this.release(entry);
    this.cache.clear();
  }
}
