import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { AssetRef, ProjectDoc } from "../../src/doc/types";

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
