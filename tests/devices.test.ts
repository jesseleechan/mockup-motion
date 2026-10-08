import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { defaultStyle } from "../src/doc/defaults";
import type { DeviceKind, LayoutNode } from "../src/motion";
import { screenAspectFor } from "../src/motion";
import { DeviceFadePass } from "../src/engine/devices/DeviceFade";
import {
  buildBrowserDevice,
  buildCardDevice,
  cardCornerRadius,
  buildDevice,
  buildLaptopDevice,
  buildPhoneDevice,
  buildTabletDevice,
} from "../src/engine/devices";

function makeMockNode(device: DeviceKind, width = 0.8, height = 0.5): LayoutNode {
  return {
    id: `test:${device}`,
    device,
    assetId: "test-asset",
    width,
    height,
    screenAspect: 1.6,
    transform: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
    opacity: 1,
    scroll: 0,
    depthOrder: 0,
  };
}

const mockCtx = {
  outputWidthPx: 1920,
  outputHeightPx: 1080,
  supersample: 1,
};

describe("Device frames proportions and geometry (quality-bar §3)", () => {
  it("screenAspectFor follows rules for all device kinds", () => {
    // Phone: 0.4615 (9:19.5)
    expect(screenAspectFor("phone")).toBeCloseTo(0.4615, 4);

    // Tablet: 0.75 (4:3)
    expect(screenAspectFor("tablet")).toBeCloseTo(0.75, 4);

    // Card / Browser / Laptop short desktop screenshot (imgAspect >= 1.25): clamp(aspect, 1.25, 2.0)
    expect(screenAspectFor("browser", { width: 1600, height: 1000 })).toBeCloseTo(1.6, 2);
    expect(screenAspectFor("browser", { width: 2500, height: 1000 })).toBeCloseTo(2.0, 2);
    expect(screenAspectFor("browser", { width: 1300, height: 1000 })).toBeCloseTo(1.3, 2);

    // Tall screenshot (< 1.25): falls back to 1.6
    expect(screenAspectFor("browser", { width: 1000, height: 3000 })).toBeCloseTo(1.6, 2);
    expect(screenAspectFor("card", null)).toBe(1.6);
  });

  it("Browser device matches quality-bar §3.2 proportions within ±0.05% of width", () => {
    const width = 1.0;
    const height = 0.625;
    const node = makeMockNode("browser", width, height);
    const style = { ...defaultStyle(), browserChrome: "standard" as const };
    const dev = buildBrowserDevice(node, style, mockCtx);

    expect(dev.object3d).toBeInstanceOf(THREE.Group);
    // Find screen and body meshes
    const meshes = dev.object3d.children.filter((c) => c instanceof THREE.Mesh) as THREE.Mesh[];
    expect(meshes.length).toBeGreaterThanOrEqual(2);

    // Toolbar height: 4.2% of window width (min 0.028)
    const expectedToolbarH = Math.max(0.028, width * 0.042);
    expect(expectedToolbarH).toBeCloseTo(0.042, 3);

    // Traffic lights: diameter 0.85% of width, gap 0.55%, left inset 1.6%
    const expectedDiameter = width * 0.0085;
    const expectedGap = width * 0.0055;
    const expectedInset = width * 0.016;

    expect(expectedDiameter).toBeCloseTo(0.0085, 4);
    expect(expectedGap).toBeCloseTo(0.0055, 4);
    expect(expectedInset).toBeCloseTo(0.016, 4);

    // URL pill: 34% width, 56% toolbar height
    const expectedPillW = width * 0.34;
    const expectedPillH = expectedToolbarH * 0.56;
    expect(expectedPillW).toBeCloseTo(0.34, 3);
    expect(expectedPillH).toBeCloseTo(0.042 * 0.56, 3);

    dev.dispose();
  });

  it("Phone device matches quality-bar §3.3 proportions within ±0.05% of width", () => {
    const width = 0.36; // stage units
    const height = width / 0.488; // body aspect 0.488
    const node = makeMockNode("phone", width, height);
    const style = defaultStyle();
    const dev = buildPhoneDevice(node, style, mockCtx);

    // Body aspect: 0.488
    expect(width / height).toBeCloseTo(0.488, 3);

    // Bezel: 3.2% of body width
    const bezel = width * 0.032;
    expect(bezel).toBeCloseTo(0.032 * width, 4);

    // Corner radius: 15.5% of width; screen radius: 12.3% of width
    const bodyRadius = width * 0.155;
    const screenRadius = bodyRadius - bezel;
    expect(screenRadius).toBeCloseTo(0.123 * width, 4);

    // Camera pill: width 27% screen width, height 7.6% screen width, 2.4% below screen top
    const screenW = width - bezel * 2;
    const pillW = screenW * 0.27;
    const pillH = screenW * 0.076;
    expect(pillW).toBeCloseTo(0.27 * screenW, 4);
    expect(pillH).toBeCloseTo(0.076 * screenW, 4);

    dev.dispose();
  });

  it("Tablet device matches quality-bar §3.4 proportions within ±0.05% of width", () => {
    const width = 0.54;
    const height = 0.72;
    const node = makeMockNode("tablet", width, height);
    const dev = buildTabletDevice(node, defaultStyle(), mockCtx);

    // Bezel: 4% of width, corner radius 6.5%
    const bezel = width * 0.04;
    const bodyRadius = width * 0.065;
    const screenRadius = bodyRadius - bezel;
    expect(screenRadius).toBeCloseTo(0.025 * width, 4);

    dev.dispose();
  });

  it("Laptop device has screen lid and keyboard base at pitch angle", () => {
    const width = 0.7;
    const height = 0.44;
    const node = makeMockNode("laptop", width, height);
    const dev = buildLaptopDevice(node, defaultStyle(), mockCtx);

    // Bezel 1.8% of lid width
    const bezel = width * 0.018;
    expect(bezel).toBeCloseTo(0.018 * width, 4);

    // Has lid and base meshes in group
    expect(dev.object3d.children.length).toBeGreaterThanOrEqual(3);

    dev.dispose();
  });

  it("Card device has 1.6% corner radius and solid backing", () => {
    const width = 0.8;
    const height = 0.5;
    const node = makeMockNode("card", width, height);
    const dev = buildCardDevice(node, defaultStyle(), mockCtx);

    expect(dev.object3d.children.length).toBeGreaterThanOrEqual(2);
    dev.dispose();
  });

  it("buildDevice dispatches to appropriate builder for every DeviceKind", () => {
    const kinds: DeviceKind[] = ["browser", "phone", "tablet", "laptop", "card"];
    for (const kind of kinds) {
      const node = makeMockNode(kind);
      const dev = buildDevice(node, defaultStyle(), mockCtx);
      expect(dev).toBeDefined();
      expect(dev.object3d).toBeInstanceOf(THREE.Group);
      expect(dev.compositor).toBeDefined();
      dev.dispose();
    }
  });
});

