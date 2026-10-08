import { expect, test } from "@playwright/test";
import type { ProjectDoc } from "../../src/doc/types";
import type { AssetProvider, Engine, TextRaster } from "../../src/engine/Engine";
import type { exportWithEngine } from "../../src/export/engine-export";
import type { schedule } from "../../src/motion";
import { keepResourceTimings } from "../helpers/resource-timing";

// The specs below find the app's Mediabunny module in the resource-timing entries.
test.beforeEach(async ({ page }) => {
  await keepResourceTimings(page);
});

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
    __createLabAssetProvider?: () => AssetProvider;
    __exportWithEngine?: typeof exportWithEngine;
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
    __labSchedule?: typeof schedule;
  }
}

// ScreenCompositor's empty-state fill, #18181B.
const EMPTY_FILL = [0x18, 0x18, 0x1b];

test("F03: every built-in template loads a texture for every screen", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
  const results = await page.evaluate(async () => {
    const fixtures = window.__fixtures;
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const scheduleDoc = window.__labSchedule;
    if (!fixtures || !engine || !setDoc || !scheduleDoc)
      throw new Error("F03 template fixture hooks are unavailable");
    engine.resize(640, 360);
    const ids = Object.keys(fixtures)
      .filter((key) => key.startsWith("template-"))
      .map((key) => key.slice("template-".length));
    const out = [];
    for (const id of ids) {
      const doc = fixtures[id];
      await setDoc(doc);
      engine.renderAt(scheduleDoc(doc).total * 0.5);
      const nodes = engine.debugInfo().nodes;
      out.push({
        id,
        nodes: nodes.length,
        unloaded: nodes.filter((n) => n.assetId && !n.textureLoaded).map((n) => n.id),
      });
    }
    return out;
  });
  expect(results.length, "all 7 built-in templates are lab fixtures").toBe(7);
  expect(
    results.filter((result) => result.nodes === 0).map((result) => result.id),
    "templates that draw no devices at 50%",
  ).toEqual([]);
  expect(
    results
      .filter((result) => result.unloaded.length > 0)
      .map(
        (result) =>
          `${result.id}: ${result.unloaded.length} of ${result.nodes} (${result.unloaded[0]}, …)`,
      ),
    "screens drawn without a texture",
  ).toEqual([]);
});

test("F03: a pair shows screenshots in both the browser and the phone", async ({ page }) => {
  await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
  const centres = await page.evaluate(async () => {
    const doc = window.__fixtures?.["pair"];
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    const scheduleDoc = window.__labSchedule;
    if (!doc || !engine || !setDoc || !scheduleDoc)
      throw new Error("F03 pair fixture hooks are unavailable");
    const width = 640;
    const height = 360;
    engine.resize(width, height);
    await setDoc(doc);
    engine.renderAt(scheduleDoc(doc).total * 0.5);
    const pixels = engine.readPixels();
    // Find each device's footprint with pick(), then sample a 5x5 patch at its centroid.
    const sums: Record<string, { x: number; y: number; n: number }> = {};
    for (let y = 2; y < height; y += 4) {
      for (let x = 2; x < width; x += 4) {
        const hit = engine.pick(x, y);
        if (!hit) continue;
        const sum = sums[hit.nodeId] ?? { x: 0, y: 0, n: 0 };
        sum.x += x;
        sum.y += y;
        sum.n++;
        sums[hit.nodeId] = sum;
      }
    }
    return Object.fromEntries(
      Object.entries(sums).map(([nodeId, sum]) => {
        const cx = Math.round(sum.x / sum.n);
        const cy = Math.round(sum.y / sum.n);
        const mean = [0, 0, 0];
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const i = ((cy + dy) * width + (cx + dx)) * 4;
            for (let c = 0; c < 3; c++) mean[c] += pixels[i + c] / 25;
          }
        }
        return [nodeId, { cx, cy, mean: mean.map(Math.round) }];
      }),
    );
  });
  expect(Object.keys(centres).sort()).toEqual(["pair:desktop", "pair:mobile"]);
  for (const [nodeId, centre] of Object.entries(centres)) {
    const distance = Math.max(...centre.mean.map((value, c) => Math.abs(value - EMPTY_FILL[c])));
    expect(
      distance,
      `${nodeId} centre (${centre.cx}, ${centre.cy}) is rgb(${centre.mean.join(", ")}), not the empty fill`,
    ).toBeGreaterThan(24);
  }
});

