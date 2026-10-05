import { expect, test } from "@playwright/test";
import type { ProjectDoc } from "../../src/doc/types";
import type { Engine } from "../../src/engine/Engine";

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
    __fixtures?: Record<string, ProjectDoc>;
  }
}

test("F03 known bug: pair layouts preload both screen assets", async ({ page }) => {
  test.fail(true, "Known bug, fixed by F03");
  await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
  const greenPixels = await page.evaluate(async () => {
    const doc = structuredClone(window.__fixtures?.["card-hero"]);
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const images = window.__labTestImages;
    if (!doc || !engine || !setDoc || !images)
      throw new Error("F03 pixel fixture hook is unavailable");
    engine.resize(1280, 720);
    const desktopId = "f03-desktop";
    const mobileId = "f03-mobile";
    doc.assets.push(
      {
        id: desktopId,
        kind: "image",
        name: desktopId,
        mime: "image/png",
        bytes: 1,
        width: 1600,
        height: 1000,
      },
      {
        id: mobileId,
        kind: "image",
        name: mobileId,
        mime: "image/png",
        bytes: 1,
        width: 780,
        height: 1688,
      },
    );
    doc.style.grain = 0;
    doc.style.vignette = 0;
    doc.shots[0].layout = { kind: "pair", desktopId, mobileId, arrangement: "overlap" };
    doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
    const bitmap = await images.quadrants(1600, 1000);
    await setDoc(doc, { [desktopId]: bitmap, [mobileId]: bitmap });
    engine.renderAt(2.5);
    const pixels = engine.readPixels();
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 1] > 180 && pixels[i] < 100 && pixels[i + 2] < 100) count++;
    }
    return count;
  });
  expect(greenPixels, "loaded pair screens should contain the green test quadrant").toBeGreaterThan(
    100,
  );
});

test("F03 known bug: alternating documents releases old textures", async ({ page }) => {
  test.fail(true, "Known bug, fixed by F03");
  await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
  const counts = await page.evaluate(async () => {
    const base = window.__fixtures?.["card-hero"];
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const images = window.__labTestImages;
    if (!base || !engine || !setDoc || !images)
      throw new Error("F03 cache fixture hook is unavailable");
    engine.resize(1280, 720);
    const makeDoc = (assetId: string) => {
      const doc = structuredClone(base);
      const layout = doc.shots[0].layout;
      if (layout.kind !== "single") throw new Error("Expected single-layout cache fixtures");
      layout.assetId = assetId;
      doc.assets.push({
        id: assetId,
        kind: "image",
        name: assetId,
        mime: "image/png",
        bytes: 1,
        width: 1600,
        height: 1000,
      });
      return doc;
    };
    const bitmaps = await Promise.all([
      images.quadrants(1600, 1000),
      images.bands(1600, 1000, ["#FF0000", "#00FF00"]),
    ]);
    const load = (assetId: string, bitmapIndex: number) => {
      const doc = makeDoc(assetId);
      const layout = doc.shots[0].layout;
      if (layout.kind !== "single") throw new Error("Expected a single-layout cache fixture");
      return setDoc(doc, { [layout.assetId]: bitmaps[bitmapIndex] });
    };
    await load("f03-cache-a", 0);
    await load("f03-cache-b", 1);
    const afterSecond = engine.getMemoryInfo();
    for (let cycle = 2; cycle < 20; cycle++) await load(`f03-cache-${cycle}`, cycle % 2);
    const afterTwentieth = engine.getMemoryInfo();
    return { afterSecond, afterTwentieth };
  });
  expect(counts.afterTwentieth.geometries).toBe(counts.afterSecond.geometries);
  expect(counts.afterTwentieth.textures).toBe(counts.afterSecond.textures);
});
