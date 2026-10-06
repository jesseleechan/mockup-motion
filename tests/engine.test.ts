import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createDoc } from "../src/doc/defaults";
import { BackgroundRenderer } from "../src/engine/background/BackgroundRenderer";
import { buildCardDevice } from "../src/engine/devices/DeviceBuilder";
import type { AssetProvider } from "../src/engine/Engine";
import { ScreenCompositor } from "../src/engine/materials/screen";
import { applyCameraPose, computeFitDistance } from "../src/engine/stage";
import { TextureManager } from "../src/engine/textures/TextureManager";
import type { LayoutNode } from "../src/motion";

describe("Stage & Camera (src/engine/stage.ts)", () => {
  it("computes fit distance d_fit = 0.5 / tan(fov/2)", () => {
    const dFit22 = computeFitDistance(22);
    // tan(11 deg) ≈ 0.19438 -> 0.5 / 0.19438 ≈ 2.572
    expect(dFit22).toBeCloseTo(2.572, 2);
  });

  it("applyCameraPose positions and orients PerspectiveCamera per contracts.md §3", () => {
    const camera = new THREE.PerspectiveCamera();
    applyCameraPose(
      camera,
      {
        fov: 22,
        distance: 1.0,
        yaw: 0,
        pitch: 0,
        roll: 0,
        panX: 0,
        panY: 0,
      },
      16 / 9,
    );

    const dFit = computeFitDistance(22);
    expect(camera.position.z).toBeCloseTo(dFit, 2);
    expect(camera.position.x).toBeCloseTo(0);
    expect(camera.position.y).toBeCloseTo(0);

    // With yaw 90 degrees (+ moves camera right)
    applyCameraPose(
      camera,
      {
        fov: 22,
        distance: 1.0,
        yaw: 90,
        pitch: 0,
        roll: 0,
        panX: 0,
        panY: 0,
      },
      16 / 9,
    );
    expect(camera.position.x).toBeCloseTo(dFit, 2);
    expect(camera.position.z).toBeCloseTo(0, 2);
  });
});

describe("F01 image orientation", () => {
  it("TextureManager textures use the top-left image convention", () => {
    const manager = new TextureManager();
    const createTexture = Reflect.get(manager, "createTexture") as (
      source: ImageBitmap,
    ) => THREE.Texture;
    const texture = createTexture.call(manager, {} as ImageBitmap);
    expect(texture.flipY).toBe(false);
    texture.dispose();
  });

  it("shared top-left quad maps its top edge to v=0", async () => {
    const { createTopLeftQuad } = await import("../src/engine/geometry/quads");
    const geometry = createTopLeftQuad();
    const positions = geometry.attributes.position;
    const uvs = geometry.attributes.uv;
    for (let i = 0; i < positions.count; i++) {
      expect(uvs.getY(i)).toBe(positions.getY(i) > 0 ? 0 : 1);
    }
  });
});

describe("TextureManager (src/engine/textures/TextureManager.ts)", () => {
  // Node has no createImageBitmap; record each slice so ownership can be checked.
  function mockBitmap(width: number, height: number) {
    return { width, height, close: vi.fn() } as unknown as ImageBitmap & {
      close: ReturnType<typeof vi.fn>;
    };
  }
  function provider(sizes: Record<string, [number, number]>) {
    const calls: { id: string; maxWidth: number }[] = [];
    const bitmaps: ReturnType<typeof mockBitmap>[] = [];
    const assets: AssetProvider = {
      getImage: async (id, maxWidth) => {
        calls.push({ id, maxWidth });
        const [w, h] = sizes[id];
        const scale = Math.min(1, maxWidth / w);
        const bitmap = mockBitmap(Math.round(w * scale), Math.round(h * scale));
        bitmaps.push(bitmap);
        return bitmap;
      },
      getText: async () => {
        throw new Error("Not implemented");
      },
    };
    return { assets, calls, bitmaps };
  }
  function stubSlicing() {
    const slices: { args: number[]; bitmap: ReturnType<typeof mockBitmap> }[] = [];
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async (_source: ImageBitmap, x: number, y: number, w: number, h: number) => {
        const bitmap = mockBitmap(w, h);
        slices.push({ args: [x, y, w, h], bitmap });
        return bitmap;
      }),
    );
    return slices;
  }

  it("caches textures and splits tall images into vertical strips", async () => {
    const slices = stubSlicing();
    const tm = new TextureManager(2048, 4);
    const { assets } = provider({ "tall-asset-1": [1000, 5000] });

    const managed = await tm.getTexture("tall-asset-1", 1000, assets);
    expect(managed).toBeDefined();
    expect(managed?.strips.length).toBe(3); // 5000 / 2048 = 3 strips (2048, 2048, 904)
    expect(managed?.strips[0].height).toBe(2048);
    expect(managed?.strips[1].height).toBe(2048);
    expect(managed?.strips[2].height).toBe(904);
    expect(slices.map((slice) => slice.args)).toEqual([
      [0, 0, 1000, 2048],
      [0, 2048, 1000, 2048],
      [0, 4096, 1000, 904],
    ]);
    expect(managed?.strips.map((strip) => strip.texture.image)).toEqual(
      slices.map((slice) => slice.bitmap),
    );

    // Second call retrieves from cache
    const cached = await tm.getTexture("tall-asset-1", 1000, assets);
    expect(cached).toBe(managed);

    tm.dispose();
    vi.unstubAllGlobals();
  });

  it("reuses a wider entry, replaces a narrower one, and dedupes concurrent loads", async () => {
    const tm = new TextureManager(4096, 1);
    const { assets, calls } = provider({ a: [3000, 2000] });

    const [first, second] = await Promise.all([
      tm.getTexture("a", 1024, assets),
      tm.getTexture("a", 1024, assets),
    ]);
    expect(first).toBe(second);
    expect(calls).toEqual([{ id: "a", maxWidth: 1024 }]);

    expect(await tm.getTexture("a", 768, assets)).toBe(first);
    expect(calls.length).toBe(1);

    const wider = await tm.getTexture("a", 2048, assets);
    expect(wider?.width).toBe(2048);
    expect(tm.getLoadedTexture("a")).toBe(wider);
    tm.dispose();
  });

  it("retainOnly disposes released assets and closes only the strips it sliced", async () => {
    const slices = stubSlicing();
    const tm = new TextureManager(2048, 1);
    const { assets, bitmaps } = provider({ short: [1000, 800], tall: [1000, 5000] });
    const short = await tm.getTexture("short", 1000, assets);
    const tall = await tm.getTexture("tall", 1000, assets);
    const disposed: string[] = [];
    short?.strips[0].texture.addEventListener("dispose", () => disposed.push("short"));
    tall?.strips.forEach((strip) =>
      strip.texture.addEventListener("dispose", () => disposed.push("tall")),
    );

    tm.retainOnly(["short"]);
    expect(disposed).toEqual(["tall", "tall", "tall"]);
    expect(tm.getLoadedTexture("tall")).toBeNull();
    expect(tm.getLoadedTexture("short")).toBe(short);
    expect(slices.every((slice) => slice.bitmap.close.mock.calls.length === 1)).toBe(true);
    // Provider bitmaps belong to the provider and stay open.
    expect(bitmaps.every((bitmap) => bitmap.close.mock.calls.length === 0)).toBe(true);

    tm.dispose();
    expect(disposed).toEqual(["tall", "tall", "tall", "short"]);
    vi.unstubAllGlobals();
  });
});

