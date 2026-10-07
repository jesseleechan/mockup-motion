import { expect, test } from "@playwright/test";
import type { Engine } from "../../src/engine/Engine";
import type { ProjectDoc } from "../../src/doc/types";
import type { exportWithEngine } from "../../src/export/engine-export";
import type { createLabAssetProvider } from "../../src/lab/asset-provider";
import {
  avgRegion,
  expectRgbNear,
  inkBounds,
  quadrantCentroids,
  type PixelBuffer,
} from "../helpers/pixels";

declare global {
  interface Window {
    __labReady?: boolean;
    __labEngine?: Engine;
    __labTestImages?: {
      quadrants(w: number, h: number): Promise<ImageBitmap>;
      bands(w: number, h: number, colors: string[]): Promise<ImageBitmap>;
      edgeColumns(w: number, h: number): Promise<ImageBitmap>;
    };
    __labSetDoc?: (doc: ProjectDoc, images?: Record<string, ImageBitmap>) => Promise<void>;
    __exportWithEngine?: typeof exportWithEngine;
    __createLabAssetProvider?: typeof createLabAssetProvider;
    __mediabunnyTest?: {
      ALL_FORMATS: unknown;
      BlobSource: new (blob: Blob) => unknown;
      Input: new (options: { source: unknown; formats: unknown }) => {
        getPrimaryVideoTrack(): Promise<unknown>;
        dispose(): void;
      };
      CanvasSink: new (track: unknown) => {
        getCanvas(time: number): Promise<{ canvas: HTMLCanvasElement | OffscreenCanvas } | null>;
      };
    };
    __fixtures?: Record<string, ProjectDoc>;
  }
}

const colors = {
  red: [255, 0, 0] as const,
  green: [0, 255, 0] as const,
  blue: [0, 0, 255] as const,
  yellow: [255, 255, 0] as const,
};

async function ready(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/lab?fixture=device-card-frontal&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
}

async function prepareQuadrants(
  page: import("@playwright/test").Page,
  device: "card" | "browser" | "phone" | "tablet" | "laptop",
): Promise<{ start: PixelBuffer; end?: PixelBuffer }> {
  return page.evaluate(async (currentDevice) => {
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const images = window.__labTestImages;
    const doc = structuredClone(window.__fixtures?.[`device-${currentDevice}-frontal`]);
    if (!engine || !setDoc || !images || !doc) throw new Error("F01 fixture hooks are unavailable");
    engine.resize(1280, 720);
    const layout = doc.shots[0].layout;
    if (layout.kind !== "single") throw new Error(`Expected a single ${currentDevice} layout`);
    const portrait = currentDevice === "phone" || currentDevice === "tablet";
    const width = portrait ? 780 : 1600;
    const height = portrait ? 1688 : 1000;
    const assetId = `f01-quadrants-${currentDevice}`;
    layout.assetId = assetId;
    doc.assets.push({ id: assetId, kind: "image", name: assetId, mime: "image/png", bytes: 1, width, height });
    doc.style.background = { kind: "solid", color: "#808080" };
    doc.style.grain = 0;
    doc.style.vignette = 0;
    doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
    if (currentDevice === "tablet") {
      doc.shots[0].duration = 10;
      doc.shots[0].scroll = { enabled: true, stops: [0, 1], hold: 0.5, easing: "smooth" };
    }
    await setDoc(doc, { [assetId]: await images.quadrants(width, height) });
    engine.renderAt(0);
    const start = { width: 1280, height: 720, data: engine.readPixels() };
    if (currentDevice !== "tablet") return { start };
    engine.renderAt(10);
    return { start, end: { width: 1280, height: 720, data: engine.readPixels() } };
  }, device);
}

