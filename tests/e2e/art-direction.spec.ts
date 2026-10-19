import { expect, test, type Page } from "@playwright/test";
import type { ProjectDoc } from "../../src/doc/types";
import type { AssetProvider } from "../../src/engine/Engine";
import { keepResourceTimings } from "../helpers/resource-timing";

// The specs below find the app's Mediabunny module in the resource-timing entries.
test.beforeEach(async ({ page }) => {
  await keepResourceTimings(page);
});

// Hooks are declared on Window in assets.spec.ts (dev /lab).

// The still page renders at pixel ratio 1 and supersample 1 with no playback loop, so the
// adaptive-quality drop of the interactive lab never changes the output mid-test.
async function openLab(page: Page) {
  await page.goto("/lab?still=1&fixture=single-browser&w=640&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
}

test.describe("F11 browser URL pill", () => {
  test("the URL is drawn centred inside the pill", async ({ page }) => {
    await openLab(page);
    const result = await page.evaluate(async () => {
      const base = window.__fixtures?.["single-browser"];
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      const images = window.__labTestImages;
      if (!base || !engine || !setDoc || !images) throw new Error("F11 hooks are unavailable");
      const width = 1920;
      const height = 1080;
      engine.resize(width, height);
      const doc = structuredClone(base);
      const id = doc.shots[0].layout.kind === "single" ? doc.shots[0].layout.assetId : "";
      doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
      doc.shots[0].entrance = "none";
      doc.style.grain = 0;
      doc.style.vignette = 0;
      doc.style.frameAppearance = "light";
      const bitmap = await images.bands(1600, 1000, ["#808080"]);
      const render = async (url: string) => {
        await setDoc(
          { ...structuredClone(doc), style: { ...doc.style, browserUrl: url } },
          {
            [id]: bitmap,
          },
        );
        engine.renderAt(1);
        return engine.readPixels().slice();
      };
      const without = await render("");
      const withUrl = await render("pill.example");
      let changed = 0;
      let darker = 0;
      let minX = width;
      let maxX = -1;
      let minY = height;
      let maxY = -1;
      for (let i = 0; i < without.length; i += 4) {
        const d = withUrl[i] - without[i];
        if (Math.abs(d) <= 2) continue;
        changed++;
        if (d < 0) darker++;
        const x = (i / 4) % width;
        const y = Math.floor(i / 4 / width);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      // The window top: the first row from the top that is not background in the centre column.
      const bg = without[(10 * width + width / 2) * 4];
      let windowTop = -1;
      for (let y = 0; y < height; y++) {
        if (Math.abs(without[(y * width + width / 2) * 4] - bg) > 6) {
          windowTop = y;
          break;
        }
      }
      return { changed, darker, minX, maxX, minY, maxY, windowTop, width };
    });
    // Glyphs: thousands of pixels at 1080p, darker than the pill (dark text on light chrome).
    expect(result.changed, "pixels the URL changes").toBeGreaterThan(400);
    expect(result.darker / result.changed).toBeGreaterThan(0.9);
    // Centred horizontally, and inside the toolbar band at the top of the window.
    const centre = (result.minX + result.maxX) / 2;
    expect(Math.abs(centre - result.width / 2), "horizontal centre offset in px").toBeLessThan(8);
    expect(result.maxX - result.minX, "text width in px").toBeLessThan(result.width * 0.34);
    expect(result.windowTop).toBeGreaterThan(0);
    expect(result.minY).toBeGreaterThan(result.windowTop);
    expect(result.maxY - result.windowTop, "text bottom within the toolbar").toBeLessThan(60);
  });

  test("a slower earlier setDocument cannot replace the newer URL raster", async ({ page }) => {
    await openLab(page);
    const result = await page.evaluate(async () => {
      const base = window.__fixtures?.["single-browser"];
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc as
        | ((
            doc: ProjectDoc,
            images: Record<string, ImageBitmap>,
            provider?: AssetProvider,
          ) => Promise<void>)
        | undefined;
      const createProvider = window.__createLabAssetProvider;
      const images = window.__labTestImages;
      if (!base || !engine || !setDoc || !createProvider || !images)
        throw new Error("F11 race hooks are unavailable");
      engine.resize(1280, 720);
      const id = base.shots[0].layout.kind === "single" ? base.shots[0].layout.assetId : "";
      const bitmap = await images.bands(1600, 1000, ["#808080"]);
      const provider = createProvider();
      const delayed: AssetProvider = {
        async getImage() {
          return bitmap;
        },
        async getText(layer, style, frameHeightPx) {
          if (layer.text === "old.example") await new Promise((r) => setTimeout(r, 300));
          return provider.getText(layer, style, frameHeightPx);
        },
      };
      const makeDoc = (url: string) => {
        const doc = structuredClone(base);
        doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
        doc.shots[0].entrance = "none";
        doc.style.grain = 0;
        doc.style.vignette = 0;
        doc.style.browserUrl = url;
        return doc;
      };
      // Two different documents (the old one has a different shot id) so nothing else is shared.
      const earlier = setDoc(makeDoc("old.example"), {}, delayed);
      const newer = setDoc(makeDoc("newer-site.example"), {}, delayed);
      await Promise.all([earlier, newer]);
      engine.renderAt(1);
      const raced = engine.readPixels().slice();
      await setDoc(makeDoc("newer-site.example"), { [id]: bitmap }, delayed);
      engine.renderAt(1);
      const clean = engine.readPixels().slice();
      await setDoc(makeDoc("old.example"), { [id]: bitmap }, delayed);
      engine.renderAt(1);
      const stale = engine.readPixels().slice();
      let racedVsClean = 0;
      let staleVsClean = 0;
      for (let i = 0; i < clean.length; i += 4) {
        if (Math.abs(raced[i] - clean[i]) > 2) racedVsClean++;
        if (Math.abs(stale[i] - clean[i]) > 2) staleVsClean++;
      }
      return { racedVsClean, staleVsClean };
    });
    expect(result.staleVsClean, "the two URLs render differently").toBeGreaterThan(100);
    expect(result.racedVsClean, "the raced frame matches the newer URL").toBe(0);
  });

  test("the URL is in the pill of an exported WebM frame", async ({ page }) => {
    // Rendering and encoding run in the export worker; the runner is ~5x slower than local.
    test.setTimeout(180_000);
    await openLab(page);
    const mediabunnyUrl = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .find((name) => new URL(name).pathname.endsWith("/deps/mediabunny.js")),
    );
    if (!mediabunnyUrl)
      throw new Error("Mediabunny's already-loaded browser module URL was not found");
    await page.evaluate(async (url) => {
      window.__mediabunnyTest = await import(url);
    }, mediabunnyUrl);
    const result = await page.evaluate(async () => {
      const base = window.__fixtures?.["single-browser"];
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      const createProvider = window.__createLabAssetProvider;
      const exportFn = window.__exportWithEngine;
      const media = window.__mediabunnyTest;
      const images = window.__labTestImages;
      if (!base || !engine || !setDoc || !createProvider || !exportFn || !media || !images)
        throw new Error("F11 export hooks are unavailable");
      const id = base.shots[0].layout.kind === "single" ? base.shots[0].layout.assetId : "";
      const doc = structuredClone(base);
      doc.shots = [
        {
          ...doc.shots[0],
          duration: 0.5,
          entrance: "none",
          camera: { preset: "static", intensity: 0, easing: "smooth", float: 0 },
        },
      ];
      doc.loop = false;
      doc.style.grain = 0;
      doc.style.vignette = 0;
      doc.style.frameAppearance = "light";
      doc.style.browserUrl = "pill.example";
      const bitmap = await images.bands(1600, 1000, ["#808080"]);

      // Where the text is: the pixels the URL changes in a preview render of this frame.
      const width = 1280;
      const height = 720;
      engine.resize(width, height);
      await setDoc(
        { ...structuredClone(doc), style: { ...doc.style, browserUrl: "" } },
        {
          [id]: bitmap,
        },
      );
      engine.renderAt(0);
      const without = engine.readPixels().slice();
      await setDoc(structuredClone(doc), { [id]: bitmap });
      engine.renderAt(0);
      const withUrl = engine.readPixels().slice();
      const textPixels: number[] = [];
      for (let i = 0; i < without.length; i += 4) {
        if (without[i] - withUrl[i] > 40) textPixels.push(i);
      }

      const baseProvider = createProvider();
      const provider: AssetProvider = {
        async getImage(assetId, maxWidth) {
          return assetId === id
            ? createImageBitmap(bitmap)
            : baseProvider.getImage(assetId, maxWidth);
        },
        getText: baseProvider.getText.bind(baseProvider),
      };
      const exported = await exportFn(doc, provider, {
        destination: "custom",
        resolution: 720,
        fps: 24,
        quality: "high",
        format: "webm",
        supersample: 1,
        motionBlur: false,
      });
      const input = new media.Input({
        source: new media.BlobSource(exported.blob),
        formats: media.ALL_FORMATS,
      });
      const track = await input.getPrimaryVideoTrack();
      if (!track) throw new Error("The exported WebM has no video track");
      const wrapped = await new media.CanvasSink(track).getCanvas(0);
      if (!wrapped) throw new Error("Could not decode the exported WebM at 0 s");
      const context = wrapped.canvas.getContext("2d");
      if (!context) throw new Error("The decoded frame has no 2D context");
      if (wrapped.canvas.width !== width || wrapped.canvas.height !== height)
        throw new Error(`Exported ${wrapped.canvas.width}x${wrapped.canvas.height}`);
      const frame = context.getImageData(0, 0, width, height).data;
      input.dispose();
      // In the export, the same pixels are as dark as the text, not the pill.
      let textLike = 0;
      for (const i of textPixels) if (without[i] - frame[i] > 20) textLike++;
      return { textPixels: textPixels.length, textLike };
    });
    expect(result.textPixels, "text pixels in the preview").toBeGreaterThan(150);
    expect(result.textLike / result.textPixels, "share of them dark in the export").toBeGreaterThan(
      0.8,
    );
  });
});

test.describe("F11 screens and grain", () => {
  test("screen targets render at 2x so mid-frequency detail stays sharp", async ({ page }) => {
    await openLab(page);
    const gradient = await page.evaluate(async () => {
      const base = window.__fixtures?.["single-browser"];
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      if (!base || !engine || !setDoc) throw new Error("F11 hooks are unavailable");
      const width = 1200;
      const height = 675;
      engine.resize(width, height);
      // 3 px black / 3 px white columns: about 3 output px per period on screen, the band where
      // a 1x target's resampling visibly softens text (F03).
      const canvas = new OffscreenCanvas(1600, 1000);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("2D canvas context unavailable");
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, 1600, 1000);
      context.fillStyle = "#000000";
      for (let x = 0; x < 1600; x += 6) context.fillRect(x, 0, 3, 1000);
      const bitmap = await createImageBitmap(canvas);
      const id = "f11-stripes";
      const doc = structuredClone(base);
      doc.assets = [
        { id, kind: "image", name: id, mime: "image/png", bytes: 1, width: 1600, height: 1000 },
      ];
      doc.shots[0].layout = { kind: "single", device: "browser", assetId: id };
      doc.shots[0].camera = { preset: "static", intensity: 1, easing: "smooth", float: 0 };
      doc.shots[0].entrance = "none";
      doc.style.grain = 0;
      doc.style.vignette = 0;
      await setDoc(doc, { [id]: bitmap });
      engine.renderAt(2.5);
      const px = engine.readPixels();
      let sum = 0;
      let n = 0;
      for (let y = Math.round(height * 0.45); y < Math.round(height * 0.55); y++) {
        for (let x = Math.round(width * 0.35); x < Math.round(width * 0.65); x++) {
          sum += Math.abs(px[(y * width + x + 1) * 4] - px[(y * width + x) * 4]);
          n++;
        }
      }
      return sum / n;
    });
    // Measured on SwiftShader: 134 with 2x screen targets, 86 with 1x.
    expect(gradient, "mean |dI/dx| over the stripes").toBeGreaterThan(110);
  });

  test("grain is zero-mean across a 1080x1920 frame", async ({ page }) => {
    await openLab(page);
    const cells = await page.evaluate(async () => {
      const base = window.__fixtures?.["single-browser"];
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      if (!base || !engine || !setDoc) throw new Error("F11 hooks are unavailable");
      const width = 1080;
      const height = 1920;
      engine.resize(width, height);
      const doc = structuredClone(base);
      doc.aspect = "9:16";
      doc.shots = [{ ...doc.shots[0], layout: { kind: "title" }, texts: [] }];
      doc.style.background = { kind: "solid", color: "#404040" };
      doc.style.vignette = 0;
      const means = async (grain: number) => {
        await setDoc({ ...structuredClone(doc), style: { ...doc.style, grain } });
        engine.renderAt(1.3);
        const px = engine.readPixels();
        const out: number[] = [];
        for (let cy = 0; cy < 8; cy++) {
          for (let cx = 0; cx < 4; cx++) {
            let sum = 0;
            let n = 0;
            for (let y = (cy * height) / 8; y < ((cy + 1) * height) / 8; y++) {
              for (let x = (cx * width) / 4; x < ((cx + 1) * width) / 4; x++) {
                sum += px[(y * width + x) * 4];
                n++;
              }
            }
            out.push(sum / n);
          }
        }
        return out;
      };
      return { flat: await means(0), grain: await means(0.25) };
    });
    // Each cell is 135x240 px; grain at 2.5% peak averages to within a fraction of a level.
    cells.grain.forEach((mean, i) => {
      expect(Math.abs(mean - cells.flat[i]), `cell ${i}: ${mean} vs ${cells.flat[i]}`).toBeLessThan(
        0.35,
      );
    });
  });
});
