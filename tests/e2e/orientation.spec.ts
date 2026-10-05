import { expect, test } from "@playwright/test";
import type { Engine } from "../../src/engine/Engine";
import type { ProjectDoc } from "../../src/doc/types";
import { avgRegion, expectRgbNear, inkBounds, type PixelBuffer } from "../helpers/pixels";

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

test("F01 known bug: image top and bottom are reversed", async ({ page }) => {
  test.fail(true, "Known bug, fixed by F01");
  await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
  for (const [device, fixture, tall] of [
    ["card", "card-hero", false],
    ["browser", "devices-browser", false],
    ["phone", "devices-phone", true],
    ["tablet", "devices-tablet", true],
    ["laptop", "devices-laptop", false],
  ] as const) {
    const verticalMeans = await page.evaluate(
      async ({ fixture, device, tall }) => {
        const images = window.__labTestImages;
        const setDoc = window.__labSetDoc;
        const doc = structuredClone(window.__fixtures?.[fixture]);
        const engine = window.__labEngine;
        if (!images || !setDoc || !doc || !engine)
          throw new Error("F01 pixel fixture hook is unavailable");
        engine.resize(1280, 720);
        const layout = doc.shots[0].layout;
        if (layout.kind !== "single") throw new Error(`Expected a single ${device} layout`);
        const assetId = `f01-quadrants-${device}`;
        const width = tall ? 780 : 1600;
        const height = tall ? 1688 : 1000;
        layout.assetId = assetId;
        doc.assets.push({
          id: assetId,
          kind: "image",
          name: assetId,
          mime: "image/png",
          bytes: 1,
          width,
          height,
        });
        doc.style.grain = 0;
        doc.style.vignette = 0;
        doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
        await setDoc(doc, { [assetId]: await images.quadrants(width, height) });
        engine.renderAt(0);
        const pixels = engine.readPixels();
        const means = { red: 0, blue: 0, redCount: 0, blueCount: 0 };
        for (let y = 0; y < 720; y++) {
          for (let x = 0; x < 1280; x++) {
            const i = (y * 1280 + x) * 4;
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            if (r > 160 && g < 100 && b < 100) {
              means.red += y;
              means.redCount++;
            }
            if (b > 160 && r < 100 && g < 100) {
              means.blue += y;
              means.blueCount++;
            }
          }
        }
        return means;
      },
      { fixture, device, tall },
    );
    expect(verticalMeans.redCount, `${device} red quadrant must render`).toBeGreaterThan(50);
    expect(verticalMeans.blueCount, `${device} blue quadrant must render`).toBeGreaterThan(50);
    expect(
      verticalMeans.red / verticalMeans.redCount,
      `${device} top-left red must appear above blue`,
    ).toBeLessThan(verticalMeans.blue / verticalMeans.blueCount);
  }
});

test("F01 known bug: text glyphs use top-down bitmap coordinates", async ({ page }) => {
  test.fail(true, "Known bug, fixed by F01");
  await page.goto("/lab?fixture=text-title&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
  const rows = await page.evaluate(async () => {
    const doc = structuredClone(window.__fixtures?.["text-title"]);
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    if (!doc || !engine || !setDoc) throw new Error("F01 text fixture hook is unavailable");
    engine.resize(1280, 720);
    doc.style.background = { kind: "solid", color: "#808080" };
    doc.style.grain = 0;
    doc.style.vignette = 0;
    doc.shots[0].layout = { kind: "title" };
    doc.shots[0].texts = [
      {
        id: "f01-capital-t",
        text: "T",
        role: "title",
        font: "display",
        size: 20,
        anchor: "center",
        align: "center",
        color: "#FFFFFF",
        animation: "none",
        delay: 0,
      },
    ];
    await setDoc(doc);
    engine.renderAt(0);
    const pixels = engine.readPixels();
    const rowCounts = new Array<number>(720).fill(0);
    for (let y = 0; y < 720; y++) {
      for (let x = 0; x < 1280; x++) {
        const i = (y * 1280 + x) * 4;
        if (pixels[i] > 130 && pixels[i + 1] > 130 && pixels[i + 2] > 130) rowCounts[y]++;
      }
    }
    return rowCounts;
  });
  const topInk = rows.slice(0, 180).reduce((sum, value) => sum + value, 0);
  const bottomInk = rows.slice(540).reduce((sum, value) => sum + value, 0);
  expect(topInk).toBeGreaterThan(bottomInk * 3);
});

test("F01 known bug: tall screenshot scroll endpoints preserve top-down order", async ({
  page,
}) => {
  test.fail(true, "Known bug, fixed by F01");
  await page.goto("/lab?fixture=devices-browser&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
  const endpoints = await page.evaluate(async () => {
    const doc = structuredClone(window.__fixtures?.["devices-browser"]);
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const images = window.__labTestImages;
    if (!doc || !engine || !setDoc || !images)
      throw new Error("F01 scroll fixture hook is unavailable");
    engine.resize(1280, 720);
    const layout = doc.shots[0].layout;
    if (layout.kind !== "single") throw new Error("Expected a single browser layout");
    const assetId = "f01-scroll-bands";
    layout.assetId = assetId;
    doc.assets.push({
      id: assetId,
      kind: "image",
      name: assetId,
      mime: "image/png",
      bytes: 1,
      width: 1440,
      height: 6000,
    });
    doc.shots[0].duration = 10;
    doc.shots[0].scroll = { enabled: true, stops: [0, 1], hold: 0.5, easing: "smooth" };
    doc.style.grain = 0;
    doc.style.vignette = 0;
    doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
    const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];
    await setDoc(doc, { [assetId]: await images.bands(1440, 6000, colors) });
    engine.renderAt(0);
    const top = engine.readPixels();
    engine.renderAt(10);
    const bottom = engine.readPixels();
    return {
      width: 1280,
      height: 720,
      top: Array.from(top),
      bottom: Array.from(bottom),
    };
  });
  const topPixels: PixelBuffer = {
    width: endpoints.width,
    height: endpoints.height,
    data: new Uint8Array(endpoints.top),
  };
  const bottomPixels: PixelBuffer = {
    width: endpoints.width,
    height: endpoints.height,
    data: new Uint8Array(endpoints.bottom),
  };
  const bounds = inkBounds(topPixels, [55, 55, 55], 12);
  expect(bounds).not.toBeNull();
  if (!bounds) throw new Error("Browser bounds were not found in the endpoint renders");
  const x0 = bounds.x + Math.floor(bounds.width * 0.48);
  const x1 = bounds.x + Math.ceil(bounds.width * 0.52);
  const upper = Math.round(bounds.y + bounds.height * 0.25);
  const lower = Math.round(bounds.y + bounds.height * 0.75);
  expectRgbNear(avgRegion(topPixels, x0, upper, x1, upper + 4), [255, 0, 0], 40);
  expectRgbNear(avgRegion(bottomPixels, x0, lower, x1, lower + 4), [0, 255, 255], 40);
});