for (const device of ["card", "browser", "phone", "tablet", "laptop"] as const) {
  test(`F01 ${device} screen maps all four source quadrants upright`, async ({ page }) => {
    await ready(page);
    const frames = await prepareQuadrants(page, device);
    const first = quadrantCentroids(frames.start);
    const lower = quadrantCentroids(frames.end ?? frames.start);
    expect(first.red.count, "top-left red quadrant must be visible").toBeGreaterThan(50);
    expect(first.green.count, "top-right green quadrant must be visible").toBeGreaterThan(50);
    expect(lower.blue.count, "bottom-left blue quadrant must be visible").toBeGreaterThan(50);
    expect(lower.yellow.count, "bottom-right yellow quadrant must be visible").toBeGreaterThan(50);
    expect(first.red.x, "red must be left of green").toBeLessThan(first.green.x);
    expect(lower.blue.x, "blue must be left of yellow").toBeLessThan(lower.yellow.x);
    expect(first.red.y, "red must be above blue").toBeLessThan(lower.blue.y);
    expect(first.green.y, "green must be above yellow").toBeLessThan(lower.yellow.y);

    const frameBackground = avgRegion(frames.start, 8, 8, 16, 16) as [number, number, number];
    const bounds = inkBounds(frames.start, frameBackground, 12);
    expect(bounds, "the rendered device screen must be measurable").not.toBeNull();
    if (!bounds) throw new Error(`Could not find ${device} screen bounds`);
    const sample = (buffer: PixelBuffer, xFraction: number, yFraction: number) => {
      const x = bounds.x + bounds.width * xFraction;
      const y = bounds.y + bounds.height * yFraction;
      return avgRegion(buffer, x - 3, y - 3, x + 3, y + 3);
    };
    expectRgbNear(sample(frames.start, 0.25, 0.25), colors.red, 40);
    expectRgbNear(sample(frames.start, 0.75, 0.25), colors.green, 40);
    const lowerFrame = frames.end ?? frames.start;
    expectRgbNear(sample(lowerFrame, 0.25, 0.75), colors.blue, 40);
    expectRgbNear(sample(lowerFrame, 0.75, 0.75), colors.yellow, 40);
  });
}

test("F01 tall screenshot scroll preserves top-down color bands at both endpoints", async ({ page }) => {
  // 62 scrolled frames at 1280x720 (supersample 1.5), each recomposing the 2x screen target and
  // its mipmaps (F11): about 50 s locally before F11 and 57 s after, and about 5x slower on the CI runner.
  test.setTimeout(300_000);
  await ready(page);
  const frames = await page.evaluate(async () => {
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const images = window.__labTestImages;
    const doc = structuredClone(window.__fixtures?.["device-browser-frontal"]);
    if (!doc || !engine || !setDoc || !images) throw new Error("F01 scroll fixture hooks are unavailable");
    engine.resize(1280, 720);
    const layout = doc.shots[0].layout;
    if (layout.kind !== "single") throw new Error("Expected a single browser layout");
    const assetId = "f01-scroll-bands";
    layout.assetId = assetId;
    doc.assets.push({ id: assetId, kind: "image", name: assetId, mime: "image/png", bytes: 1, width: 1440, height: 6000 });
    doc.shots[0].duration = 10;
    doc.shots[0].scroll = { enabled: true, stops: [0, 1], hold: 0.5, easing: "smooth" };
    doc.style.grain = 0;
    doc.style.vignette = 0;
    doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
    const bandColors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];
    await setDoc(doc, { [assetId]: await images.bands(1440, 6000, bandColors) });
    engine.renderAt(0);
    const top = engine.readPixels();
    const geometriesBeforeScroll = engine.getMemoryInfo().geometries;
    for (let frame = 1; frame <= 60; frame++) engine.renderAt((frame / 60) * 10);
    const geometriesAfterScroll = engine.getMemoryInfo().geometries;
    engine.renderAt(10);
    const bottom = engine.readPixels();
    return {
      top: Array.from(top),
      bottom: Array.from(bottom),
      geometriesBeforeScroll,
      geometriesAfterScroll,
    };
  });
  const top: PixelBuffer = { width: 1280, height: 720, data: new Uint8Array(frames.top) };
  const bottom: PixelBuffer = { width: 1280, height: 720, data: new Uint8Array(frames.bottom) };
  const bg = avgRegion(top, 8, 8, 16, 16) as [number, number, number];
  const bounds = inkBounds(top, bg, 12);
  expect(bounds).not.toBeNull();
  if (!bounds) throw new Error("Browser bounds were not found in the endpoint renders");
  const x = bounds.x + Math.round(bounds.width / 2);
  const topY = bounds.y + Math.round(bounds.height * 0.3);
  const bottomY = bounds.y + Math.round(bounds.height * 0.7);
  expectRgbNear(avgRegion(top, x - 3, topY - 3, x + 3, topY + 3), colors.red, 40);
  expectRgbNear(avgRegion(bottom, x - 3, bottomY - 3, x + 3, bottomY + 3), [0, 255, 255], 40);
  expect(frames.geometriesAfterScroll).toBe(frames.geometriesBeforeScroll);
});

