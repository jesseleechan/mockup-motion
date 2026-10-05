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
  it("caches textures and splits tall images into vertical strips", async () => {
    const tm = new TextureManager(2048, 4);

    // Mock provider returning a 1000 x 5000 image
    const mockProvider: AssetProvider = {
      getImage: async () => {
        // Return a mock object satisfying ImageBitmap shape
        return {
          width: 1000,
          height: 5000,
          close: () => {},
        } as unknown as ImageBitmap;
      },
      getText: async () => {
        throw new Error("Not implemented");
      },
    };

    const managed = await tm.getTexture("tall-asset-1", 1000, mockProvider);
    expect(managed).toBeDefined();
    expect(managed?.strips.length).toBe(3); // 5000 / 2048 = 3 strips (2048, 2048, 904)
    expect(managed?.strips[0].height).toBe(2048);
    expect(managed?.strips[1].height).toBe(2048);
    expect(managed?.strips[2].height).toBe(904);

    // Second call retrieves from cache
    const cached = await tm.getTexture("tall-asset-1", 1000, mockProvider);
    expect(cached).toBe(managed);

    tm.dispose();
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
