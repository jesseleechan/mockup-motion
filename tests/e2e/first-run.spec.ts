import { expect, test, type Page } from "@playwright/test";
import type { ProjectDoc } from "../../src/doc/types";
import type { Engine } from "../../src/engine/Engine";

declare global {
  interface Window {
    __editorEngine?: Engine;
  }
}

interface StoreHandle {
  getState: () => { doc: ProjectDoc; past: ProjectDoc[] };
}

interface UIStoreHandle {
  getState: () => { selection: { kind: string; id?: string } };
}

/** The empty-screen fill in ScreenCompositor (#18181b). */
const EMPTY_FILL = [0x18, 0x18, 0x1b];

async function resetAndOpen(page: Page) {
  await page.goto("/lab/ui");
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase("mockupmotion-v2");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("deleteDatabase blocked"));
    });
  });
  await page.goto("/");
}

async function docState(page: Page) {
  return page.evaluate(() => {
    const hooks = window as unknown as { __editorStore?: StoreHandle; __uiStore?: UIStoreHandle };
    const store = hooks.__editorStore;
    const ui = hooks.__uiStore;
    if (!store || !ui) throw new Error("__editorStore or __uiStore is unavailable");
    const { doc, past } = store.getState();
    const { selection } = ui.getState();
    return {
      firstShotSelected: selection.kind === "shot" && selection.id === doc.shots[0]?.id,
      templateId: doc.templateId ?? null,
      assetIds: doc.assets.map((a) => a.id),
      layout: doc.shots[0]?.layout,
      undoSteps: past.length,
    };
  });
}

/**
 * Waits until every node has its texture and setDocument has stopped being called. Polls with
 * page.evaluate: page.waitForFunction treats a Promise that resolves to false as truthy.
 */
async function waitForSettledDocument(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<boolean>((resolve) => {
              const engine = window.__editorEngine;
              if (!engine) return resolve(false);
              const before = engine.debugInfo();
              const loaded =
                before.nodes.length > 0 &&
                before.nodes.every((node) => node.assetId === null || node.textureLoaded);
              setTimeout(() => {
                const after = engine.debugInfo();
                resolve(loaded && after.setDocumentCalls === before.setDocumentCalls);
              }, 500);
            }),
        ),
      { timeout: 20000, message: "every screen texture loaded and setDocument settled" },
    )
    .toBe(true);
}

/**
 * Mean colour of the desktop and phone screen centres in the editor preview. Screen pixels come
 * from a mask pass that paints the desktop screen magenta and the phone screen cyan. Engine.pick()
 * cannot attribute pixels here: in the overlap arrangement it returns the phone for much of the
 * desktop screen, because the nearest raycast hit is a phone mesh drawn nowhere near there.
 */
