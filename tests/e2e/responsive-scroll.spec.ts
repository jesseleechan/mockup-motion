import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import type { AssetRef, ProjectDoc } from "../../src/doc/types";

declare global {
  interface Window {
    __labReady?: boolean;
  }
}

interface StoreHandle {
  getState: () => { doc: ProjectDoc };
}

const AURELIA = path.resolve("public/demo/aurelia");

/** Aurelia's full pages and their capture JSON files, named the way `npm run capture` names them. */
const FILES = {
  desktop: {
    name: "aurelia-desktop-1440-full.webp",
    mimeType: "image/webp",
    buffer: fs.readFileSync(path.join(AURELIA, "desktop-full.webp")),
  },
  mobile: {
    name: "aurelia-mobile-390@2x-full.webp",
    mimeType: "image/webp",
    buffer: fs.readFileSync(path.join(AURELIA, "mobile-full.webp")),
  },
  desktopJson: {
    name: "aurelia-desktop-1440.json",
    mimeType: "application/json",
    buffer: fs.readFileSync(path.join(AURELIA, "sections.json")),
  },
  mobileJson: {
    name: "aurelia-mobile-390@2x.json",
    mimeType: "application/json",
    buffer: fs.readFileSync(path.join(AURELIA, "sections-mobile.json")),
  },
};

async function resetAndOpenMedia(page: Page) {
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
  await page.getByRole("tab", { name: "Media" }).click();
}

async function storedAssets(page: Page): Promise<AssetRef[]> {
  return page.evaluate(() => {
    const store = (window as unknown as { __editorStore?: StoreHandle }).__editorStore;
    if (!store) throw new Error("__editorStore is unavailable");
    return store.getState().doc.assets;
  });
}

function sectionTop(asset: AssetRef | undefined, id: string): number | undefined {
  return asset?.meta?.sections?.find((s) => s.id === id)?.top;
}

