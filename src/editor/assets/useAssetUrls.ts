import { useEffect, useState } from "react";
import type { AssetRef } from "../../doc/types";
import { getBlob } from "../../storage/blobs";

/** Demo and remote assets are their own URL; uploads live in IndexedDB as blobs. */
function isUrlId(id: string): boolean {
  return (
    id.startsWith("/") || id.startsWith("http") || id.startsWith("blob:") || id.startsWith("data:")
  );
}

/**
 * Image URLs for the given assets, keyed by asset id, for thumbnails in the editor UI. Blob URLs
 * are revoked when the asset list changes or the component unmounts.
 */
export function useAssetUrls(assets: AssetRef[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  // The id list is the dependency, so an unrelated asset edit (a rename) keeps the URLs.
  const key = assets.map((a) => a.id).join("\n");

  useEffect(() => {
    let active = true;
    const created: string[] = [];

    async function load() {
      const next: Record<string, string> = {};
      for (const id of key ? key.split("\n") : []) {
        if (isUrlId(id)) {
          next[id] = id;
          continue;
        }
        const blob = await getBlob(id);
        if (!active) return;
        if (blob) {
          const url = URL.createObjectURL(blob);
          created.push(url);
          next[id] = url;
        }
      }
      if (active) setUrls(next);
    }

    load().catch((error: unknown) => {
      console.error("Couldn't load screenshot thumbnails:", error);
    });

    return () => {
      active = false;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, [key]);

  return urls;
}