async function screenCentres(page: Page) {
  return page.evaluate(async () => {
    const engine = window.__editorEngine;
    const store = (window as unknown as { __editorStore?: StoreHandle }).__editorStore;
    const canvas = document.querySelector<HTMLCanvasElement>("[data-testid='stage'] canvas");
    if (!engine || !store || !canvas)
      throw new Error(`Editor hooks: engine ${!!engine}, store ${!!store}, canvas ${!!canvas}`);
    const doc = store.getState().doc;
    const width = canvas.width;
    const height = canvas.height;
    // Mid-shot: the stagger entrance has finished and both devices are on screen.
    const t = doc.shots[0].duration * 0.5;
    const renderFrame = () => {
      engine.renderAt(t);
      const frame = engine.readPixels();
      if (frame.length !== width * height * 4) throw new Error(`Readback is ${frame.length} bytes`);
      return frame;
    };

    // Content pass: the document the editor already loaded.
    const pixels = renderFrame();

    // Mask pass: same layout and asset sizes under separate ids, so the texture cache cannot mix
    // the passes. Grain and vignette off so the mask colours survive exactly.
    const maskDoc = structuredClone(doc);
    maskDoc.style.grain = 0;
    maskDoc.style.vignette = 0;
    const layout = maskDoc.shots[0].layout;
    if (layout.kind !== "pair") throw new Error(`Expected a pair layout, got ${layout.kind}`);
    const maskColour = new Map<string, string>();
    const maskAsset = (id: string, screen: string, colour: string) => {
      const asset = doc.assets.find((a) => a.id === id);
      if (!asset) throw new Error(`The ${screen} screen has no asset`);
      maskColour.set(`mask-${screen}:${id}`, colour);
      return { ...asset, id: `mask-${screen}:${id}` };
    };
    maskDoc.assets = [
      maskAsset(layout.desktopId, "desktop", "#FF00FF"),
      maskAsset(layout.mobileId, "mobile", "#00FFFF"),
    ];
    layout.desktopId = maskDoc.assets[0].id;
    layout.mobileId = maskDoc.assets[1].id;
    await engine.setDocument(maskDoc, {
      async getImage(id, maxWidth) {
        const asset = maskDoc.assets.find((a) => a.id === id);
        const colour = maskColour.get(id);
        if (!asset?.width || !asset.height || !colour) throw new Error(`No mask for ${id}`);
        const w = Math.min(asset.width, maxWidth);
        const h = Math.round((asset.height * w) / asset.width);
        const surface = new OffscreenCanvas(w, h);
        const ctx = surface.getContext("2d");
        if (!ctx) throw new Error("No 2D context for the mask");
        ctx.fillStyle = colour;
        ctx.fillRect(0, 0, w, h);
        return createImageBitmap(surface);
      },
      async getText() {
        throw new Error("Responsive Pair has no text layers");
      },
    });
    const mask = renderFrame();

    const screens = {
      desktop: (i: number) => mask[i] > 240 && mask[i + 1] < 15 && mask[i + 2] > 240,
      mobile: (i: number) => mask[i] < 15 && mask[i + 1] > 240 && mask[i + 2] > 240,
    };
    return Object.entries(screens).map(([screen, isScreen]) => {
      // The screen's visible bounds, then the mean content colour over their central 40%.
      let x0 = width;
      let x1 = -1;
      let y0 = height;
      let y1 = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!isScreen((y * width + x) * 4)) continue;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
      const sum = [0, 0, 0];
      let samples = 0;
      for (let y = Math.ceil(y0 + 0.3 * (y1 - y0)); y <= y0 + 0.7 * (y1 - y0); y++) {
        for (let x = Math.ceil(x0 + 0.3 * (x1 - x0)); x <= x0 + 0.7 * (x1 - x0); x++) {
          const i = (y * width + x) * 4;
          if (!isScreen(i)) continue;
          sum[0] += pixels[i];
          sum[1] += pixels[i + 1];
          sum[2] += pixels[i + 2];
          samples++;
        }
      }
      return {
        screen,
        bounds: [x0, y0, x1, y1],
        samples,
        mean: sum.map((v) => (samples > 0 ? v / samples : NaN)),
      };
    });
  });
}

test("F06: first run → Responsive Pair → demo content fills it in one undo step", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await resetAndOpen(page);

  // First run: pick a template before there are any screenshots.
  await expect(page.getByRole("heading", { name: "Create a presentation" })).toBeVisible();
  await page.getByRole("button", { name: "Start with a template" }).click();
  const gallery = page.getByRole("dialog");
  await expect(gallery).toBeVisible();
  await gallery.getByRole("button", { name: "Select template Responsive Pair" }).click();
  await gallery.getByRole("button", { name: "Apply template" }).click();
  await expect(gallery).toBeHidden();

  // Applied with empty slots: the overlay asks for screenshots.
  const overlay = page.getByTestId("fill-template-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText("Add screenshots to fill this template");
  const applied = await docState(page);
  expect(applied.templateId).toBe("responsive-pair");
  expect(applied.assetIds).toEqual([]);
  expect(applied.layout?.kind).toBe("pair");
  expect(applied.firstShotSelected, "applying selects the first shot").toBe(true);

  await overlay.getByRole("button", { name: "Use demo content" }).click();
  await expect(overlay).toBeHidden();

  const filled = await docState(page);
  expect(filled.undoSteps).toBe(applied.undoSteps + 1);
  expect(filled.assetIds.length).toBeGreaterThan(0);
  expect(filled.assetIds.every((id) => id.startsWith("demo-"))).toBe(true);
  if (filled.layout?.kind !== "pair") throw new Error("Expected a pair layout");
  expect(filled.assetIds).toContain(filled.layout.desktopId);
  expect(filled.assetIds).toContain(filled.layout.mobileId);
  expect(filled.firstShotSelected, "the selection follows the rebuilt shot").toBe(true);
  await expect(page.getByText("Selected shot not found.")).toHaveCount(0);

  // Both screens show content: their centres are far from the empty-screen fill.
  await waitForSettledDocument(page);
  const centres = await screenCentres(page);
  console.log(`F06 screen centres: ${JSON.stringify(centres)}`);
  for (const centre of centres) {
    expect(centre.samples, `${centre.screen} centre samples`).toBeGreaterThan(500);
    const distance = Math.max(...centre.mean.map((v, c) => Math.abs(v - EMPTY_FILL[c])));
    expect(distance, `${centre.screen} centre differs from the empty fill`).toBeGreaterThan(40);
  }

  // One Undo removes the demo content and brings the overlay back.
  await page.getByRole("button", { name: "Undo" }).click();
  const undone = await docState(page);
  expect(undone.assetIds).toEqual([]);
  expect(undone.templateId).toBe("responsive-pair");
  expect(undone.undoSteps).toBe(applied.undoSteps);
  expect(undone.firstShotSelected).toBe(true);
  await expect(page.getByText("Selected shot not found.")).toHaveCount(0);
  await expect(overlay).toBeVisible();
});

