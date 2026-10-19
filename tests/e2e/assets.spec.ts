import { expect, test } from "@playwright/test";
import type { ProjectDoc } from "../../src/doc/types";
import { BUILTIN_TEMPLATES } from "../../src/templates";
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
    __editorEngine?: Engine;
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
  expect(results.length, "every built-in template is a lab fixture").toBe(BUILTIN_TEMPLATES.length);
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

test("F03: alternating a single browser and Desktop Frames keeps GPU memory flat", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
  await page.waitForFunction(() => window.__labReady === true);
  const counts = await page.evaluate(async () => {
    const fixtures = window.__fixtures;
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    if (!fixtures?.["single-browser"] || !fixtures["frames"] || !engine || !setDoc)
      throw new Error("F03 memory fixture hooks are unavailable");
    engine.resize(640, 360);
    const docs = [fixtures["single-browser"], fixtures["frames"]];
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
    if (!fixtures?.["frames"] || !fixtures["single-browser"] || !engine || !createProvider)
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
    const older = engine.setDocument(fixtures["frames"], slow);
    const newer = engine.setDocument(fixtures["single-browser"], provider);
    await Promise.all([older, newer]);
    engine.renderAt(1);
    return engine.debugInfo().nodes.map((n) => n.id);
  });
  expect(nodeIds, "the single browser, none of the Frames cards").toEqual(["single:0"]);
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
      {
        kind: "rows",
        assetIds: ["rows-a", "rows-b", "rows-c"],
        rows: 2,
        device: "browser",
        tilt: 0,
        travel: "period",
      },
      {
        kind: "columns",
        assetIds: ["columns-a", "columns-b", "columns-c"],
        columns: 3,
        tilt: 0,
        travel: "period",
      },
      {
        kind: "slider",
        assetIds: ["slider-a", "slider-b", "slider-c"],
        axis: "y",
        shape: "desktop",
        step: 2,
        arrangement: "deck",
      },
    ] as const;
    const missing: string[] = [];
    for (const layout of layouts) {
      const doc = structuredClone(base);
      const ids: string[] = [...layout.assetIds];
      doc.shots[0].layout = layout as unknown as (typeof doc.shots)[number]["layout"];
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
    const browser = window.__fixtures?.["single-browser"];
    const frames = window.__fixtures?.["frames"];
    const engine = window.__labEngine;
    const setDoc = window.__labSetDoc;
    if (!browser || !frames || !engine || !setDoc)
      throw new Error("F03 diffing fixture hooks are unavailable");
    engine.resize(640, 360);
    const rebuilds = async (base: typeof browser) => {
      const doc = structuredClone(base);
      await setDoc(doc);
      const initial = engine.debugInfo().devicesBuilt;
      // Background, grain and text do not change any device.
      doc.style.background = { kind: "solid", color: "#808080" };
      doc.style.grain = 0;
      await setDoc(structuredClone(doc));
      const afterBackground = engine.debugInfo().devicesBuilt;
      // Browser chrome is part of a browser's key, not a card's.
      doc.style.browserChrome = doc.style.browserChrome === "minimal" ? "standard" : "minimal";
      await setDoc(structuredClone(doc));
      const afterChrome = engine.debugInfo().devicesBuilt;
      return { initial, afterBackground, afterChrome };
    };
    return { browser: await rebuilds(browser), cards: await rebuilds(frames) };
  });
  for (const [name, b] of Object.entries(built)) {
    expect(b.initial, name).toBeGreaterThan(0);
    expect(b.afterBackground, `${name}: a background change rebuilds no device`).toBe(b.initial);
  }
  const browserRebuilt = built.browser.afterChrome - built.browser.afterBackground;
  expect(browserRebuilt, "a chrome change rebuilds the browser").toBe(1);
  const cardsRebuilt = built.cards.afterChrome - built.cards.afterBackground;
  expect(cardsRebuilt, "a chrome change keeps the Frames cards").toBe(0);
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

// Phone Parade, Portfolio Rows and Isometric Wall were removed (Frames plan PF01), and their
// tilted rows, tilted columns and wall on 19 Oct 2026 (docs/cuts-plan/README.md). A project saved
// with one of them loads as Desktop or Mobile Frames, and must draw every screen.
test("PF01: saved projects of removed templates load as Frames with every texture", async ({
  page,
}) => {
  test.setTimeout(120_000);
  // The stage mounts its engine once a document has shots, as after demo content.
  await page.goto("/");
  await page.getByRole("button", { name: "Try with demo content" }).click();
  await page.waitForFunction(() => Boolean(window.__editorEngine));

  const saved = [
    { templateId: "isometric-wall", layout: { kind: "wall", columns: 4, speed: 0.3 }, node: "row" },
    {
      templateId: "portfolio-rows",
      layout: { kind: "rows", rows: 2, device: "browser", tilt: 8, speed: 0.35 },
      node: "row",
    },
    {
      templateId: "phone-parade",
      layout: { kind: "columns", columns: 3, tilt: 12, speed: 0.4 },
      node: "col",
    },
  ];
  for (const { templateId, layout, node } of saved) {
    await page.evaluate(
      ({ templateId, layout }) => {
        const store = (
          window as unknown as {
            __editorStore?: {
              getState(): { doc: ProjectDoc; loadDoc(doc: ProjectDoc): void };
            };
          }
        ).__editorStore;
        if (!store) throw new Error("__editorStore is unavailable");
        // As IndexedDB returns it: plain JSON with the removed layout and template.
        const doc = JSON.parse(JSON.stringify(store.getState().doc));
        // The demo content's screenshots; a Frames card shows any of them.
        const ids = doc.assets
          .filter((a: { kind: string }) => a.kind === "image")
          .map((a: { id: string }) => a.id);
        doc.templateId = templateId;
        doc.shots = [{ ...doc.shots[0], layout: { ...layout, assetIds: ids } }];
        store.getState().loadDoc(doc);
      },
      { templateId, layout },
    );
    await expect
      .poll(
        () =>
          page.evaluate((node) => {
            const nodes = window.__editorEngine?.debugInfo().nodes ?? [];
            return {
              frames: nodes.length > 3 && nodes.every((n) => n.id.startsWith(node)),
              unloaded: nodes.filter((n) => !n.assetId || !n.textureLoaded).length,
            };
          }, node),
        { timeout: 20_000, message: `the editor draws the saved ${templateId} as Frames` },
      )
      .toEqual({ frames: true, unloaded: 0 });
  }

  // The gallery starts on the first template.
  await page.getByRole("button", { name: "Browse all templates" }).click();
  const gallery = page.getByRole("dialog");
  await expect(gallery.getByText("Selected: Desktop Slider")).toBeVisible();
  await expect(gallery.getByText("Active", { exact: true })).toHaveCount(0);
});
