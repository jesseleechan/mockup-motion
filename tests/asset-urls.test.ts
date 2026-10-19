import { describe, expect, it } from "vitest";
import {
  AssetUrlCache,
  assetUrlSource,
  type AssetUrlCacheDeps,
} from "../src/editor/assets/useAssetUrls";
import { DEMO_ASSETS } from "../src/lab/demo-assets";

function fakeDeps(blobs: Record<string, string>) {
  let next = 0;
  const revoked: string[] = [];
  const reads: string[] = [];
  const deps: AssetUrlCacheDeps = {
    getBlob: async (id) => {
      reads.push(id);
      return id in blobs ? new Blob([blobs[id]]) : null;
    },
    createObjectURL: () => `blob:test/${++next}`,
    revokeObjectURL: (url) => revoked.push(url),
  };
  return { deps, revoked, reads };
}

describe("Asset URLs for editor thumbnails", () => {
  it("loads demo captures and URL ids as they are, and uploads from stored blobs", () => {
    const [demoId, demo] = [...DEMO_ASSETS][0];
    expect(assetUrlSource(demoId)).toEqual({ kind: "url", url: demo.url });
    expect(assetUrlSource("/demo/aurelia/desktop-hero.webp").kind).toBe("url");
    expect(assetUrlSource("data:image/png;base64,AA==").kind).toBe("url");
    expect(assetUrlSource("3f2c9e4a-upload")).toEqual({ kind: "blob" });
  });

  it("creates an object URL once per stored asset and revokes it when the asset leaves", async () => {
    const { deps, revoked, reads } = fakeDeps({ home: "a", about: "b" });
    let changes = 0;
    const cache = new AssetUrlCache(() => changes++, deps);
    const demoId = [...DEMO_ASSETS.keys()][0];

    await cache.sync(["home", "about", demoId]);
    expect(cache.snapshot()).toEqual({
      home: "blob:test/1",
      about: "blob:test/2",
      [demoId]: DEMO_ASSETS.get(demoId)?.url,
    });
    expect(changes).toBeGreaterThan(0);

    // Syncing the same ids again reads nothing.
    await cache.sync(["home", "about", demoId]);
    expect(reads).toEqual(["home", "about"]);

    await cache.sync(["home"]);
    expect(revoked).toEqual(["blob:test/2"]);
    expect(cache.snapshot()).toEqual({ home: "blob:test/1" });

    cache.dispose();
    expect(revoked).toEqual(["blob:test/2", "blob:test/1"]);
    expect(cache.snapshot()).toEqual({});
  });

  it("gives a missing blob no URL, and never keeps a URL for an id removed while loading", async () => {
    const { deps, revoked } = fakeDeps({ home: "a" });
    const cache = new AssetUrlCache(() => {}, deps);
    const loading = cache.sync(["home", "gone"]);
    await cache.sync([]);
    await loading;
    expect(cache.snapshot()).toEqual({});
    expect(revoked).toEqual([]);
  });
});