test("F03: alternating a single browser and isometric-wall keeps GPU memory flat", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
  const counts = await page.evaluate(async () => {
    const fixtures = window.__fixtures;
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    if (!fixtures?.["single-browser"] || !fixtures["isometric-wall"] || !engine || !setDoc)
      throw new Error("F03 memory fixture hooks are unavailable");
    engine.resize(640, 360);
    const docs = [fixtures["single-browser"], fixtures["isometric-wall"]];
    const snapshots = [];
    for (let cycle = 1; cycle <= 20; cycle++) {
      await setDoc(docs[(cycle - 1) % 2]);
      const info = engine.debugInfo();
      snapshots.push({ textures: info.textures, geometries: info.geometries });
    }
    return { second: snapshots[1], twentieth: snapshots[19], all: snapshots };
  });
  expect(counts.twentieth, JSON.stringify(counts.all)).toEqual(counts.second);
});

test("F03: a slower earlier setDocument never replaces the newer document's devices", async ({
  page,
}) => {
  await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
  const nodeIds = await page.evaluate(async () => {
    const fixtures = window.__fixtures;
    const engine = window.__labEngine;
    const createProvider = window.__createLabAssetProvider;
    if (!fixtures?.["isometric-wall"] || !fixtures["single-browser"] || !engine || !createProvider)
      throw new Error("F03 race fixture hooks are unavailable");
    engine.resize(640, 360);
    const provider = createProvider();
    const slow: AssetProvider = {
      async getImage(id, width) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return provider.getImage(id, width);
      },
      getText: provider.getText.bind(provider),
    };
    const older = engine.setDocument(fixtures["isometric-wall"], slow);
    const newer = engine.setDocument(fixtures["single-browser"], provider);
    await Promise.all([older, newer]);
    engine.renderAt(1);
    return engine.debugInfo().nodes.map((n) => n.id);
  });
  expect(nodeIds, "the single browser, none of isometric-wall's tiles").toEqual(["single:0"]);
});

test("F03: pair layouts preload both screen assets", async ({ page }) => {
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
    const desktopBitmap = await images.bands(1600, 1000, ["#FF0000"]);
    const mobileBitmap = await images.bands(780, 1688, ["#00FF00"]);
    await setDoc(doc, { [desktopId]: desktopBitmap, [mobileId]: mobileBitmap });
    engine.renderAt(2.5);
    const pixels = engine.readPixels();
    let red = 0;
    let green = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 180 && pixels[i + 1] < 100 && pixels[i + 2] < 100) red++;
      if (pixels[i + 1] > 180 && pixels[i] < 100 && pixels[i + 2] < 100) green++;
    }
    return { red, green };
  });
  expect(greenPixels.red, "desktop screen should show its independent red source").toBeGreaterThan(
    100,
  );
  expect(
    greenPixels.green,
    "phone screen should show its independent green source",
  ).toBeGreaterThan(100);
});

