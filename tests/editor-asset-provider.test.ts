import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditorAssetProvider } from "../src/editor/asset-provider";
import type { AssetProvider } from "../src/engine/Engine";
import { TextureManager } from "../src/engine/textures/TextureManager";
import { getBlob } from "../src/storage/blobs";

// Every asset is a 1440 × 4000 page. A decode at 1024 px is 1024 × 2844, and the top 0.75 of a
// width (textureRows) keeps 768 of its rows.
const blobs = vi.hoisted(() => ({
  sizes: new WeakMap<Blob, [number, number]>(),
  /** While set, stored blobs are read only once it resolves. */
  hold: null as Promise<void> | null,
}));

vi.mock("../src/storage/blobs", () => ({
  getBlob: vi.fn(async () => {
    const hold = blobs.hold;
    if (hold) await hold;
    const blob = new Blob(["page"]);
    blobs.sizes.set(blob, [1440, 4000]);
    return blob;
  }),
}));

type FakeBitmap = ImageBitmap & { close: ReturnType<typeof vi.fn> };

function fakeBitmap(width: number, height: number): FakeBitmap {
  return { width, height, close: vi.fn() } as unknown as FakeBitmap;
}

/** Decodes blobs at their size or resized; crops bitmaps. Node has no createImageBitmap. */
function stubDecoding() {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async (source: Blob | ImageBitmap, ...args: unknown[]) => {
      if (source instanceof Blob) {
        const options = args[0] as ImageBitmapOptions | undefined;
        const [width, height] = blobs.sizes.get(source)!;
        return fakeBitmap(options?.resizeWidth ?? width, options?.resizeHeight ?? height);
      }
      const [, , width, height] = args as number[];
      return fakeBitmap(width, height);
    }),
  );
}

/** The editor provider, recording every bitmap it lends. */
function editorProvider() {
  const inner = createEditorAssetProvider();
  const lent: FakeBitmap[] = [];
  const provider: AssetProvider = {
    ...inner,
    getImage: async (assetId, maxWidth, rows) => {
      const bitmap = (await inner.getImage(assetId, maxWidth, rows)) as FakeBitmap;
      lent.push(bitmap);
      return bitmap;
    },
  };
  return { provider, lent };
}

function shownBitmap(texture: { strips: { texture: { image: unknown } }[] } | null): FakeBitmap {
  return texture!.strips[0].texture.image as FakeBitmap;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the editor provider lends decodes the engine hands back (follow-up #125)", () => {
  beforeEach(() => {
    stubDecoding();
    blobs.hold = null;
    vi.mocked(getBlob).mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("closes the decode of a screenshot the document drops, and every decode when the engine goes", async () => {
    const tm = new TextureManager(4096, 1);
    const { provider, lent } = editorProvider();
    const kept = shownBitmap(await tm.getTexture("kept", 1024, provider, 0.75));
    const dropped = shownBitmap(await tm.getTexture("dropped", 1024, provider, 0.75));
    expect([dropped.width, dropped.height]).toEqual([1024, 768]);

    tm.retainOnly(["kept"]);
    expect(dropped.close).toHaveBeenCalledTimes(1);
    expect(kept.close).not.toHaveBeenCalled();

    // A load that lands after its engine went away gives its decode back too.
    let land!: () => void;
    blobs.hold = new Promise((resolve) => (land = resolve));
    const loading = tm.getTexture("late", 1024, provider, 0.75);
    await settle();
    tm.dispose();
    expect(kept.close).toHaveBeenCalledTimes(1);
    land();
    expect(await loading).toBeNull();
    expect(lent[2].close).toHaveBeenCalledTimes(1);
  });

  it("closes a page's decode as soon as the engine has cut it into strips", async () => {
    // A 2048 texture limit cuts a whole 1024 × 2844 page into two strips, which are copies.
    const tm = new TextureManager(2048, 1);
    const { provider, lent } = editorProvider();
    const page = await tm.getTexture("page", 1024, provider, null);
    expect(page?.strips.length).toBe(2);
    expect(lent[0].close).toHaveBeenCalledTimes(1);
    const strips = page!.strips.map((strip) => strip.texture.image as FakeBitmap);
    expect(strips.map((strip) => strip.close.mock.calls.length)).toEqual([0, 0]);
    tm.dispose();
  });

  it("closes a decode a wider one replaced once no texture shows it, never before", async () => {
    const tm = new TextureManager(4096, 1);
    const { provider } = editorProvider();
    const narrow = shownBitmap(await tm.getTexture("page", 1024, provider, 0.75));

    // The stage grew: a wider decode is on its way, and until it lands the texture shows the
    // narrow one, which a WebGL context restore would upload again.
    let land!: () => void;
    blobs.hold = new Promise((resolve) => (land = resolve));
    const loading = tm.getTexture("page", 2048, provider, 0.75);
    await settle();
    expect(tm.getLoadedTexture("page")?.strips[0].texture.image).toBe(narrow);
    expect(narrow.close).not.toHaveBeenCalled();

    land();
    const wider = shownBitmap(await loading);
    expect([wider.width, wider.height]).toEqual([1440, 1088]);
    expect(narrow.close).toHaveBeenCalledTimes(1);
    expect(wider.close).not.toHaveBeenCalled();

    tm.dispose();
    expect(wider.close).toHaveBeenCalledTimes(1);
  });

  it("keeps a decode open while anyone still holds it", async () => {
    const { provider } = editorProvider();
    // An export borrows the decode for a copy and never hands it back; a preview engine then
    // shows the same decode and lets it go.
    const exportCopy = await provider.getImage("page", 1024, 0.75);
    const tm = new TextureManager(4096, 1);
    const shown = shownBitmap(await tm.getTexture("page", 1024, provider, 0.75));
    expect(shown).toBe(exportCopy);

    tm.dispose();
    expect(shown.close).not.toHaveBeenCalled();
  });

  it("shares one decode between requests at the same size, also while it decodes", async () => {
    const { provider } = editorProvider();
    const [first, second] = await Promise.all([
      provider.getImage("page", 1024, 0.75),
      provider.getImage("page", 1024, 0.75),
    ]);
    // Fewer rows are in the same decode.
    const third = await provider.getImage("page", 1024, 0.5);
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(getBlob).toHaveBeenCalledTimes(1);

    provider.releaseImage?.(first);
    provider.releaseImage?.(second);
    expect((first as FakeBitmap).close).not.toHaveBeenCalled();
    provider.releaseImage?.(third);
    expect((first as FakeBitmap).close).toHaveBeenCalledTimes(1);
  });
});
