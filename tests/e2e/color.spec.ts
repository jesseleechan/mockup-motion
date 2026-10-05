import { decode, encode, expectGlyphCompositing } from "../helpers/glyph-oracle";
import { expect, test, type Page } from "@playwright/test";
import type { Background, ProjectDoc } from "../../src/doc/types";
import type { AssetProvider, Engine } from "../../src/engine/Engine";
import { avgRegion, expectRgbNear, type PixelBuffer } from "../helpers/pixels";

declare global {
  interface Window {
    __labReady?: boolean;
    __labEngine?: Engine;
    __labSetDoc?: (doc: ProjectDoc, images?: Record<string, ImageBitmap>) => Promise<void>;
    __fixtures?: Record<string, ProjectDoc>;
  }
}
async function ready(page: Page, extra = ""): Promise<void> {
  await page.goto(`/lab?still=1&fixture=device-card-frontal&t=0&aspect=16:9&w=1280${extra}`);
  await page.waitForFunction(() => window.__labReady === true);
}
async function background(page: Page, bg: Background, grain = 0): Promise<PixelBuffer> {
  return page.evaluate(
    async ({ bg, grain }) => {
      const doc = structuredClone(window.__fixtures?.["device-card-frontal"]);
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      if (!doc || !engine || !setDoc) throw new Error("F02 fixture hooks unavailable");
      doc.loop = false;
      doc.style.background = bg;
      doc.style.grain = grain;
      doc.style.vignette = 0;
      doc.shots[0].layout = { kind: "title" };
      doc.shots[0].texts = [];
      await setDoc(doc);
      engine.renderAt(0);
      return { width: 1280, height: 720, data: engine.readPixels() };
    },
    { bg, grain },
  );
}
for (const [hex, rgb] of [
  ["#808080", [128, 128, 128]],
  ["#18191B", [24, 25, 27]],
  ["#F1EDE6", [241, 237, 230]],
] as const) {
  test(`F02 solid ${hex} preserves exact colour`, async ({ page }) => {
    await ready(page);
    const frame = await background(page, { kind: "solid", color: hex });
    expectRgbNear(avgRegion(frame, 600, 320, 680, 400), rgb, 1);
  });
}
for (const kind of ["gradient", "mesh"] as const) {
  test(`F02 constant ${kind} outputs linear values`, async ({ page }) => {
    await ready(page);
    const bg: Background =
      kind === "gradient"
        ? { kind, stops: ["#3366CC", "#3366CC"], angle: 90, angleConvention: "css" }
        : { kind, colors: ["#3366CC", "#3366CC", "#3366CC"], drift: 0, seed: 1 };
    const frame = await background(page, bg);
    expectRgbNear(avgRegion(frame, 600, 320, 680, 400), [51, 102, 204], 1);
  });
}
test("F02 screenshot band centres preserve RGB in source top-to-bottom order", async ({ page }) => {
  await ready(page, "&cameraDistance=0.7");
  const pixels = await page.evaluate(async () => {
    const doc = structuredClone(window.__fixtures?.["device-card-frontal"]);
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const images = window.__labTestImages;
    if (!doc || !engine || !setDoc || !images) throw new Error("F02 band hooks unavailable");
    const assetId = "f02-source-bands";
    doc.shots[0].layout = { kind: "single", device: "card", assetId };
    doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
    doc.shots[0].entrance = "none";
    doc.style.grain = doc.style.vignette = 0;
    doc.style.shadow = "none";
    doc.assets.push({
      id: assetId,
      kind: "image",
      name: assetId,
      mime: "image/png",
      bytes: 1,
      width: 1600,
      height: 1000,
    });
    await setDoc(doc, {
      [assetId]: await images.bands(1600, 1000, ["#808080", "#3366CC", "#F1EDE6", "#18191B"]),
    });
    engine.renderAt(0);
    return { width: 1280, height: 720, data: engine.readPixels() };
  });
  // Static card is .68 * 16/9 stage units wide; distance .7 gives 1243x777px.
  for (const [y, rgb] of [
    [69, [128, 128, 128]],
    [263, [51, 102, 204]],
    [457, [241, 237, 230]],
    [651, [24, 25, 27]],
  ] as const) {
    expectRgbNear(avgRegion(pixels, 630, y - 3, 650, y + 3), rgb, 2);
  }
});
for (const angle of [90, 180] as const) {
  test(`F02 CSS gradient ${angle} degrees runs in the correct direction`, async ({ page }) => {
    await ready(page);
    const frame = await background(page, {
      kind: "gradient",
      stops: ["#000000", "#FFFFFF"],
      angle,
      angleConvention: "css",
    });
    const sample = (x: number, y: number) => avgRegion(frame, x, y, x + 4, y + 4)[0];
    if (angle === 90) {
      expect(sample(0, 358)).toBeLessThan(10);
      expect(sample(1276, 358)).toBeGreaterThan(245);
      expect(Math.abs(sample(638, 40) - sample(638, 676))).toBeLessThanOrEqual(1);
    } else {
      expect(sample(638, 0)).toBeLessThan(10);
      expect(sample(638, 716)).toBeGreaterThan(245);
      expect(Math.abs(sample(40, 358) - sample(1236, 358))).toBeLessThanOrEqual(1);
    }
  });
}
test("F02 grain is zero-mean monochrome, bounded and deterministic in every channel", async ({
  page,
}) => {
  await ready(page);
  const frame = await background(page, { kind: "solid", color: "#808080" }, 0.25);
  const repeat = await page.evaluate(() => {
    if (!window.__labEngine) throw new Error("Engine unavailable");
    window.__labEngine.renderAt(0);
    return window.__labEngine.readPixels();
  });
  expect(Array.from(repeat)).toEqual(Array.from(frame.data));
  const mean = avgRegion(frame, 540, 260, 740, 460);
  for (let channel = 0; channel < 3; channel++) {
    let variance = 0;
    let monochrome = true;
    let maximum = 0;
    for (let y = 260; y < 460; y++)
      for (let x = 540; x < 740; x++) {
        const i = (y * 1280 + x) * 4;
        variance += (frame.data[i + channel] - mean[channel]) ** 2;
        monochrome &&= frame.data[i + channel] === frame.data[i];
        maximum = Math.max(maximum, Math.abs(frame.data[i + channel] - 128));
      }
    expect(monochrome).toBe(true);
    expect(maximum).toBeLessThanOrEqual(7);
    expect(mean[channel]).toBeGreaterThanOrEqual(126.5);
    expect(mean[channel]).toBeLessThanOrEqual(129.5);
    const deviation = Math.sqrt(variance / 40000);
    expect(deviation).toBeGreaterThan(1);
    expect(deviation).toBeLessThan(8);
  }
});
test("F02 static accumulated frame preserves colour for 2, 4 and 8 samples", async ({ page }) => {
  await ready(page);
  const base = await background(page, { kind: "solid", color: "#3366CC" });
  const accumulated = await page.evaluate(() => {
    const engine = window.__labEngine;
    if (!engine) throw new Error("Engine unavailable");
    return [2, 4, 8].map((samples) => {
      engine.renderAccumulated(1, 0.2, samples);
      return { width: 1280, height: 720, data: engine.readPixels() };
    });
  });
  for (const frame of accumulated) {
    expectRgbNear(avgRegion(frame, 600, 320, 680, 400), [51, 102, 204], 1);
    expectRgbNear(avgRegion(frame, 600, 320, 680, 400), avgRegion(base, 600, 320, 680, 400), 1);
  }
});
test("F02 transition fade blends in linear light", async ({ page }) => {
  await ready(page);
  const pixels = await page.evaluate(async () => {
    const doc = structuredClone(window.__fixtures?.["device-card-frontal"]);
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    if (!doc || !engine || !setDoc) throw new Error("Fixture unavailable");
    doc.loop = false;
    doc.style.background = { kind: "solid", color: "#000000" };
    doc.style.grain = doc.style.vignette = 0;
    const shot = doc.shots[0];
    shot.layout = { kind: "title" };
    shot.texts = [];
    shot.duration = 2;
    doc.shots.push({
      ...structuredClone(shot),
      id: "white-shot",
      styleOverrides: { background: { kind: "solid", color: "#FFFFFF" } },
      transitionIn: { kind: "fade", duration: 1, easing: "linear" },
    });
    await setDoc(doc);
    engine.renderAt(1.5);
    return { width: 1280, height: 720, data: engine.readPixels() };
  });
  expectRgbNear(avgRegion(pixels, 600, 320, 680, 400), [188, 188, 188], 1);
});