test("F03: every multi-asset layout requests each independent image", async ({ page }) => {
  await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
  const missing = await page.evaluate(async () => {
    const base = window.__fixtures?.["card-hero"];
    const engine = window.__labEngine;
    const images = window.__labTestImages;
    const createProvider = window.__createLabAssetProvider;
    if (!base || !engine || !images || !createProvider)
      throw new Error("F03 multi-layout fixture hooks are unavailable");
    engine.resize(1280, 720);
    const layouts = [
      { kind: "pair", desktopId: "pair-desktop", mobileId: "pair-mobile", arrangement: "overlap" },
      { kind: "trio", desktopId: "trio-desktop", tabletId: "trio-tablet", mobileId: "trio-mobile" },
      {
        kind: "rows",
        assetIds: ["rows-a", "rows-b", "rows-c"],
        rows: 2,
        device: "browser",
        tilt: 0,
        speed: 0,
      },
      {
        kind: "columns",
        assetIds: ["columns-a", "columns-b", "columns-c"],
        columns: 3,
        tilt: 0,
        speed: 0,
      },
      { kind: "wall", assetIds: ["wall-a", "wall-b", "wall-c"], columns: 3, speed: 0 },
      { kind: "stack", assetIds: ["stack-a", "stack-b", "stack-c"], device: "browser", spread: 0 },
    ] as const;
    const missing: string[] = [];
    for (const layout of layouts) {
      const doc = structuredClone(base);
      const ids: string[] =
        "assetIds" in layout
          ? [...layout.assetIds]
          : layout.kind === "pair"
            ? [layout.desktopId, layout.mobileId]
            : [layout.desktopId, layout.tabletId, layout.mobileId];
      doc.shots[0].layout = layout as (typeof doc.shots)[number]["layout"];
      doc.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
      doc.style.background = { kind: "solid", color: "#808080" };
      doc.style.grain = 0;
      doc.style.vignette = 0;
      doc.assets = ids.map((id) => ({
        id,
        kind: "image" as const,
        name: id,
        mime: "image/png",
        bytes: 1,
        width: 1200,
        height: 900,
      }));
      const bitmapById = Object.fromEntries(
        await Promise.all(
          ids.map(async (id) => [id, await images.bands(1200, 900, ["#00FF00"])] as const),
        ),
      );
      const requested = new Set<string>();
      const provider = createProvider();
      await engine.setDocument(doc, {
        async getImage(id, width) {
          requested.add(id);
          return bitmapById[id] ?? provider.getImage(id, width);
        },
        getText: provider.getText.bind(provider),
        getAudio: provider.getAudio?.bind(provider),
      });
      engine.renderAt(3);
      missing.push(...ids.filter((id) => !requested.has(id)).map((id) => `${layout.kind}:${id}`));
    }
    return missing;
  });
  expect(missing, "every layout asset must be loaded before rendering").toEqual([]);
});

test("F03: a slower earlier setDocument cannot replace the newer text raster", async ({ page }) => {
  await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
  const textColors = await page.evaluate(async () => {
    const base = window.__fixtures?.["card-hero"];
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc as
      | ((
          doc: ProjectDoc,
          images: Record<string, ImageBitmap>,
          provider: AssetProvider,
        ) => Promise<void>)
      | undefined;
    const createProvider = window.__createLabAssetProvider;
    if (!base || !engine || !setDoc || !createProvider)
      throw new Error("F03 race fixture hooks are unavailable");
    engine.resize(640, 360);
    const provider = createProvider();
    const makeDoc = (text: string, color: string) => {
      const doc = structuredClone(base);
      doc.shots[0].layout = { kind: "title" };
      doc.shots[0].texts = [
        {
          id: "f03-race-shared-layer",
          text,
          role: "title",
          font: "display",
          size: 20,
          anchor: "center",
          align: "center",
          color,
          animation: "none",
          delay: 0,
        },
      ];
      doc.style.background = { kind: "solid", color: "#808080" };
      doc.style.grain = 0;
      doc.style.vignette = 0;
      return doc;
    };
    const delayedProvider: AssetProvider = {
      getImage: provider.getImage.bind(provider),
      async getText(layer, style, frameHeightPx): Promise<TextRaster> {
        if (layer.text === "OLD") await new Promise((resolve) => setTimeout(resolve, 300));
        return provider.getText(layer, style, frameHeightPx);
      },
    };
    const earlier = setDoc(makeDoc("OLD", "#FF0000"), {}, delayedProvider);
    const newer = setDoc(makeDoc("NEW", "#00FF00"), {}, delayedProvider);
    await Promise.all([earlier, newer]);
    engine.renderAt(0);
    const pixels = engine.readPixels();
    let red = 0;
    let green = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 150 && pixels[i + 1] < 100 && pixels[i + 2] < 100) red++;
      if (pixels[i + 1] > 150 && pixels[i] < 100 && pixels[i + 2] < 100) green++;
    }
    return { red, green };
  });
  expect(
    textColors.green,
    "the final frame should use the newer green text raster",
  ).toBeGreaterThan(20);
  expect(textColors.red, "the final frame must not use the stale red text raster").toBe(0);
});

