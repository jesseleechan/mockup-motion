import { expect, test, type Page } from "@playwright/test";
import type { Engine } from "../../src/engine/Engine";
import { ciTimeout } from "../helpers/ci";

declare global {
  interface Window {
    __editorEngine?: Engine;
  }
}

// Stage.tsx keeps 32 px of padding on each side of the fitted preview (F05).
const STAGE_PADDING = 32;

const RATIOS: Record<string, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "4:3": 4 / 3,
};

interface StageMeasure {
  stage: { width: number; height: number };
  canvas: { width: number; height: number };
  buffer: { width: number; height: number };
  dpr: number;
}

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
  await page.getByRole("button", { name: "Try with demo content" }).click();
  await page.waitForFunction(() => Boolean(window.__editorEngine));
  await waitForSettledDocument(page);
}

/** Waits until every node has its texture and setDocument has stopped being called. */
async function waitForSettledDocument(page: Page) {
  await page.waitForFunction(
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
    undefined,
    { timeout: 20000 },
  );
}

async function measure(page: Page): Promise<StageMeasure> {
  return page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>("[data-testid='stage']");
    const canvas = document.querySelector<HTMLCanvasElement>("[data-testid='stage'] canvas");
    if (!stage || !canvas) throw new Error("Stage or canvas missing");
    const stageRect = stage.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return {
      stage: { width: stageRect.width, height: stageRect.height },
      canvas: { width: canvasRect.width, height: canvasRect.height },
      buffer: { width: canvas.width, height: canvas.height },
      dpr: window.devicePixelRatio,
    };
  });
}

function expectedFit(m: StageMeasure, ratio: number) {
  const availW = m.stage.width - 2 * STAGE_PADDING;
  const availH = m.stage.height - 2 * STAGE_PADDING;
  const width = Math.min(availW, availH * ratio);
  return { width, height: width / ratio };
}

/** Returns a list of problems; empty when the canvas fills the computed fit. */
function fitProblems(m: StageMeasure, ratio: number, zoom = 1): string[] {
  const fit = expectedFit(m, ratio);
  const want = { width: fit.width * zoom, height: fit.height * zoom };
  const problems: string[] = [];
  const dw = Math.abs(m.canvas.width - want.width) / want.width;
  const dh = Math.abs(m.canvas.height - want.height) / want.height;
  if (dw > 0.02 || dh > 0.02) {
    problems.push(
      `canvas ${m.canvas.width.toFixed(1)}×${m.canvas.height.toFixed(1)} vs fit ${want.width.toFixed(1)}×${want.height.toFixed(1)}`,
    );
  }
  const aspect = m.canvas.width / m.canvas.height;
  if (Math.abs(aspect - ratio) / ratio > 0.01) {
    problems.push(`canvas aspect ${aspect.toFixed(4)} vs ${ratio.toFixed(4)}`);
  }
  // The drawing buffer must follow the CSS box at min(devicePixelRatio, 2).
  const pr = Math.min(m.dpr, 2);
  const bw = Math.abs(m.buffer.width - m.canvas.width * pr) / (m.canvas.width * pr);
  const bh = Math.abs(m.buffer.height - m.canvas.height * pr) / (m.canvas.height * pr);
  if (bw > 0.02 || bh > 0.02) {
    problems.push(
      `buffer ${m.buffer.width}×${m.buffer.height} vs css ${m.canvas.width.toFixed(1)}×${m.canvas.height.toFixed(1)} at ×${pr}`,
    );
  }
  return problems;
}

async function expectFits(page: Page, aspect: string, zoom = 1) {
  const ratio = RATIOS[aspect];
  await expect
    .poll(async () => fitProblems(await measure(page), ratio, zoom), {
      message: `preview fits the stage at ${aspect}, zoom ${zoom}`,
      timeout: 10000,
    })
    .toEqual([]);
  const m = await measure(page);
  // Guard against a degenerate stage making the fit trivially small.
  expect(Math.max(m.canvas.width, m.canvas.height)).toBeGreaterThan(400 * zoom);
}

async function selectAspect(page: Page, aspect: string) {
  await page.getByRole("radio", { name: aspect, exact: true }).click();
  await expect(page.getByRole("radio", { name: aspect, exact: true })).toHaveAttribute(
    "data-state",
    "on",
  );
}

async function debugCounts(page: Page) {
  return page.evaluate(() => {
    const info = window.__editorEngine!.debugInfo();
    return { setDocumentCalls: info.setDocumentCalls, renderCalls: info.renderCalls };
  });
}

async function scrubberValue(page: Page) {
  const scrubber = page.getByRole("slider", { name: "Timeline scrubber" });
  const now = Number(await scrubber.getAttribute("aria-valuenow"));
  const max = Number(await scrubber.getAttribute("aria-valuemax"));
  return { now, max };
}

async function seekToFraction(page: Page, fraction: number) {
  const scrubber = page.getByRole("slider", { name: "Timeline scrubber" });
  const box = await scrubber.boundingBox();
  if (!box) throw new Error("Timeline scrubber has no box");
  await page.mouse.click(box.x + box.width * fraction, box.y + box.height / 2);
}

async function setLoop(page: Page, on: boolean) {
  const toggle = page.getByRole("switch", { name: "Loop playback" });
  if ((await toggle.getAttribute("aria-checked")) !== String(on)) await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", String(on));
}

const transportPlay = (page: Page) => page.getByTestId("transport-play");

