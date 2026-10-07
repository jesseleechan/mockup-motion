import * as THREE from "three";
import type { TextRaster } from "../Engine";

export interface ChromeUrlText {
  texture: THREE.Texture;
  raster: TextRaster;
  /** Glyph size of the raster in px, to scale it to the toolbar. */
  fontPx: number;
}

/** GPU textures for the browser URL pill rasters, keyed by `chromeUrlKey`. */
export class ChromeUrlTextures {
  private entries = new Map<string, ChromeUrlText>();

  set(key: string, raster: TextRaster, fontPx: number): void {
    const existing = this.entries.get(key);
    if (existing && existing.raster === raster) {
      existing.fontPx = fontPx;
      return;
    }
    existing?.texture.dispose();
    const texture = new THREE.Texture(raster.bitmap);
    // Only alpha (coverage) is sampled; the colour comes from raster.color.
    texture.colorSpace = THREE.NoColorSpace;
    texture.flipY = false;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    this.entries.set(key, { texture, raster, fontPx });
  }

  /** Swaps in a document's rasters and disposes the textures it no longer uses. */
  replaceAll(loaded: ReadonlyMap<string, { raster: TextRaster; fontPx: number }>): void {
    for (const [key, { raster, fontPx }] of loaded) this.set(key, raster, fontPx);
    this.retainOnly(loaded.keys());
  }

  get(key: string): ChromeUrlText | null {
    return this.entries.get(key) ?? null;
  }

  /** Disposes textures whose key is not in `keys`. */
  retainOnly(keys: Iterable<string>): void {
    const keep = new Set(keys);
    for (const [key, entry] of this.entries) {
      if (keep.has(key)) continue;
      entry.texture.dispose();
      this.entries.delete(key);
    }
  }

  dispose(): void {
    for (const entry of this.entries.values()) entry.texture.dispose();
    this.entries.clear();
  }
}