test("Presets D1: the gallery leads with the presets and starts on Desktop Slider", async ({
  page,
}) => {
  await resetAndOpen(page);
  await page.getByRole("button", { name: "Start with a template" }).click();
  const gallery = page.getByRole("dialog");
  await expect(gallery).toBeVisible();
  const cards = gallery.locator('[data-testid="template-card"]');
  await expect(cards).toHaveCount(15);
  const order = await cards.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-template-id")),
  );
  expect(order.slice(0, 3)).toEqual(["desktop-slider", "mobile-slider", "frames"]);

  // Apply without picking a card: the initial selection is the first-run default.
  await gallery.getByRole("button", { name: "Apply template" }).click();
  await expect(gallery).toBeHidden();
  const applied = await docState(page);
  expect(applied.templateId).toBe("desktop-slider");
  expect(applied.assetIds).toEqual([]);
  expect(applied.layout?.kind).toBe("slider");
  expect(applied.firstShotSelected).toBe(true);
  await expect(page.getByTestId("fill-template-overlay")).toBeVisible();
});

test("Presets D1: first run → demo content builds Desktop Slider", async ({ page }) => {
  test.setTimeout(90_000);
  await resetAndOpen(page);
  await expect(page.getByRole("heading", { name: "Create a presentation" })).toBeVisible();
  await page.getByRole("button", { name: "Try with demo content" }).click();
  await expect(page.getByRole("heading", { name: "Create a presentation" })).toBeHidden();
  await expect
    .poll(async () => (await docState(page)).assetIds.length, { timeout: 20_000 })
    .toBe(5);

  const filled = await docState(page);
  expect(filled.templateId).toBe("desktop-slider");
  expect(filled.assetIds).toEqual([
    "demo-northwind-desktop-hero",
    "demo-aurelia-desktop-hero",
    "demo-maison-oak-desktop-hero",
    "demo-field-notes-desktop-hero",
    "demo-studio-kova-desktop-hero",
  ]);
  if (filled.layout?.kind !== "slider") throw new Error("Expected a slider layout");
  expect(filled.layout.axis).toBe("y");
  expect(filled.layout.assetIds).toEqual(filled.assetIds);
  await expect(page.getByTestId("fill-template-overlay")).toHaveCount(0);

  // The active card shows a screenshot: at 3.9 s step 1 has settled on Maison Oak, whose hero
  // (text, a photo) varies far more than the flat Ash background or an empty screen.
  await waitForSettledDocument(page);
  const centre = await page.evaluate(() => {
    const engine = window.__editorEngine;
    const canvas = document.querySelector<HTMLCanvasElement>("[data-testid='stage'] canvas");
    if (!engine || !canvas) throw new Error(`Editor hooks: engine ${!!engine}, canvas ${!!canvas}`);
    engine.renderAt(3.9);
    const pixels = engine.readPixels();
    const width = canvas.width;
    const height = canvas.height;
    const values: number[][] = [[], [], []];
    for (let y = Math.round(height * 0.35); y < height * 0.65; y++) {
      for (let x = Math.round(width * 0.3); x < width * 0.7; x++) {
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) values[c].push(pixels[i + c]);
      }
    }
    return values.map((channel) => {
      const mean = channel.reduce((a, b) => a + b, 0) / channel.length;
      const variance = channel.reduce((a, b) => a + (b - mean) ** 2, 0) / channel.length;
      return { samples: channel.length, stdDev: Math.sqrt(variance) };
    });
  });
  console.log(`D1 active card centre: ${JSON.stringify(centre)}`);
  for (const channel of centre) {
    expect(channel.samples).toBeGreaterThan(1000);
    expect(channel.stdDev, "the active card shows screenshot content").toBeGreaterThan(20);
  }
});
