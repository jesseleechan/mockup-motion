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