for (const coverageOnly of [true, false]) {
  test(`F02 ${coverageOnly ? "coverage glyph" : "generic raster"} alpha plateaus composite without fringes`, async ({
    page,
  }) => {
    await ready(page);
    for (const [fg, bg] of [
      ["#FFFFFF", "#18191B"],
      ["#3366CC", "#F1EDE6"],
      ["#FFFFFF", "#F1EDE6"],
      ["#3366CC", "#18191B"],
    ]) {
      const frame = await page.evaluate(
        async ({ fg, bg, coverageOnly }) => {
          const doc = structuredClone(window.__fixtures?.["device-card-frontal"]);
          const engine = window.__labEngine;
          const setDoc = window.__labSetDoc;
          const provider = window.__createLabAssetProvider?.();
          if (!doc || !engine || !setDoc || !provider) throw new Error("Alpha fixture unavailable");
          doc.style.background = { kind: "solid", color: bg };
          doc.style.grain = doc.style.vignette = 0;
          doc.shots[0].layout = { kind: "title" };
          doc.shots[0].texts = [
            {
              id: "alpha-plateaus",
              text: "alpha",
              role: "title",
              font: "display",
              size: 20,
              anchor: "center",
              align: "center",
              color: fg,
              animation: "none",
              delay: 0,
            },
          ];
          const canvas = new OffscreenCanvas(200, 100);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Alpha canvas unavailable");
          for (let i = 0; i < 4; i++) {
            context.fillStyle = fg;
            context.globalAlpha = [64, 128, 192, 255][i] / 255;
            context.fillRect(i * 50, 0, 50, 100);
          }
          const bitmap = await createImageBitmap(canvas, { premultiplyAlpha: "premultiply" });
          await (
            setDoc as (
              doc: ProjectDoc,
              images: Record<string, ImageBitmap>,
              provider: AssetProvider,
            ) => Promise<void>
          )(
            doc,
            {},
            {
              ...provider,
              getText: async () => ({
                bitmap,
                width: 200,
                height: 100,
                words: [{ x: 0, y: 0, w: 200, h: 100 }],
                ...(coverageOnly ? { color: fg } : {}),
              }),
            },
          );
          engine.renderAt(0);
          return { width: 1280, height: 720, data: engine.readPixels() };
        },
        { fg, bg, coverageOnly },
      );
      const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const foreground = channels(fg);
      const backdrop = channels(bg);
      for (let i = 0; i < 4; i++) {
        const alpha = [64, 128, 192, 255][i] / 255;
        const expected = foreground.map((c, channel) =>
          encode(decode(c) * alpha + decode(backdrop[channel]) * (1 - alpha)),
        );
        expectRgbNear(avgRegion(frame, 563 + i * 50, 350, 567 + i * 50, 370), expected, 2);
      }
    }
  });
}

