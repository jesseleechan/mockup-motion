import { expect, test, type Locator, type Page } from "@playwright/test";
import type { ProjectDoc } from "../../src/doc/types";
import { ciTimeout } from "../helpers/ci";

interface StoreHandle {
  getState: () => { doc: ProjectDoc; apply: (recipe: (draft: ProjectDoc) => void) => void };
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
}

/** Applies a template from the gallery and fills its slots with demo screenshots. */
async function applyTemplateWithDemo(page: Page, templateId: string) {
  await page.getByRole("button", { name: "Start with a template" }).click();
  await page.locator(`[data-testid="template-card"][data-template-id="${templateId}"]`).click();
  await page.getByRole("button", { name: "Apply template" }).click();
  await page.getByRole("button", { name: "Use demo content" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const store = (window as unknown as { __editorStore?: StoreHandle }).__editorStore;
        return store?.getState().doc.assets.length ?? 0;
      }),
    )
    .toBeGreaterThan(0);
}

async function shotCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const store = (window as unknown as { __editorStore?: StoreHandle }).__editorStore;
    if (!store) throw new Error("__editorStore is unavailable");
    return store.getState().doc.shots.length;
  });
}

interface ImageStats {
  src: string;
  naturalWidth: number;
  stdDev: number;
  /** 16×9 grid of mean luminance, for comparing two renders. */
  grid: number[];
}

/** Decodes an <img> through a canvas: its source, size, spread of values and a coarse grid. */
async function imageStats(img: Locator): Promise<ImageStats> {
  return img.evaluate(async (el: HTMLImageElement) => {
    await el.decode();
    const canvas = document.createElement("canvas");
    canvas.width = el.naturalWidth;
    canvas.height = el.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D context");
    ctx.drawImage(el, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i] + data[i + 1] + data[i + 2];
      count += 3;
    }
    const mean = sum / count;
    let variance = 0;
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) variance += (data[i + c] - mean) ** 2;
    }
    const grid: number[] = [];
    for (let gy = 0; gy < 9; gy++) {
      for (let gx = 0; gx < 16; gx++) {
        let cell = 0;
        let n = 0;
        for (let y = Math.floor((gy * height) / 9); y < Math.floor(((gy + 1) * height) / 9); y++) {
          for (
            let x = Math.floor((gx * width) / 16);
            x < Math.floor(((gx + 1) * width) / 16);
            x++
          ) {
            const i = (y * width + x) * 4;
            cell += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
            n++;
          }
        }
        grid.push(cell / n);
      }
    }
    return {
      src: el.src,
      naturalWidth: el.naturalWidth,
      stdDev: Math.sqrt(variance / count),
      grid,
    };
  });
}

function meanGridDifference(a: number[], b: number[]): number {
  return a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length;
}

test.describe("F07: shot and project thumbnails", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await resetAndOpen(page);
  });

  test("every shot card shows a rendered thumbnail after applying a template", async ({ page }) => {
    test.setTimeout(90_000);
    // Every built-in template has one shot, so add a second layout and a title card.
    await applyTemplateWithDemo(page, "scroll-story");
    for (const item of ["Same layout", "Title card"]) {
      await page.getByRole("button", { name: "Add shot" }).click();
      await page.getByRole("menuitem", { name: item }).click();
    }
    // A title card from the menu has no text, so its thumbnail is a flat background. Give it
    // a title, as the reel templates did.
    await page.evaluate(() => {
      const store = (window as unknown as { __editorStore?: StoreHandle }).__editorStore;
      if (!store) throw new Error("__editorStore is unavailable");
      store.getState().apply((draft) => {
        const title = draft.shots.find((s) => s.layout.kind === "title");
        if (!title) throw new Error("No title card was added");
        title.texts = [
          {
            id: "txt-title",
            role: "title",
            text: "Studio Kova",
            color: "",
            font: "display",
            size: 8,
            anchor: "center",
            align: "center",
            animation: "fadeUp",
            delay: 0,
          },
        ];
      });
    });
    const shots = await shotCount(page);
    expect(shots).toBe(3);

    const cards = page.locator('[data-testid="shot-card"]');
    await expect(cards).toHaveCount(shots);
    await expect
      .poll(
        () =>
          cards.evaluateAll((els) =>
            els.every((card) => (card.querySelector("img")?.naturalWidth ?? 0) > 0),
          ),
        { timeout: 20_000, message: "every shot card has a loaded <img>" },
      )
      .toBe(true);

    for (let i = 0; i < shots; i++) {
      const stats = await imageStats(cards.nth(i).locator("img"));
      expect(stats.naturalWidth, `shot ${i + 1} thumbnail width`).toBeGreaterThan(0);
      // A flat fill means the render came out blank.
      expect(stats.stdDev, `shot ${i + 1} thumbnail is not a flat colour`).toBeGreaterThan(10);
    }
  });

  test("changing the shot's camera updates its thumbnail within 1.5 s", async ({ page }) => {
    test.setTimeout(90_000);
    await applyTemplateWithDemo(page, "scroll-story");
    const thumb = page.locator('[data-testid="shot-card"]').first().locator("img");
    await expect
      .poll(() => thumb.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 20_000 })
      .toBeGreaterThan(0);
    // Let the first project-thumbnail write (and any other queued render) finish.
    await page.waitForTimeout(1000);
    const before = await imageStats(thumb);

    const started = Date.now();
    await page.getByRole("button", { name: "Isometric drift", exact: true }).click();
    await expect
      .poll(() => thumb.evaluate((el: HTMLImageElement) => (el.complete ? el.src : "")), {
        // 1.5 s locally; scaled for the slower CI runner.
        timeout: ciTimeout(1500),
        intervals: [25],
        message: "the thumbnail src changes within 1.5 s",
      })
      .not.toBe(before.src);
    const elapsed = Date.now() - started;
    console.log(`Thumbnail updated ${elapsed} ms after the camera change`);

    const after = await imageStats(thumb);
    expect(after.naturalWidth).toBeGreaterThan(0);
    // Iso drift views the browser from yaw 34°, pitch 28°: the picture must actually differ.
    expect(meanGridDifference(before.grid, after.grid)).toBeGreaterThan(8);
  });

  test("the project thumbnail is stored and shown in the Projects dialog", async ({ page }) => {
    test.setTimeout(90_000);
    await applyTemplateWithDemo(page, "phone-parade");
    const docId = await page.evaluate(() => {
      const store = (window as unknown as { __editorStore?: StoreHandle }).__editorStore;
      if (!store) throw new Error("__editorStore is unavailable");
      return store.getState().doc.id;
    });

    // Written by the editor itself, before the dialog ever opens.
    await expect
      .poll(
        () =>
          page.evaluate(
            (id) =>
              new Promise<number>((resolve, reject) => {
                const req = indexedDB.open("mockupmotion-v2");
                req.onerror = () => reject(req.error);
                req.onsuccess = () => {
                  const db = req.result;
                  const get = db.transaction("thumbs", "readonly").objectStore("thumbs").get(id);
                  get.onerror = () => reject(get.error);
                  get.onsuccess = () => {
                    const blob = get.result as Blob | undefined;
                    db.close();
                    resolve(blob?.size ?? 0);
                  };
                };
              }),
            docId,
          ),
        { timeout: 20_000, message: "putThumb stored a thumbnail for the open project" },
      )
      .toBeGreaterThan(1000);

    await page.getByRole("button", { name: /MockupMotion/i }).click();
    await page.getByRole("menuitem", { name: /Projects/i }).click();
    const card = page.locator(`[data-testid="project-card"][data-project-id="${docId}"]`);
    await expect(card.locator("img")).toBeVisible({ timeout: 20_000 });
    const stats = await imageStats(card.locator("img"));
    expect(stats.naturalWidth).toBeGreaterThan(0);
    expect(stats.stdDev).toBeGreaterThan(10);
  });
});

