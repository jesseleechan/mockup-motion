import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDoc, defaultShot } from "../src/doc/defaults";
import type { ExportSettings } from "../src/doc/types";
import type { AssetProvider, TextRaster } from "../src/engine/Engine";
import { exportWithEngine, liveExportWorkers } from "../src/export/engine-export";
import type { StartMessage } from "../src/export/video-encode";

// Node has no Worker, OffscreenCanvas or createImageBitmap. These stand-ins follow the browser
// where it matters here: a transferred or closed bitmap is detached, and posting or copying a
// detached one throws.

class FakeBitmap {
  transferred = false;
  closed = false;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}
  get detached(): boolean {
    return this.transferred || this.closed;
  }
  close(): void {
    this.closed = true;
  }
}

/** What each export posted to its worker: the bitmaps sent, and whether each was live. */
interface Post {
  sent: FakeBitmap[];
  liveWhenSent: boolean[];
  texts: StartMessage["texts"];
}

let posts: Post[] = [];
let copies: FakeBitmap[] = [];
let refusePosts = false;

class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  postMessage(message: StartMessage, transfer: FakeBitmap[]): void {
    const sent = [
      ...Object.values(message.images),
      ...Object.values(message.texts).map((t) => t.bitmap),
    ] as unknown as FakeBitmap[];
    const liveWhenSent = sent.map((bitmap) => !bitmap.detached);
    posts.push({ sent, liveWhenSent, texts: message.texts });
    // Structured clone: a detached bitmap can't be sent, and a failed post transfers nothing.
    if (refusePosts || liveWhenSent.includes(false)) {
      throw new DOMException(
        "Failed to execute 'postMessage' on 'Worker': An ImageBitmap is detached and could not be cloned.",
        "DataCloneError",
      );
    }
    for (const bitmap of transfer) bitmap.transferred = true;
    queueMicrotask(() =>
      this.onmessage?.({
        data: {
          type: "done",
          blob: new Blob(["webm"], { type: "video/webm" }),
          mime: "video/webm",
        },
      }),
    );
  }

  terminate(): void {}
}

async function fakeCreateImageBitmap(source: FakeBitmap, ...crop: unknown[]): Promise<FakeBitmap> {
  if (source.detached) throw new DOMException("The image source is detached.", "InvalidStateError");
  const [, , sw, sh] = crop;
  const copy =
    typeof sw === "number" && typeof sh === "number"
      ? new FakeBitmap(sw, sh)
      : new FakeBitmap(source.width, source.height);
  copies.push(copy);
  return copy;
}

/**
 * Hands out one bitmap per image and one raster per text line and size, and keeps them, as the
 * editor's and lab's providers do (rasterizeText caches text rasters for the whole page).
 */
function cachingProvider() {
  const handedOut = new Set<FakeBitmap>();
  const images = new Map<string, FakeBitmap>();
  const texts = new Map<string, TextRaster>();
  const provider: AssetProvider = {
    async getImage(assetId, maxWidth) {
      const key = `${assetId}:${maxWidth}`;
      const bitmap = images.get(key) ?? new FakeBitmap(maxWidth, Math.round(maxWidth * 0.6));
      images.set(key, bitmap);
      handedOut.add(bitmap);
      return bitmap as unknown as ImageBitmap;
    },
    async getText(line, frameHeightPx) {
      const key = `${line.id}:${frameHeightPx}`;
      const bitmap = new FakeBitmap(180, 24);
      const raster = texts.get(key) ?? {
        bitmap: bitmap as unknown as ImageBitmap,
        width: bitmap.width,
        height: bitmap.height,
        color: line.color,
      };
      texts.set(key, raster);
      handedOut.add(raster.bitmap as unknown as FakeBitmap);
      return raster;
    },
  };
  return { provider, handedOut, texts };
}

const WEBM_360: ExportSettings = {
  destination: "web-embed",
  resolution: 360,
  fps: 24,
  quality: "web",
  format: "webm",
  supersample: 1,
};

// A browser with a URL pill: the export sends the worker a screenshot and a text raster.
const doc = createDoc({
  shots: [defaultShot({ kind: "single", device: "browser", assetId: "asset-1" })],
  style: { ...createDoc().style, browserUrl: "aurelia.studio" },
});

beforeEach(() => {
  posts = [];
  copies = [];
  refusePosts = false;
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("OffscreenCanvas", class {});
  vi.stubGlobal("createImageBitmap", vi.fn(fakeCreateImageBitmap));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("exportWithEngine's worker bitmaps", () => {
  it("are copies, so two exports with one provider both send live bitmaps", async () => {
    const { provider, handedOut, texts } = cachingProvider();

    await exportWithEngine(doc, provider, WEBM_360);
    await exportWithEngine(doc, provider, WEBM_360);

    expect(posts).toHaveLength(2);
    const [pill] = [...texts.values()];
    for (const post of posts) {
      // The screenshot and the pill's raster.
      expect(post.sent).toHaveLength(2);
      expect(post.liveWhenSent).toEqual([true, true]);
      expect(post.sent.filter((bitmap) => handedOut.has(bitmap))).toEqual([]);
      const [text] = Object.values(post.texts);
      expect(text).toMatchObject({ width: pill.width, height: pill.height, color: pill.color });
      expect(text.bitmap).toMatchObject({ width: pill.width, height: pill.height });
    }
    expect([...handedOut].filter((bitmap) => bitmap.detached)).toEqual([]);
  });

  it("are closed when the post fails, and the worker is stopped", async () => {
    const { provider, handedOut } = cachingProvider();
    const workersBefore = liveExportWorkers();
    refusePosts = true;

    await expect(exportWithEngine(doc, provider, WEBM_360)).rejects.toMatchObject({
      name: "DataCloneError",
    });

    expect(liveExportWorkers()).toBe(workersBefore);
    expect(copies.length).toBeGreaterThan(0);
    expect(copies.filter((bitmap) => !bitmap.closed)).toEqual([]);
    expect([...handedOut].filter((bitmap) => bitmap.detached)).toEqual([]);
  });
});