test("F01 capital T has its crossbar at the top of glyph ink bounds", async ({ page }) => {
  await ready(page);
  const rows = await page.evaluate(async () => {
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const doc = structuredClone(window.__fixtures?.["text-title"]);
    if (!doc || !engine || !setDoc) throw new Error("F01 text fixture hooks are unavailable");
    engine.resize(1280, 720);
    doc.style.background = { kind: "solid", color: "#808080" };
    doc.style.grain = 0;
    doc.style.vignette = 0;
    doc.style.fonts.display.family = "Inter Display";
    doc.shots[0].layout = { kind: "title" };
    doc.shots[0].texts = [{ id: "f01-capital-t", text: "T", role: "title", font: "display", size: 20, anchor: "center", align: "center", color: "#FFFFFF", animation: "none", delay: 0 }];
    await setDoc(doc);
    engine.renderAt(0);
    const pixels = engine.readPixels();
    const inkRows: number[] = [];
    const inkColumns: number[] = [];
    for (let y = 0; y < 720; y++) for (let x = 0; x < 1280; x++) {
      const i = (y * 1280 + x) * 4;
      if (pixels[i] > 170 && pixels[i + 1] > 170 && pixels[i + 2] > 170) {
        inkRows.push(y);
        inkColumns.push(x);
      }
    }
    if (inkRows.length === 0) throw new Error("Capital T produced no measurable ink");
    const minY = Math.min(...inkRows);
    const maxY = Math.max(...inkRows);
    const minX = Math.min(...inkColumns);
    const maxX = Math.max(...inkColumns);
    const counts = new Array<number>(maxY - minY + 1).fill(0);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const i = (y * 1280 + x) * 4;
      if (pixels[i] > 170 && pixels[i + 1] > 170 && pixels[i + 2] > 170) counts[y - minY]++;
    }
    return counts;
  });
  const quarter = Math.max(1, Math.floor(rows.length / 4));
  const topInk = rows.slice(0, quarter).reduce((sum, n) => sum + n, 0);
  const bottomInk = rows.slice(rows.length - quarter).reduce((sum, n) => sum + n, 0);
  expect(topInk).toBeGreaterThan(bottomInk * 3);
});

test("F01 maskReveal exposes lower glyph ink before its upper crossbar", async ({ page }) => {
  await ready(page);
  const bands = await page.evaluate(async () => {
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const doc = structuredClone(window.__fixtures?.["text-title"]);
    if (!doc || !engine || !setDoc) throw new Error("F01 mask reveal hooks are unavailable");
    engine.resize(1280, 720);
    doc.style.background = { kind: "solid", color: "#808080" };
    doc.style.grain = 0;
    doc.style.vignette = 0;
    doc.style.fonts.display = { source: "builtin", family: "Inter Display", weight: 600 };
    doc.shots[0].layout = { kind: "title" };
    doc.shots[0].texts = [{ id: "f01-mask-t", text: "T", role: "title", font: "display", size: 20, anchor: "center", align: "center", color: "#FFFFFF", animation: "maskReveal", delay: 0 }];
    await setDoc(doc);
    const countRows = () => {
      const pixels = engine.readPixels();
      const rows = new Array<number>(720).fill(0);
      for (let y = 0; y < 720; y++) for (let x = 0; x < 1280; x++) {
        const i = (y * 1280 + x) * 4;
        if (pixels[i] > 170 && pixels[i + 1] > 170 && pixels[i + 2] > 170) rows[y]++;
      }
      return rows;
    };
    engine.renderAt(1);
    const full = countRows();
    const fullInkRows = full.flatMap((count, y) => count > 0 ? [y] : []);
    if (fullInkRows.length === 0) throw new Error("Mask reveal produced no complete glyph ink");
    const min = Math.min(...fullInkRows);
    const max = Math.max(...fullInkRows);
    engine.renderAt(0.12);
    const revealed = countRows();
    const quarter = Math.max(1, Math.floor((max - min + 1) / 4));
    return {
      top: revealed.slice(min, min + quarter).reduce((a, b) => a + b, 0),
      bottom: revealed.slice(max - quarter + 1, max + 1).reduce((a, b) => a + b, 0),
    };
  });
  expect(bands.bottom).toBeGreaterThan(0);
  expect(bands.top).toBe(0);
});