test.describe("F07: template previews in the gallery and Library", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await resetAndOpen(page);
  });

  async function videoState(card: Locator) {
    return card
      .locator("video")
      .evaluate((v: HTMLVideoElement) => ({ paused: v.paused, time: v.currentTime }));
  }

  test("a card plays its preview on hover and focus, and pauses and rewinds after", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Start with a template" }).click();
    const cards = page.locator('[data-testid="template-card"]');
    await expect(cards).toHaveCount(7);

    // Every card rests on its poster.
    const posters = await cards.evaluateAll((els) =>
      els.map((el) => el.querySelector("video")?.getAttribute("poster")),
    );
    for (const poster of posters) expect(poster).toMatch(/^\/templates\/[a-z-]+\.webp$/);

    const frames = page.locator('[data-testid="template-card"][data-template-id="frames"]');
    await frames.hover();
    await expect
      .poll(() => videoState(frames), { timeout: 10_000 })
      .toEqual({ paused: false, time: expect.any(Number) });
    // Decoding competes with SwiftShader for the CI runner's CPU (tests/helpers/ci.ts).
    await expect
      .poll(async () => (await videoState(frames)).time, {
        timeout: ciTimeout(5000),
        message: "the hovered card's preview plays past 0.2 s",
      })
      .toBeGreaterThan(0.2);
    const size = await frames
      .locator("video")
      .evaluate((v: HTMLVideoElement) => [v.videoWidth, v.videoHeight]);
    expect(size).toEqual([640, 360]);

    await page.getByRole("heading", { name: /Template gallery/ }).hover();
    await expect.poll(() => videoState(frames)).toEqual({ paused: true, time: 0 });

    const story = page.locator('[data-testid="template-card"][data-template-id="scroll-story"]');
    await story.focus();
    await expect.poll(async () => (await videoState(story)).paused).toBe(false);
    await story.blur();
    await expect.poll(() => videoState(story)).toEqual({ paused: true, time: 0 });
  });

  test("reduced motion shows posters only", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Start with a template" }).click();
    const cards = page.locator('[data-testid="template-card"]');
    await expect(cards).toHaveCount(7);
    await expect(page.locator('[data-testid="template-card"] video')).toHaveCount(0);
    const posters = page.locator('[data-testid="template-card"] [data-testid="template-poster"]');
    await expect(posters).toHaveCount(7);
    await cards.first().hover();
    await expect(page.locator('[data-testid="template-card"] video')).toHaveCount(0);
  });

  test("Library template cards show their posters", async ({ page }) => {
    const cards = page.locator('[data-testid="library-template-card"]');
    await expect(cards).toHaveCount(7);
    for (let i = 0; i < 7; i++) {
      const img = cards.nth(i).locator("img");
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1280);
    }
  });
});
