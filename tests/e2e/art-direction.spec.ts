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

test.describe("F11 ambient background", () => {
  test("the ambient background is blurred, keeps its colours and is cover-fit", async ({
    page,
  }) => {
    await openLab(page);
    const result = await page.evaluate(async () => {
      const base = window.__fixtures?.["single-browser"];
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      if (!base || !engine || !setDoc) throw new Error("F11 ambient hooks are unavailable");
      engine.resize(640, 360);
      // Red | green | blue thirds (25% / 50% / 25%) under a fine black checker.
      const canvas = new OffscreenCanvas(1600, 1000);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("2D canvas context unavailable");
      context.fillStyle = "#FF0000";
      context.fillRect(0, 0, 400, 1000);
      context.fillStyle = "#00FF00";
      context.fillRect(400, 0, 800, 1000);
      context.fillStyle = "#0000FF";
      context.fillRect(1200, 0, 400, 1000);
      context.fillStyle = "#000000";
      for (let y = 0; y < 1000; y += 40) {
        for (let x = (y / 40) % 2 === 0 ? 0 : 40; x < 1600; x += 80) context.fillRect(x, y, 40, 40);
      }
      const bitmap = await createImageBitmap(canvas);
      const id = "f11-ambient";
      const doc = structuredClone(base);
      doc.assets = [
        { id, kind: "image", name: id, mime: "image/png", bytes: 1, width: 1600, height: 1000 },
      ];
      doc.shots = [{ ...doc.shots[0], layout: { kind: "title" }, texts: [] }];
      doc.style.background = { kind: "ambient", assetId: id, blur: 1, dim: 0 };
      doc.style.grain = 0;
      doc.style.vignette = 0;

      const measure = async (aspect: ProjectDoc["aspect"], width: number, height: number) => {
        engine.resize(width, height);
        await setDoc({ ...structuredClone(doc), aspect }, { [id]: bitmap });
        engine.renderAt(1);
        const px = engine.readPixels();
        let energy = 0;
        let samples = 0;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width - 1; x++) {
            const i = (y * width + x) * 4;
            for (let c = 0; c < 3; c++) energy += Math.abs(px[i + 4 + c] - px[i + c]);
            samples++;
          }
        }
        const mean = (x0: number, x1: number) => {
          const sum = [0, 0, 0];
          let n = 0;
          for (let y = Math.round(height * 0.4); y < Math.round(height * 0.6); y++) {
            for (let x = Math.round(width * x0); x < Math.round(width * x1); x++) {
              const i = (y * width + x) * 4;
              for (let c = 0; c < 3; c++) sum[c] += px[i + c];
              n++;
            }
          }
          return sum.map((s) => s / n);
        };
        return {
          energy: energy / samples,
          left: mean(0, 0.04),
          centre: mean(0.48, 0.52),
          right: mean(0.96, 1),
        };
      };
      return {
        wide: await measure("16:9", 640, 360),
        tall: await measure("9:16", 360, 640),
      };
    });

    // Cover-fit at 9:16 shows only the middle ~35% of the width: the green band reaches
    // both edges. Stretched, the edges would be red and blue.
    for (const side of ["left", "right"] as const) {
      const [r, g, b] = result.tall[side];
      expect(g, `9:16 ${side} edge is green (${r}, ${g}, ${b})`).toBeGreaterThan(
        Math.max(r, b) + 40,
      );
    }
    // The checker is 40 px in the source: unblurred it is 30+ levels per pixel step.
    expect(result.wide.energy, "16:9 mean |dI/dx| per channel").toBeLessThan(1.5);
    expect(result.tall.energy, "9:16 mean |dI/dx| per channel").toBeLessThan(1.5);
    // Blurred, not a flat fallback: red on the left, blue on the right at 16:9.
    expect(result.wide.left[0], "16:9 left edge is red").toBeGreaterThan(result.wide.left[2] + 40);
    expect(result.wide.right[2], "16:9 right edge is blue").toBeGreaterThan(
      result.wide.right[0] + 40,
    );
    expect(result.wide.centre[1], "16:9 centre is green").toBeGreaterThan(
      result.wide.centre[0] + 40,
    );
  });

  test("the ambient background uses only the screenshot's first viewport", async ({ page }) => {
    await openLab(page);
    const means = await page.evaluate(async () => {
      const base = window.__fixtures?.["single-browser"];
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      if (!base || !engine || !setDoc) throw new Error("F11 ambient hooks are unavailable");
      engine.resize(640, 360);
      // A tall page: the first 900 px (one 1440x900 viewport) green, the rest red.
      const canvas = new OffscreenCanvas(1440, 4000);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("2D canvas context unavailable");
      context.fillStyle = "#FF0000";
      context.fillRect(0, 0, 1440, 4000);
      context.fillStyle = "#00FF00";
      context.fillRect(0, 0, 1440, 900);
      const bitmap = await createImageBitmap(canvas);
      const id = "f11-tall";
      const doc = structuredClone(base);
      doc.assets = [
        { id, kind: "image", name: id, mime: "image/png", bytes: 1, width: 1440, height: 4000 },
      ];
      doc.shots = [{ ...doc.shots[0], layout: { kind: "title" }, texts: [] }];
      doc.style.background = { kind: "ambient", assetId: id, blur: 1, dim: 0 };
      doc.style.grain = 0;
      doc.style.vignette = 0;
      await setDoc(doc, { [id]: bitmap });
      engine.renderAt(1);
      const px = engine.readPixels();
      let red = 0;
      let green = 0;
      for (let i = 0; i < px.length; i += 4) {
        red += px[i];
        green += px[i + 1];
      }
      const n = px.length / 4;
      return { red: red / n, green: green / n };
    });
    expect(means.green, JSON.stringify(means)).toBeGreaterThan(200);
    expect(means.red, JSON.stringify(means)).toBeLessThan(40);
  });

  test("image backgrounds are cover-fit at all five aspects", async ({ page }) => {
    await openLab(page);
    const ratios = await page.evaluate(async () => {
      const base = window.__fixtures?.["single-browser"];
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      if (!base || !engine || !setDoc) throw new Error("F11 image hooks are unavailable");
      // A black 300x300 square centred on white, in a 1600x1000 image.
      const canvas = new OffscreenCanvas(1600, 1000);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("2D canvas context unavailable");
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, 1600, 1000);
      context.fillStyle = "#000000";
      context.fillRect(650, 350, 300, 300);
      const bitmap = await createImageBitmap(canvas);
      const id = "f11-square";
      const sizes: Record<ProjectDoc["aspect"], [number, number]> = {
        "16:9": [640, 360],
        "9:16": [360, 640],
        "1:1": [480, 480],
        "4:5": [400, 500],
        "4:3": [560, 420],
      };
      const out: Record<string, number> = {};
      for (const [aspect, [width, height]] of Object.entries(sizes)) {
        const doc = structuredClone(base);
        doc.aspect = aspect as ProjectDoc["aspect"];
        doc.assets = [
          { id, kind: "image", name: id, mime: "image/png", bytes: 1, width: 1600, height: 1000 },
        ];
        doc.shots = [{ ...doc.shots[0], layout: { kind: "title" }, texts: [] }];
        doc.style.background = { kind: "image", assetId: id, dim: 0 };
        doc.style.grain = 0;
        doc.style.vignette = 0;
        engine.resize(width, height);
        await setDoc(doc, { [id]: bitmap });
        engine.renderAt(1);
        const px = engine.readPixels();
        let minX = width;
        let maxX = -1;
        let minY = height;
        let maxY = -1;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (px[(y * width + x) * 4] < 128) {
              minX = Math.min(minX, x);
              maxX = Math.max(maxX, x);
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
            }
          }
        }
        if (maxX < 0) throw new Error(`${aspect}: the square is not in the frame`);
        out[aspect] = (maxX - minX + 1) / (maxY - minY + 1);
      }
      return out;
    });
    for (const [aspect, ratio] of Object.entries(ratios)) {
      expect(ratio, `${aspect}: the square's width / height`).toBeGreaterThan(0.95);
      expect(ratio, `${aspect}: the square's width / height`).toBeLessThan(1.05);
    }
  });

  test("rendering an ambient background allocates no GPU objects per frame", async ({ page }) => {
    await openLab(page);
    const counts = await page.evaluate(async () => {
      const base = window.__fixtures?.["single-browser"];
      const engine = window.__labEngine;
      const setDoc = window.__labSetDoc;
      const images = window.__labTestImages;
      if (!base || !engine || !setDoc || !images) throw new Error("F11 hooks are unavailable");
      engine.resize(640, 360);
      const doc = structuredClone(base);
      const id = doc.shots[0].layout.kind === "single" ? doc.shots[0].layout.assetId : "";
      doc.style.background = { kind: "ambient", assetId: id, blur: 1, dim: 0.35 };
      await setDoc(doc, { [id]: await images.quadrants(1600, 1000) });
      // The engine's renderer is private; the context is reached through the canvas.
      const renderer = (engine as unknown as { renderer: { getContext(): WebGL2RenderingContext } })
        .renderer;
      const gl = renderer.getContext();
      const created = { texture: 0, framebuffer: 0, renderbuffer: 0, buffer: 0 };
      const originals = {
        createTexture: gl.createTexture,
        createFramebuffer: gl.createFramebuffer,
        createRenderbuffer: gl.createRenderbuffer,
        createBuffer: gl.createBuffer,
      };
      gl.createTexture = function () {
        created.texture++;
        return originals.createTexture.call(gl);
      };
      gl.createFramebuffer = function () {
        created.framebuffer++;
        return originals.createFramebuffer.call(gl);
      };
      gl.createRenderbuffer = function () {
        created.renderbuffer++;
        return originals.createRenderbuffer.call(gl);
      };
      gl.createBuffer = function () {
        created.buffer++;
        return originals.createBuffer.call(gl);
      };
      const before = engine.getMemoryInfo();
      try {
        for (let frame = 0; frame < 60; frame++) engine.renderAt(frame / 10);
      } finally {
        Object.assign(gl, originals);
      }
      return { created, before, after: engine.getMemoryInfo() };
    });
    expect(counts.created, "WebGL objects created during 60 frames").toEqual({
      texture: 0,
      framebuffer: 0,
      renderbuffer: 0,
      buffer: 0,
    });
    expect(counts.after).toEqual(counts.before);
  });
});

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