test("F01 image background maps its top edge to the source top row", async ({ page }) => {
  await ready(page);
  const pixels = await page.evaluate(async () => {
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const images = window.__labTestImages;
    const base = structuredClone(window.__fixtures?.["device-card-frontal"]);
    if (!base || !engine || !setDoc || !images) throw new Error("F01 background hooks are unavailable");
    engine.resize(1280, 720);
    const assetId = "f01-background-quadrants";
    base.assets.push({ id: assetId, kind: "image", name: assetId, mime: "image/png", bytes: 1, width: 1600, height: 1000 });
    const layout = base.shots[0].layout;
    if (layout.kind !== "single") throw new Error("Expected a card screen to warm the image texture");
    layout.assetId = assetId;
    await setDoc(base, { [assetId]: await images.quadrants(1600, 1000) });
    const backgroundDoc = structuredClone(base);
    backgroundDoc.shots[0].layout = { kind: "title" };
    backgroundDoc.style.background = { kind: "image", assetId, dim: 0 };
    backgroundDoc.shots[0].texts = [];
    await setDoc(backgroundDoc);
    engine.renderAt(0);
    return Array.from(engine.readPixels());
  });
  const frame: PixelBuffer = { width: 1280, height: 720, data: new Uint8Array(pixels) };
  expectRgbNear(avgRegion(frame, 280, 150, 286, 156), colors.red, 40);
  expectRgbNear(avgRegion(frame, 990, 150, 996, 156), colors.green, 40);
  expectRgbNear(avgRegion(frame, 280, 565, 286, 571), colors.blue, 40);
  expectRgbNear(avgRegion(frame, 990, 565, 996, 571), colors.yellow, 40);
});

test("F01 decoded WebM frame preserves card quadrant orientation", async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const entry = performance
      .getEntriesByType("resource")
      .find((resource) => new URL(resource.name).pathname.endsWith("/deps/mediabunny.js"));
    if (!entry) throw new Error("The app's optimized Mediabunny module was not loaded");
    const media = await import(/* @vite-ignore */ entry.name);
    window.__mediabunnyTest = media;
  });
  const bytes = await page.evaluate(async () => {
    const exportFn = window.__exportWithEngine;
    const makeProvider = window.__createLabAssetProvider;
    const doc = structuredClone(window.__fixtures?.["device-card-frontal"]);
    const images = window.__labTestImages;
    if (!exportFn || !makeProvider || !doc || !images) throw new Error("F01 export hooks are unavailable");
    const layout = doc.shots[0].layout;
    if (layout.kind !== "single") throw new Error("Expected a card single layout");
    const id = "f01-export-quadrants";
    layout.assetId = id;
    doc.assets.push({ id, kind: "image", name: id, mime: "image/png", bytes: 1, width: 1600, height: 1000 });
    doc.shots[0].duration = 1;
    doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
    doc.style.grain = 0;
    doc.style.vignette = 0;
    const provider = makeProvider();
    // The F01 fixture is 640x360; product presets intentionally omit this test-only size.
    const smallFixtureResolution = 360 as ProjectDoc["export"]["resolution"];
    const result = await exportFn(doc, { ...provider, getImage: async () => images.quadrants(1600, 1000) }, {
      destination: "custom", resolution: smallFixtureResolution, fps: 30, quality: "high", format: "webm", supersample: 1, motionBlur: false,
    });
    const media = window.__mediabunnyTest;
    if (!media) throw new Error("Mediabunny browser test module is unavailable");
    const input = new media.Input({ source: new media.BlobSource(result.blob), formats: media.ALL_FORMATS });
    try {
      const track = await input.getPrimaryVideoTrack();
      if (!track) throw new Error("Export has no primary video track");
      const decoded = await new media.CanvasSink(track).getCanvas(0.5);
      if (!decoded) throw new Error("Mediabunny did not decode a frame at 0.5s");
      const canvas = decoded.canvas;
      if (canvas.width !== 640 || canvas.height !== 360) {
        throw new Error(`Expected a 640x360 export frame, got ${canvas.width}x${canvas.height}`);
      }
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Decoded frame has no 2D context");
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      return Array.from(image.data);
    } finally {
      input.dispose();
    }
  });
  const pixels: PixelBuffer = { width: 640, height: 360, data: new Uint8Array(bytes) };
  expectRgbNear(avgRegion(pixels, 190, 90, 194, 94), colors.red, 40);
  expectRgbNear(avgRegion(pixels, 446, 90, 450, 94), colors.green, 40);
  expectRgbNear(avgRegion(pixels, 190, 266, 194, 270), colors.blue, 40);
  expectRgbNear(avgRegion(pixels, 446, 266, 450, 270), colors.yellow, 40);
});