test("F03: a pair's WebM export contains both screen assets", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
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
  const colors = await page.evaluate(async () => {
    const base = window.__fixtures?.["card-hero"];
    const images = window.__labTestImages;
    const createProvider = window.__createLabAssetProvider;
    const exportFn = window.__exportWithEngine;
    const media = window.__mediabunnyTest;
    if (!base || !images || !createProvider || !exportFn || !media) {
      const missing = Object.entries({ base, images, createProvider, exportFn, media })
        .filter(([, value]) => !value)
        .map(([name]) => name);
      throw new Error(`F03 export fixture hooks are unavailable: ${missing.join(", ")}`);
    }
    const doc = structuredClone(base);
    const desktopId = "f03-export-desktop";
    const mobileId = "f03-export-mobile";
    doc.aspect = "16:9";
    doc.assets = [
      {
        id: desktopId,
        kind: "image",
        name: desktopId,
        mime: "image/png",
        bytes: 1,
        width: 640,
        height: 360,
      },
      {
        id: mobileId,
        kind: "image",
        name: mobileId,
        mime: "image/png",
        bytes: 1,
        width: 360,
        height: 780,
      },
    ];
    doc.shots = [
      {
        ...doc.shots[0],
        duration: 1,
        layout: { kind: "pair", desktopId, mobileId, arrangement: "overlap" },
        camera: { preset: "static", intensity: 0, easing: "smooth", float: 0 },
      },
    ];
    doc.style.background = { kind: "solid", color: "#808080" };
    doc.style.grain = 0;
    doc.style.vignette = 0;
    const bitmaps: Record<string, ImageBitmap> = {
      [desktopId]: await images.bands(640, 360, ["#FF0000"]),
      [mobileId]: await images.bands(360, 780, ["#00FF00"]),
    };
    const baseProvider = createProvider();
    const provider: AssetProvider = {
      async getImage(id, maxWidth) {
        return bitmaps[id] ?? baseProvider.getImage(id, maxWidth);
      },
      getText: baseProvider.getText.bind(baseProvider),
      getAudio: baseProvider.getAudio?.bind(baseProvider),
    };
    const result = await exportFn(doc, provider, {
      destination: "custom",
      resolution: 360,
      fps: 30,
      quality: "web",
      format: "webm",
      supersample: 1,
      motionBlur: false,
    });
    const input = new media.Input({
      source: new media.BlobSource(result.blob),
      formats: media.ALL_FORMATS,
    });
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("Exported WebM has no video track");
    const sink = new media.CanvasSink(track);
    const wrapped = await sink.getCanvas(0.5);
    if (!wrapped) throw new Error("Could not decode the exported WebM at 0.5 seconds");
    const context = wrapped.canvas.getContext("2d");
    if (!context) throw new Error("Decoded WebM canvas has no 2D context");
    const pixels = context.getImageData(0, 0, wrapped.canvas.width, wrapped.canvas.height).data;
    let red = 0;
    let green = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 180 && pixels[i + 1] < 100 && pixels[i + 2] < 100) red++;
      if (pixels[i + 1] > 180 && pixels[i] < 100 && pixels[i + 2] < 100) green++;
    }
    input.dispose();
    return { red, green, mime: result.mime, bytes: result.blob.size };
  });
  expect(colors.mime).toBe("video/webm");
  expect(colors.bytes).toBeGreaterThan(1000);
  expect(colors.red, "exported desktop screen should retain its red image").toBeGreaterThan(100);
  expect(colors.green, "exported phone screen should retain its green image").toBeGreaterThan(100);
});

