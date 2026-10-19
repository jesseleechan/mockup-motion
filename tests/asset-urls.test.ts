import { describe, expect, it } from "vitest";
import {
  AssetUrlCache,
  assetVersion,
  fallbackUrl,
  type AssetUrlCacheDeps,
} from "../src/editor/assets/useAssetUrls";
import type { AssetRef } from "../src/doc/types";
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
  return { deps, revoked, reads, blobs };
}

const v = (id: string, version = "1") => ({ id, version });
const [demoId, demo] = [...DEMO_ASSETS][0];

describe("Asset URLs for editor thumbnails", () => {
  it("falls back to a demo capture's file or a URL id when nothing is stored", () => {
    expect(fallbackUrl(demoId)).toBe(demo.url);
    expect(fallbackUrl("/demo/aurelia/desktop-hero.webp")).toBe("/demo/aurelia/desktop-hero.webp");
    expect(fallbackUrl("3f2c9e4a-upload")).toBeUndefined();
  });

  it("changes an asset's version when its file is replaced", () => {
    const asset: AssetRef = {
      id: "home",
      kind: "image",
      name: "home.png",
      mime: "image/png",
      bytes: 1000,
      width: 1440,
      height: 900,
    };
    expect(assetVersion({ ...asset })).toBe(assetVersion(asset));
    expect(assetVersion({ ...asset, name: "home-v2.png", bytes: 1200 })).not.toBe(
      assetVersion(asset),
    );
  });

  it("creates an object URL once per stored asset and revokes it when the asset leaves", async () => {
    const { deps, revoked, reads } = fakeDeps({ home: "a", about: "b" });
    const cache = new AssetUrlCache(() => {}, deps);

    await cache.sync([v("home"), v("about"), v(demoId)]);
    expect(cache.snapshot()).toEqual({
      home: "blob:test/1",
      about: "blob:test/2",
      [demoId]: demo.url,
    });

    // The same assets again: nothing is read.
    await cache.sync([v("home"), v("about"), v(demoId)]);
    expect(reads).toEqual(["home", "about", demoId]);

    await cache.sync([v("home")]);
    expect(revoked).toEqual(["blob:test/2"]);
    expect(cache.snapshot()).toEqual({ home: "blob:test/1" });

    cache.dispose();
    expect(revoked).toEqual(["blob:test/2", "blob:test/1"]);
    expect(cache.snapshot()).toEqual({});
  });

  it("reads a replaced file again: a new URL, and the old one revoked", async () => {
    const { deps, revoked, blobs } = fakeDeps({ home: "old" });
    const cache = new AssetUrlCache(() => {}, deps);
    await cache.sync([v("home", "1")]);
    expect(cache.snapshot()).toEqual({ home: "blob:test/1" });

    blobs.home = "new";
    await cache.sync([v("home", "2")]);
    expect(cache.snapshot()).toEqual({ home: "blob:test/2" });
    expect(revoked).toEqual(["blob:test/1"]);
  });

  it("shows a stored file before the demo capture, as the engine does", async () => {
    const { deps } = fakeDeps({ [demoId]: "replaced" });
    const cache = new AssetUrlCache(() => {}, deps);
    await cache.sync([v(demoId)]);
    expect(cache.snapshot()).toEqual({ [demoId]: "blob:test/1" });
  });

  it("gives a missing blob no URL, and keeps none for an asset removed while loading", async () => {
    const { deps, revoked } = fakeDeps({ home: "a" });
    const cache = new AssetUrlCache(() => {}, deps);
    const loading = cache.sync([v("home"), v("gone")]);
    await cache.sync([]);
    await loading;
    expect(cache.snapshot()).toEqual({});
    expect(revoked).toEqual([]);
  });

  it("creates no URL for a read that finishes after the cache is disposed", async () => {
    const { deps } = fakeDeps({ home: "a" });
    let created = 0;
    const cache = new AssetUrlCache(() => {}, {
      ...deps,
      createObjectURL: (blob) => {
        created++;
        return deps.createObjectURL(blob);
      },
    });
    const loading = cache.sync([v("home")]);
    cache.dispose();
    await loading;
    expect(created).toBe(0);
    expect(cache.snapshot()).toEqual({});
  });
});