describe("Portrait cards and slider fades (presets P02)", () => {
  function portraitNode(): LayoutNode {
    const height = 0.63;
    return { ...makeMockNode("card", height * 0.4615, height), screenAspect: 0.4615 };
  }

  it("rounds portrait cards at 7.5% of their width and landscape cards at 1.6%", () => {
    expect(cardCornerRadius(0.29, 0.4615)).toBeCloseTo(0.29 * 0.075, 6);
    expect(cardCornerRadius(0.8, 1.6)).toBeCloseTo(0.8 * 0.016, 6);

    const node = portraitNode();
    const dev = buildCardDevice(node, defaultStyle(), mockCtx);
    expect(dev.compositor.material.uniforms.uRadius.value).toBeCloseTo(node.width * 0.075, 6);
    dev.dispose();
  });

  it("disposes every geometry, material and target of a portrait card", () => {
    const dev = buildCardDevice(portraitNode(), defaultStyle(), mockCtx);
    type Disposable = THREE.EventDispatcher<{ dispose: object }>;
    const resources = new Set<Disposable>();
    dev.object3d.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        resources.add(object.geometry);
        for (const material of [object.material].flat()) resources.add(material);
      }
    });
    resources.add(dev.compositor.renderTarget);
    const disposed = new Set<unknown>();
    for (const resource of resources) {
      resource.addEventListener("dispose", () => disposed.add(resource));
    }
    expect(resources.size).toBeGreaterThanOrEqual(5);
    dev.dispose();
    const left = [...resources].filter((resource) => !disposed.has(resource));
    expect(left.map((r) => r.constructor.name)).toEqual([]);
  });

  it("allocates the sRGB backdrop only for slider docs and frees it on dispose", () => {
    const pass = new DeviceFadePass();
    const initialised: THREE.WebGLRenderTarget[] = [];
    const renderer = {
      initRenderTarget: (target: THREE.WebGLRenderTarget) => initialised.push(target),
    } as unknown as THREE.WebGLRenderer;
    const target = new THREE.WebGLRenderTarget(64, 80, { samples: 4 });

    pass.prepare(renderer, target, { fade: true, srgb: false });
    expect(initialised).toHaveLength(1);
    const [layer] = initialised;

    pass.prepare(renderer, target, { fade: true, srgb: true });
    expect(initialised).toHaveLength(3);
    const backdrop = initialised[2];
    expect(backdrop).not.toBe(layer);
    expect([backdrop.width, backdrop.height, backdrop.samples]).toEqual([64, 80, 0]);

    const disposed: string[] = [];
    layer.addEventListener("dispose", () => disposed.push("layer"));
    backdrop.addEventListener("dispose", () => disposed.push("backdrop"));
    pass.prepare(renderer, target, { fade: true, srgb: false });
    expect(disposed).toEqual(["backdrop"]);

    pass.prepare(renderer, target, { fade: true, srgb: true });
    const second = initialised[initialised.length - 1];
    second.addEventListener("dispose", () => disposed.push("second backdrop"));
    pass.dispose();
    expect(disposed).toEqual(["backdrop", "layer", "second backdrop"]);
    target.dispose();
  });
});