test("F03: alternating documents releases old textures", async ({ page }) => {
  test.setTimeout(120_000);
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
      // F11: the asset also feeds a blurred ambient background, whose cached render
      // target must be released with it.
      doc.style.background = { kind: "ambient", assetId, blur: 1, dim: 0.35 };
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

test("F03: setDocument keeps devices whose node and frame style are unchanged", async ({
  page,
}) => {
  await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
  const built = await page.evaluate(async () => {
    const base = window.__fixtures?.["pair"];
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    if (!base || !engine || !setDoc) throw new Error("F03 diffing fixture hooks are unavailable");
    engine.resize(640, 360);
    const doc = structuredClone(base);
    await setDoc(doc);
    const initial = engine.debugInfo().devicesBuilt;
    // Background, grain and text do not change any device.
    doc.style.background = { kind: "solid", color: "#808080" };
    doc.style.grain = 0;
    await setDoc(structuredClone(doc));
    const afterBackground = engine.debugInfo().devicesBuilt;
    // Browser chrome is part of the browser's key, so only the browser is rebuilt.
    doc.style.browserChrome = doc.style.browserChrome === "minimal" ? "standard" : "minimal";
    await setDoc(structuredClone(doc));
    const afterChrome = engine.debugInfo().devicesBuilt;
    return { initial, afterBackground, afterChrome };
  });
  expect(built.initial).toBeGreaterThan(0);
  expect(built.afterBackground, "a background change rebuilds no device").toBe(built.initial);
  const rebuilt = built.afterChrome - built.afterBackground;
  expect(rebuilt, "a chrome change rebuilds the browser").toBeGreaterThan(0);
  expect(rebuilt, "a chrome change keeps the phone").toBeLessThan(built.initial);
});

test("F03: text textures are released when their layers go away", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
  const counts = await page.evaluate(async () => {
    const base = window.__fixtures?.["text-title"];
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    if (!base || !engine || !setDoc) throw new Error("F03 text fixture hooks are unavailable");
    engine.resize(640, 360);
    const snapshots = [];
    for (let cycle = 1; cycle <= 20; cycle++) {
      const doc = structuredClone(base);
      doc.shots[0].texts = doc.shots[0].texts.map((layer) => ({
        ...layer,
        id: `${layer.id}-${cycle}`,
        text: `${layer.text} ${cycle}`,
      }));
      await setDoc(doc);
      // Text fades in from t = 0; render while it is visible so its texture uploads.
      engine.renderAt(2.5);
      snapshots.push(engine.debugInfo().textures);
    }
    return snapshots;
  });
  expect(counts[19], JSON.stringify(counts)).toBe(counts[1]);
});

test("F03: devices whose key disappears are disposed", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
  const counts = await page.evaluate(async () => {
    const base = window.__fixtures?.["single-browser"];
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    if (!base || !engine || !setDoc) throw new Error("F03 device fixture hooks are unavailable");
    engine.resize(640, 360);
    const snapshots = [];
    for (let cycle = 1; cycle <= 20; cycle++) {
      // The URL is part of the browser's device key, so every cycle needs a new device.
      // F11: it is also a new URL raster, whose texture must be released.
      const doc = structuredClone(base);
      doc.style.browserUrl = `site-${cycle}.example`;
      await setDoc(doc);
      const info = engine.debugInfo();
      snapshots.push({
        geometries: info.geometries,
        textures: info.textures,
        built: info.devicesBuilt,
      });
    }
    return snapshots;
  });
  expect(counts[19].built, "each cycle built a new browser").toBeGreaterThan(counts[1].built);
  expect(counts[19].geometries, JSON.stringify(counts)).toBe(counts[1].geometries);
  expect(counts[19].textures, JSON.stringify(counts)).toBe(counts[1].textures);
});
