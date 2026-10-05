import { expect, test } from "@playwright/test";
import type { ProjectDoc } from "../../src/doc/types";
import type { Engine } from "../../src/engine/Engine";
import { avgRegion, expectRgbNear } from "../helpers/pixels";

declare global {
  interface Window {
    __labReady?: boolean;
    __labEngine?: Engine;
    __labSetDoc?: (doc: ProjectDoc, images?: Record<string, ImageBitmap>) => Promise<void>;
    __fixtures?: Record<string, ProjectDoc>;
  }
}

test.describe("F02 colour pipeline known bug", () => {
  test("solid sRGB midtone reads back exactly", async ({ page }) => {
    test.fail(true, "Known bug, fixed by F02");
    await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true);
    const samples = await page.evaluate(async () => {
      const doc = structuredClone(window.__fixtures?.["card-hero"]);
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      if (!doc || !engine || !setDoc) throw new Error("F02 pixel hook is unavailable");
      engine.resize(1280, 720);
      doc.style.grain = 0;
      doc.style.vignette = 0;
      doc.shots[0].layout = { kind: "title" };
      doc.shots[0].texts = [];
      const cases = [
        ["#808080", [128, 128, 128]],
        ["#18191B", [24, 25, 27]],
        ["#F1EDE6", [241, 237, 230]],
      ] as const;
      const samples: { color: string; expected: readonly number[]; actual: number[] }[] = [];
      for (const [color, expected] of cases) {
        doc.style.background = { kind: "solid", color };
        await setDoc(doc);
        engine.renderAt(0);
        const data = engine.readPixels();
        const i = (360 * 1280 + 640) * 4;
        samples.push({ color, expected, actual: [data[i], data[i + 1], data[i + 2]] });
      }
      return samples;
    });
    for (const { color, expected, actual } of samples) {
      try {
        expectRgbNear(actual, expected, 1);
      } catch (error) {
        throw new Error(`${color}: ${error instanceof Error ? error.message : String(error)}`, {
          cause: error,
        });
      }
    }
  });

  test("grain is zero-mean and stays within the specified range", async ({ page }) => {
    test.fail(true, "Known bug, fixed by F02");
    await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true);
    const pixels = await page.evaluate(async () => {
      const doc = structuredClone(window.__fixtures?.["card-hero"]);
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      if (!doc || !engine || !setDoc) throw new Error("F02 pixel hook is unavailable");
      engine.resize(1280, 720);
      doc.style.background = { kind: "solid", color: "#808080" };
      doc.style.grain = 0.25;
      doc.style.vignette = 0;
      doc.shots[0].layout = { kind: "title" };
      doc.shots[0].texts = [];
      await setDoc(doc);
      engine.renderAt(0);
      return { width: 1280, height: 720, data: engine.readPixels() };
    });
    const mean = avgRegion(pixels, 540, 260, 740, 460);
    let variance = 0;
    let count = 0;
    for (let y = 260; y < 460; y++) {
      for (let x = 540; x < 740; x++) {
        const i = (y * pixels.width + x) * 4;
        variance += (pixels.data[i] - mean[0]) ** 2;
        count++;
      }
    }
    const deviation = Math.sqrt(variance / count);
    expect(mean[0]).toBeGreaterThanOrEqual(126.5);
    expect(mean[0]).toBeLessThanOrEqual(129.5);
    expect(deviation).toBeGreaterThan(1);
    expect(deviation).toBeLessThan(8);
  });

  test("screen pixels preserve all source band colors", async ({ page }) => {
    test.fail(true, "Known bug, fixed by F02");
    await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true);
    const matches = await page.evaluate(async () => {
      const doc = structuredClone(window.__fixtures?.["card-hero"]);
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      const images = window.__labTestImages;
      if (!doc || !engine || !setDoc || !images)
        throw new Error("F02 screenshot fixture hook is unavailable");
      engine.resize(1280, 720);
      const assetId = "f02-source-bands";
      const colors = ["#808080", "#3366CC", "#F1EDE6", "#18191B"];
      const layout = doc.shots[0].layout;
      if (layout.kind !== "single") throw new Error("Expected a single card layout");
      layout.device = "card";
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
      doc.style.grain = 0;
      doc.style.vignette = 0;
      doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
      await setDoc(doc, { [assetId]: await images.bands(1600, 1000, colors) });
      engine.renderAt(0);
      return Array.from(engine.readPixels());
    });
    const expected = [
      [128, 128, 128],
      [51, 102, 204],
      [241, 237, 230],
      [24, 25, 27],
    ];
    for (const rgb of expected) {
      let matched = 0;
      for (let i = 0; i < matches.length; i += 4) {
        if (
          Math.abs(matches[i] - rgb[0]) <= 2 &&
          Math.abs(matches[i + 1] - rgb[1]) <= 2 &&
          Math.abs(matches[i + 2] - rgb[2]) <= 2
        )
          matched++;
      }
      expect(matched, `source band ${rgb.join(", ")} should survive rendering`).toBeGreaterThan(
        100,
      );
    }
  });

  test("CSS gradient angles run from left to right at 90 degrees", async ({ page }) => {
    test.fail(true, "Known bug, fixed by F02");
    await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true);
    const samples = await page.evaluate(async () => {
      const doc = structuredClone(window.__fixtures?.["card-hero"]);
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      if (!doc || !engine || !setDoc) throw new Error("F02 pixel hook is unavailable");
      engine.resize(1280, 720);
      doc.style.background = { kind: "gradient", stops: ["#000000", "#FFFFFF"], angle: 90 };
      doc.style.grain = 0;
      doc.style.vignette = 0;
      doc.shots[0].layout = { kind: "title" };
      doc.shots[0].texts = [];
      doc.style.background = { kind: "gradient", stops: ["#3366CC", "#3366CC"], angle: 90 };
      await setDoc(doc);
      engine.renderAt(0);
      const gradient = engine.readPixels();
      doc.style.background = {
        kind: "mesh",
        colors: ["#3366CC", "#3366CC", "#3366CC"],
        drift: 0,
        seed: 1,
      };
      await setDoc(doc);
      engine.renderAt(0);
      const mesh = engine.readPixels();
      doc.style.background = { kind: "gradient", stops: ["#000000", "#FFFFFF"], angle: 90 };
      await setDoc(doc);
      engine.renderAt(0);
      const directed = engine.readPixels();
      const rgbAt = (data: Uint8ClampedArray, x: number) => {
        const i = (360 * 1280 + x) * 4;
        return [data[i], data[i + 1], data[i + 2]];
      };
      return {
        gradient: rgbAt(gradient, 640),
        mesh: rgbAt(mesh, 640),
        left: rgbAt(directed, 20)[0],
        right: rgbAt(directed, 1260)[0],
      };
    });
    expectRgbNear(samples.gradient, [51, 102, 204], 1);
    expectRgbNear(samples.mesh, [51, 102, 204], 1);
    expect(samples.left).toBeLessThan(10);
    expect(samples.right).toBeGreaterThan(245);
  });
});