describe("ScreenCompositor & Device (src/engine/materials/screen.ts)", () => {
  it("creates ScreenCompositor with rounded-rect ShaderMaterial and resizes correctly", () => {
    const comp = new ScreenCompositor({
      viewportWidthPx: 800,
      viewportHeightPx: 600,
      cornerRadius: 0.015,
      meshWidth: 0.8,
      meshHeight: 0.6,
    });

    expect(comp.renderTarget.width).toBe(800);
    expect(comp.renderTarget.height).toBe(600);
    expect(comp.material).toBeDefined();

    comp.resize(1000, 750, 1.0, 0.75);
    expect(comp.renderTarget.width).toBe(1000);
    expect(comp.renderTarget.height).toBe(750);

    comp.dispose();
  });

  it("keeps shared quad alive until the last compositor disposes, then releases it once", async () => {
    const { createTopLeftQuad } = await import("../src/engine/geometry/quads");
    const first = new ScreenCompositor({
      viewportWidthPx: 320,
      viewportHeightPx: 240,
      cornerRadius: 0.015,
      meshWidth: 0.8,
      meshHeight: 0.6,
    });
    const shared = createTopLeftQuad();
    const dispose = vi.spyOn(shared, "dispose");
    const second = new ScreenCompositor({
      viewportWidthPx: 320,
      viewportHeightPx: 240,
      cornerRadius: 0.015,
      meshWidth: 0.8,
      meshHeight: 0.6,
    });

    first.dispose();
    first.dispose();
    expect(dispose).not.toHaveBeenCalled();
    expect(createTopLeftQuad()).toBe(shared);

    second.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    second.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    const fresh = createTopLeftQuad();
    expect(fresh).not.toBe(shared);
    fresh.dispose();
  });

  it("buildCardDevice creates device instance and updates transform & style", () => {
    const node: LayoutNode = {
      id: "test-node",
      device: "card",
      assetId: null,
      width: 0.7,
      height: 0.5,
      screenAspect: 1.4,
      transform: { x: 0.1, y: -0.05, z: 0, rx: 0.05, ry: 0.1, rz: 0, scale: 0.98 },
      opacity: 0.8,
      scroll: 0,
      depthOrder: 0,
    };

    const style = createDoc().style;
    const dev = buildCardDevice(node, style, {
      outputWidthPx: 1920,
      outputHeightPx: 1080,
      supersample: 1,
    });

    expect(dev.object3d).toBeDefined();
    dev.update(node, style, 0);

    expect(dev.object3d.position.x).toBe(0.1);
    expect(dev.object3d.position.y).toBe(-0.05);
    expect(dev.object3d.scale.x).toBe(0.98);

    dev.dispose();
  });
});

describe("BackgroundRenderer (src/engine/background/BackgroundRenderer.ts)", () => {
  it("initializes and clears background without error", () => {
    const bg = new BackgroundRenderer();
    expect(bg).toBeDefined();
    bg.dispose();
  });
});