test("F02 dither stays below half an sRGB byte", async ({ page }) => {
  await ready(page);
  const frame = await background(page, { kind: "solid", color: "#808080" });
  const values = new Set<number>();
  for (let y = 260; y < 460; y++)
    for (let x = 540; x < 740; x++) values.add(frame.data[(y * 1280 + x) * 4]);
  // At an exact byte centre, bounded ±0.5 LSB cannot cross either rounding boundary.
  expect([...values]).toEqual([128]);
});

for (const [fg, bg, animation] of [
  ["#FFFFFF", "#18191B", "none"],
  ["#3366CC80", "#18191B", "none"],
  ["#3366CC", "#F1EDE6", "blurIn"],
] as const) {
  test(`F02 real glyph ${fg} on ${bg} ${animation} matches independent linear coverage oracle`, async ({
    page,
  }) => {
    await ready(page);
    const result = await page.evaluate(
      async ({ fg, bg, animation }) => {
        const doc = structuredClone(window.__fixtures?.["device-card-frontal"]);
        const engine = window.__labEngine;
        const setDoc = window.__labSetDoc;
        const provider = window.__createLabAssetProvider?.();
        if (!doc || !engine || !setDoc || !provider)
          throw new Error("Real glyph fixture unavailable");
        doc.loop = false;
        doc.style.background = { kind: "solid", color: bg };
        doc.style.grain = doc.style.vignette = 0;
        doc.style.fonts.display = { source: "builtin", family: "Inter Display", weight: 600 };
        const layer: ProjectDoc["shots"][number]["texts"][number] = {
          id: "real-glyph",
          text: "T",
          role: "title",
          font: "display",
          size: 20,
          anchor: "center",
          align: "center",
          color: fg,
          animation,
          delay: 0,
        };
        doc.shots[0].layout = { kind: "title" };
        doc.shots[0].texts = [layer];
        const raster = await provider.getText(layer, doc.style, 720);
        const canvas = new OffscreenCanvas(raster.width, raster.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Coverage readback unavailable");
        context.drawImage(raster.bitmap, 0, 0);
        const data = context.getImageData(0, 0, raster.width, raster.height).data;
        const alpha: number[] = [];
        for (let i = 3; i < data.length; i += 4) alpha.push(data[i] / 255);
        await (
          setDoc as (
            doc: ProjectDoc,
            images: Record<string, ImageBitmap>,
            provider: AssetProvider,
          ) => Promise<void>
        )(doc, {}, { ...provider, getText: async () => raster });
        const t = animation === "none" ? 1 : 0.12;
        engine.renderAt(t);
        return {
          doc,
          t,
          width: raster.width,
          height: raster.height,
          words: raster.words,
          alpha,
          color: raster.color,
          pixels: engine.readPixels(),
        };
      },
      { fg, bg, animation },
    );
    expect(result.color?.toLowerCase()).toBe(fg.slice(0, 7).toLowerCase());
    expectGlyphCompositing(result, fg, bg);
  });
}

test("F02 short phone screenshot bottom fill is sRGB exact", async ({ page }) => {
  await ready(page);
  const frame = await page.evaluate(async () => {
    const doc = structuredClone(window.__fixtures?.["device-phone-frontal"]);
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const images = window.__labTestImages;
    if (!doc || !engine || !setDoc || !images) throw new Error("Fill fixture unavailable");
    const id = "f02-short-phone";
    doc.shots[0].layout = { kind: "single", device: "phone", assetId: id };
    doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
    doc.style.grain = doc.style.vignette = 0;
    doc.assets.push({
      id,
      kind: "image",
      name: id,
      mime: "image/png",
      bytes: 1,
      width: 780,
      height: 100,
    });
    await setDoc(doc, { [id]: await images.bands(780, 100, ["#3366CC"]) });
    engine.renderAt(0);
    return { width: 1280, height: 720, data: engine.readPixels() };
  });
  expectRgbNear(avgRegion(frame, 630, 510, 650, 530), [51, 102, 204], 2);
});
