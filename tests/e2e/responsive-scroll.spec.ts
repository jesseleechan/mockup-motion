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
