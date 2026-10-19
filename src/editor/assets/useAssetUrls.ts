import { useEffect, useMemo, useRef, useState } from "react";
import type { AssetRef } from "../../doc/types";
import { DEMO_ASSETS } from "../../lab/demo-assets";
import { getBlob } from "../../storage/blobs";

/**
 * The URL of an asset with no stored blob: a demo capture's public file, or an id that is a URL
 * itself. Stored blobs come first, as in the engine's asset provider (`asset-provider.ts`), so a
 * replaced demo screenshot shows its new file.
 */
export function fallbackUrl(id: string): string | undefined {
  const demo = DEMO_ASSETS.get(id);
  if (demo) return demo.url;
  return /^(\/|https?:|blob:|data:)/.test(id) ? id : undefined;
}

/**
 * Changes whenever the asset's file does: "Replace file…" keeps the id but writes a new blob and
 * a new name, size and image size.
 */
export function assetVersion(asset: AssetRef): string {
  return [asset.name, asset.bytes, asset.mime, asset.width, asset.height].join("|");
}

export interface AssetUrlCacheDeps {
  getBlob: (id: string) => Promise<Blob | null>;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
}

const browserDeps: AssetUrlCacheDeps = {
  getBlob,
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
};

/** An asset the cache should hold, at the version of its file. */
export interface AssetUrlEntry {
  id: string;
  version: string;
}

/**
 * Image URLs for a changing set of assets. Each asset's image is read the first time it is
 * asked for, and again when its version changes. Object URLs the cache created are revoked when
 * the asset leaves the set, its version changes or the cache is disposed. An asset with neither
 * a stored blob nor a fallback URL has no URL (the caller shows a placeholder).
 */
export class AssetUrlCache {
  private readonly urls = new Map<string, { version: string; url: string }>();
  /** Object URLs this cache created, which it must revoke. */
  private readonly owned = new Set<string>();
  /** Asset id → the version the caller wants. */
  private wanted = new Map<string, string>();
  private disposed = false;

  constructor(
    private readonly onChange: () => void,
    private readonly deps: AssetUrlCacheDeps = browserDeps,
  ) {}

  /** Every URL the cache holds now, by asset id. */
  snapshot(): Record<string, string> {
    return Object.fromEntries([...this.urls].map(([id, entry]) => [id, entry.url]));
  }

  /** Makes the cache hold exactly these assets. Resolves once every new image has been read. */
  async sync(entries: readonly AssetUrlEntry[]): Promise<void> {
    this.wanted = new Map(entries.map((entry) => [entry.id, entry.version]));
    let changed = false;
    for (const [id, entry] of this.urls) {
      if (this.wanted.get(id) === entry.version) continue;
      this.forget(id);
      changed = true;
    }
    if (changed) this.onChange();

    const pending: Promise<void>[] = [];
    for (const [id, version] of this.wanted) {
      if (!this.urls.has(id)) pending.push(this.load(id, version));
    }
    await Promise.all(pending);
  }

  dispose(): void {
    this.disposed = true;
    for (const id of [...this.urls.keys()]) this.forget(id);
  }

  private async load(id: string, version: string): Promise<void> {
    const blob = await this.deps.getBlob(id);
    // The cache may be gone, the asset may have left or changed, or another sync may have
    // loaded it, while the blob was read.
    if (this.disposed || this.wanted.get(id) !== version || this.urls.has(id)) return;
    let url: string | undefined;
    if (blob) {
      url = this.deps.createObjectURL(blob);
      this.owned.add(url);
    } else {
      url = fallbackUrl(id);
    }
    if (!url) return;
    this.urls.set(id, { version, url });
    this.onChange();
  }

  private forget(id: string): void {
    const entry = this.urls.get(id);
    if (!entry) return;
    this.urls.delete(id);
    if (this.owned.delete(entry.url)) this.deps.revokeObjectURL(entry.url);
  }
}

/**
 * Image URLs for the given assets, by id, for thumbnails in the editor UI: the Media tab and the
 * Shot inspector's screenshot list. Images are read lazily, read again when an asset's file is
 * replaced, and their object URLs revoked when the asset leaves the list or the component
 * unmounts. An asset has no entry until its image is ready.
 */
export function useAssetUrls(assets: readonly AssetRef[]): Readonly<Record<string, string>> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const cacheRef = useRef<AssetUrlCache | null>(null);
  // A stable key, so a new array of the same files doesn't sync again.
  const key = JSON.stringify(assets.map((asset) => [asset.id, assetVersion(asset)]));
  const entries = useMemo(
    () => (JSON.parse(key) as [string, string][]).map(([id, version]) => ({ id, version })),
    [key],
  );

  useEffect(() => {
    const cache = new AssetUrlCache(() => setUrls(cache.snapshot()));
    cacheRef.current = cache;
    return () => {
      cache.dispose();
      cacheRef.current = null;
    };
  }, []);

  useEffect(() => {
    cacheRef.current?.sync(entries).catch((err: unknown) => {
      console.error("[useAssetUrls] failed to load a screenshot", err);
    });
  }, [entries]);

  return urls;
}