test.describe("Responsive Scroll: capture sections on assets (R02)", () => {
  test("screenshots dropped with their capture files keep the sections in image px", async ({
    page,
  }) => {
    await resetAndOpenMedia(page);
    await page
      .getByTestId("media-input")
      .setInputFiles([FILES.desktop, FILES.mobileJson, FILES.mobile, FILES.desktopJson]);
    await expect.poll(async () => (await storedAssets(page)).length).toBe(2);

    const assets = await storedAssets(page);
    const desktop = assets.find((a) => a.name === FILES.desktop.name);
    const mobile = assets.find((a) => a.name === FILES.mobile.name);
    // Desktop is captured at 1×, mobile at 2×: works is at 1664 and 1602 CSS px.
    expect(sectionTop(desktop, "works")).toBe(1664);
    expect(sectionTop(mobile, "works")).toBe(3204);
    expect(desktop?.meta?.sections).toHaveLength(7);
    expect(desktop?.meta?.page).toBe(mobile?.meta?.page);
    // Image analysis still runs on screenshots that carry sections.
    expect(mobile?.meta?.bottomColor).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test("a capture file added later attaches to its screenshot in the library", async ({ page }) => {
    await resetAndOpenMedia(page);
    await page.getByTestId("media-input").setInputFiles([FILES.mobile]);
    await expect.poll(async () => (await storedAssets(page)).length).toBe(1);
    expect((await storedAssets(page))[0].meta?.sections).toBeUndefined();

    await page.getByTestId("media-input").setInputFiles([FILES.mobileJson]);
    await expect.poll(async () => sectionTop((await storedAssets(page))[0], "works")).toBe(3204);
    expect(await storedAssets(page)).toHaveLength(1);
  });

  test("a capture file that matches no screenshot says so", async ({ page }) => {
    await resetAndOpenMedia(page);
    await page.getByTestId("media-input").setInputFiles([FILES.desktopJson]);
    await expect(
      page.getByText("aurelia-desktop-1440.json: no screenshot matches this capture file."),
    ).toBeVisible();
    expect(await storedAssets(page)).toHaveLength(0);
  });
});

test.describe("Responsive Scroll: rendering (R04)", () => {
  test.describe.configure({ timeout: 120_000 });

  /** The lab still's pixels, and each card's centre region from the layout geometry. */
  async function still(page: Page, aspect: string, t: number) {
    await page.goto(
      `/lab?still=1&fixture=responsive-scroll&aspect=${encodeURIComponent(aspect)}&t=${t}&w=640`,
    );
    await page.waitForFunction(() => window.__labReady === true, { timeout: 60_000 });
    const png = await page.locator("[data-testid='lab-still'] canvas").screenshot();
    return sharp(png).raw().toBuffer({ resolveWithObject: true });
  }

  /** Mean and spread of luminance in a box given in frame fractions. */
  function region(
    img: { data: Buffer; info: { width: number; height: number; channels: number } },
    box: [number, number, number, number],
  ) {
    const { width, height, channels } = img.info;
    const values: number[] = [];
    for (let y = Math.round(box[1] * height); y < box[3] * height; y++) {
      for (let x = Math.round(box[0] * width); x < box[2] * width; x++) {
        const i = (y * width + x) * channels;
        values.push(0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]);
      }
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
    return { values, sd };
  }

  for (const [aspect, desktopBox, mobileBox] of [
    // Card interiors from responsiveGeometry, in frame fractions (x0, y0, x1, y1).
    ["16:9", [0.15, 0.25, 0.65, 0.75], [0.74, 0.25, 0.88, 0.75]],
    ["4:5", [0.12, 0.1, 0.88, 0.45], [0.42, 0.58, 0.58, 0.9]],
  ] as const) {
    test(`${aspect}: both screens show the page and scroll to the works section`, async ({
      page,
    }) => {
      const top = await still(page, aspect, 0.5);
      const works = await still(page, aspect, 3.6);
      for (const box of [desktopBox, mobileBox]) {
        const a = region(top, [...box]);
        const b = region(works, [...box]);
        // Screenshot content, not the empty-screen fill.
        expect(a.sd).toBeGreaterThan(8);
        expect(b.sd).toBeGreaterThan(8);
        // The screen scrolled: most pixels changed between the top and the works hold.
        const changed = a.values.filter((v, i) => Math.abs(v - b.values[i]) > 12).length;
        expect(changed / a.values.length).toBeGreaterThan(0.1);
      }
    });
  }
});

test.describe("Responsive Scroll: template (R05)", () => {
  async function openGallery(page: Page) {
    await page.setViewportSize({ width: 1280, height: 800 });
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
    await page.getByRole("button", { name: "Start with a template" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }

  const card = (page: Page) =>
    page.locator('[data-testid="template-card"][data-template-id="responsive-scroll"]');

  async function currentShot(page: Page) {
    return page.evaluate(() => {
      const store = (window as unknown as { __editorStore?: StoreHandle }).__editorStore;
      if (!store) throw new Error("__editorStore is unavailable");
      const { doc } = store.getState();
      return {
        shot: doc.shots[0],
        assets: doc.assets.map((a) => a.id),
        templateId: doc.templateId,
      };
    });
  }

  test("sits under the Desktop and the Mobile tab, labelled Desktop + mobile", async ({ page }) => {
    await openGallery(page);
    const gallery = page.getByRole("dialog");
    await expect(card(page)).toBeVisible();
    await expect(card(page).getByTestId("template-category")).toHaveText("Desktop + mobile");
    for (const tab of ["Desktop", "Mobile"]) {
      await gallery.getByRole("button", { name: tab, exact: true }).click();
      await expect(card(page), `${tab} tab`).toBeVisible();
    }
    // The Mobile tab still leaves out desktop-only presets.
    await expect(
      page.locator('[data-testid="template-card"][data-template-id="scroll-story"]'),
    ).toHaveCount(0);
  });

  test("applies with demo content: both full pages scroll, and stops change the length", async ({
    page,
  }) => {
    await openGallery(page);
    await card(page).click();
    await page.getByRole("button", { name: "Apply template" }).click();
    await page.getByRole("button", { name: "Use demo content" }).click();
    await expect.poll(async () => (await currentShot(page)).assets.length).toBe(2);

    const { shot, assets, templateId } = await currentShot(page);
    expect(templateId).toBe("responsive-scroll");
    expect(assets).toEqual(["demo-aurelia-desktop-full", "demo-aurelia-mobile-full"]);
    expect(shot.layout).toEqual({
      kind: "responsive",
      desktopId: "demo-aurelia-desktop-full",
      mobileId: "demo-aurelia-mobile-full",
    });
    expect(shot.scroll?.enabled).toBe(true);
    // 9.4 s loop plus the 0.8 s wrap crossfade (contracts.md §5).
    expect(shot.duration).toBeCloseTo(10.18, 1);

    const inspector = page.locator('[data-panel="inspector"]');
    await expect(inspector.getByRole("button", { name: "Scroll stops" })).toBeVisible();
    await expect(inspector.getByText("Set by the scroll stops")).toBeVisible();
    await expect(inspector.getByRole("switch", { name: "Stop on Works" })).toBeChecked();
    await expect(inspector.getByRole("switch", { name: "Stop on Statement" })).not.toBeChecked();

    await inspector.getByRole("switch", { name: "Stop on Statement" }).click();
    await expect
      .poll(async () => (await currentShot(page)).shot.scroll?.sections)
      .toEqual(["statement", "works", "materials", "monograph"]);
    // One more stop: one more hold, and the moves are split, not shortened.
    expect((await currentShot(page)).shot.duration).toBeGreaterThan(shot.duration + 0.9);

    await inspector.getByRole("button", { name: "Use default stops" }).click();
    await expect.poll(async () => (await currentShot(page)).shot.scroll?.sections).toBeUndefined();
    expect((await currentShot(page)).shot.duration).toBeCloseTo(shot.duration, 6);
  });
});
