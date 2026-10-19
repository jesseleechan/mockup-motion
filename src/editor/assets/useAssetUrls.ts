import { useEffect, useRef, useState } from "react";
import { DEMO_ASSETS } from "../../lab/demo-assets";
import { getBlob } from "../../storage/blobs";

/** Where an asset's image comes from: a URL the page can load as is, or a stored blob. */
export type AssetUrlSource = { kind: "url"; url: string } | { kind: "blob" };

/** Demo captures and URL ids load as they are; uploads live in IndexedDB as blobs. */
export function assetUrlSource(id: string): AssetUrlSource {
  const demo = DEMO_ASSETS.get(id);
  if (demo) return { kind: "url", url: demo.url };
  if (/^(\/|https?:|blob:|data:)/.test(id)) return { kind: "url", url: id };
  return { kind: "blob" };
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

/**
 * Image URLs for a changing set of asset ids. A stored blob gets an object URL the first time
 * its id is asked for, kept while the id stays in the set and revoked when it leaves or the
 * cache is disposed. An id whose blob is missing has no URL (the caller shows a placeholder).
 */
export class AssetUrlCache {
  private readonly urls = new Map<string, string>();
  /** Object URLs this cache created, which it must revoke. */
  private readonly owned = new Set<string>();
  private wanted = new Set<string>();
  private disposed = false;

  constructor(
    private readonly onChange: () => void,
    private readonly deps: AssetUrlCacheDeps = browserDeps,
  ) {}

  get(id: string): string | undefined {
    return this.urls.get(id);
  }

  /** Every URL the cache holds now, by asset id. */
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.urls);
  }

  /** Makes the cache hold exactly these ids. Resolves once every new blob has been read. */
  async sync(ids: readonly string[]): Promise<void> {
    this.wanted = new Set(ids);
    let changed = false;
    for (const [id, url] of this.urls) {
      if (this.wanted.has(id)) continue;
      this.forget(id, url);
      changed = true;
    }

    const pending: Promise<void>[] = [];
    for (const id of this.wanted) {
      if (this.urls.has(id)) continue;
      const source = assetUrlSource(id);
      if (source.kind === "url") {
        this.urls.set(id, source.url);
        changed = true;
      } else {
        pending.push(this.loadBlob(id));
      }
    }
    if (changed) this.onChange();
    await Promise.all(pending);
  }

  dispose(): void {
    this.disposed = true;
    for (const [id, url] of this.urls) this.forget(id, url);
  }

  private async loadBlob(id: string): Promise<void> {
    const blob = await this.deps.getBlob(id);
    // The id may have left, or another sync may have loaded it, while the blob was read.
    if (!blob || this.disposed || !this.wanted.has(id) || this.urls.has(id)) return;
    const url = this.deps.createObjectURL(blob);
    this.owned.add(url);
    this.urls.set(id, url);
    this.onChange();
  }

  private forget(id: string, url: string): void {
    this.urls.delete(id);
    if (this.owned.delete(url)) this.deps.revokeObjectURL(url);
  }
}

function splitKey(key: string): string[] {
  return key === "" ? [] : key.split("\n");
}

/**
 * Image URLs for the given asset ids, for thumbnails in the editor UI: the Media tab and the
 * Shot inspector's screenshot list. Object URLs are created lazily and revoked when an asset
 * leaves the list or the component unmounts. An id has no entry until its image is ready.
 */
export function useAssetUrls(ids: readonly string[]): Readonly<Record<string, string>> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const cacheRef = useRef<AssetUrlCache | null>(null);
  // A stable key, so a new array with the same ids doesn't sync again.
  const key = ids.join("\n");

  useEffect(() => {
    const cache = new AssetUrlCache(() => setUrls(cache.snapshot()));
    cacheRef.current = cache;
    return () => {
      cache.dispose();
      cacheRef.current = null;
    };
  }, []);

  useEffect(() => {
    cacheRef.current?.sync(splitKey(key)).catch((err: unknown) => {
      console.error("[useAssetUrls] failed to load a screenshot", err);
    });
  }, [key]);

  return urls;
}