test.describe("F05 stage sizing", () => {
  test.use({ viewport: { width: 1600, height: 1000 } });

  test("1. preview fills the stage at 16:9, 9:16 and 4:3", async ({ page }) => {
    await resetAndOpen(page);
    for (const aspect of ["16:9", "9:16", "4:3"]) {
      await selectAspect(page, aspect);
      await expectFits(page, aspect);
    }

    // Zoom options scale the fitted size.
    const zoom = page.getByRole("combobox", { name: "Stage zoom" });
    await zoom.selectOption({ label: "50%" });
    await expectFits(page, "4:3", 0.5);
    await zoom.selectOption({ label: "75%" });
    await expectFits(page, "4:3", 0.75);
    await zoom.selectOption({ label: "Fit" });
    await expectFits(page, "4:3");
  });

  test("2. resizing the viewport to 1280×800 re-fits the preview", async ({ page }) => {
    await resetAndOpen(page);
    for (const aspect of ["16:9", "9:16", "4:3"]) {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await selectAspect(page, aspect);
      await expectFits(page, aspect);
      const before = await measure(page);

      await page.setViewportSize({ width: 1280, height: 800 });
      await expectFits(page, aspect);
      const after = await measure(page);
      expect(after.canvas.width).toBeLessThan(before.canvas.width);
    }
  });
});

test.describe("F05 stage sizing on a 3× display", () => {
  test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 3 });

  test("the drawing buffer is capped at 2× device pixels", async ({ page }) => {
    await resetAndOpen(page);
    await expectFits(page, "16:9");
    const m = await measure(page);
    expect(m.dpr).toBe(3);
    expect(m.buffer.width).toBeLessThanOrEqual(Math.ceil(m.canvas.width * 2) + 1);
  });
});

// SwiftShader rasterizes on the CPU, and the cost scales with canvas pixels: measured at
// ~6 drawn frames/s for a 952×535 preview, ~35/s at 320×180 (requestAnimationFrame itself
// runs at 60/s). These tests check the playback loop, not CPU raster speed, so they use a
// small preview: 1280×800 with Stage zoom at 50%.
async function openSmallPreview(page: Page) {
  await resetAndOpen(page);
  await page.getByRole("combobox", { name: "Stage zoom" }).selectOption({ label: "50%" });
  await expectFits(page, "16:9", 0.5);
}

test.describe("F05 preview playback", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("3. playing for 2 s renders every frame without setDocument", async ({ page }) => {
    await openSmallPreview(page);
    await seekToFraction(page, 0);
    const before = await debugCounts(page);

    await transportPlay(page).click();
    const started = Date.now();
    await expect(transportPlay(page)).toHaveAttribute("aria-label", "Pause");
    // 30 frames in 2 s locally; the CI runner gets its slowdown factor for the same 30.
    await expect
      .poll(async () => (await debugCounts(page)).renderCalls - before.renderCalls, {
        timeout: ciTimeout(2000),
        message: "frames rendered in 2 s",
      })
      .toBeGreaterThanOrEqual(30);
    // Keep playing for at least the full 2 s before checking setDocument.
    await page.waitForTimeout(Math.max(0, 2000 - (Date.now() - started)));
    const after = await debugCounts(page);
    await transportPlay(page).click();
    await expect(transportPlay(page)).toHaveAttribute("aria-label", "Play");

    expect(after.setDocumentCalls, "setDocument calls during playback").toBe(
      before.setDocumentCalls,
    );
  });

  test("4. loop off stops at the end; loop on wraps past 0", async ({ page }) => {
    await openSmallPreview(page);

    await setLoop(page, false);
    await seekToFraction(page, 0.85);
    const start = await scrubberValue(page);
    expect(start.now).toBeGreaterThan(0.5 * start.max);
    await transportPlay(page).click();
    await expect(transportPlay(page)).toHaveAttribute("aria-label", "Play", { timeout: 15000 });
    const stopped = await scrubberValue(page);
    expect(stopped.now).toBe(stopped.max);
    await expect(page.getByTestId("transport-current")).toHaveText(
      (await page.getByTestId("transport-total").textContent()) ?? "missing",
    );

    // Pressing play at the end restarts from the beginning.
    await transportPlay(page).click();
    await expect.poll(async () => (await scrubberValue(page)).now).toBeLessThan(stopped.max / 2);
    await transportPlay(page).click();
    await expect(transportPlay(page)).toHaveAttribute("aria-label", "Play");

    await setLoop(page, true);
    await seekToFraction(page, 0.85);
    const loopStart = await scrubberValue(page);
    expect(loopStart.now).toBeGreaterThan(0.5 * loopStart.max);
    await transportPlay(page).click();
    await expect
      .poll(async () => (await scrubberValue(page)).now, { timeout: 15000 })
      .toBeLessThan(loopStart.now / 2);
    // Still playing after the wrap.
    await expect(transportPlay(page)).toHaveAttribute("aria-label", "Pause");
    await transportPlay(page).click();
  });

  test("5. scrubbing while paused renders without setDocument", async ({ page }) => {
    await openSmallPreview(page);
    await expect(transportPlay(page)).toHaveAttribute("aria-label", "Play");
    const before = await debugCounts(page);

    const scrubber = page.getByRole("slider", { name: "Timeline scrubber" });
    const box = await scrubber.boundingBox();
    if (!box) throw new Error("Timeline scrubber has no box");
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.1, y);
    await page.mouse.down();
    for (const fraction of [0.25, 0.4, 0.55, 0.7]) {
      await page.mouse.move(box.x + box.width * fraction, y);
    }
    await page.mouse.up();

    await expect
      .poll(async () => (await debugCounts(page)).renderCalls - before.renderCalls)
      .toBeGreaterThanOrEqual(5);
    const after = await debugCounts(page);
    expect(after.setDocumentCalls).toBe(before.setDocumentCalls);
    const value = await scrubberValue(page);
    expect(value.now).toBeGreaterThan(0.6 * value.max);
  });
});
