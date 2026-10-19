import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import { BLANK_PAGE } from "../helpers/blank-page";

test.describe("WP-13 Media Library, Roles and Projects", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BLANK_PAGE);
    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      await new Promise<void>((resolve) => {
        const req1 = indexedDB.deleteDatabase("mockupmotion-v2");
        req1.onsuccess = () => resolve();
        req1.onerror = () => resolve();
        req1.onblocked = () => resolve();
      });
    });
  });

  test("Media Tab flow: upload demo -> projects dialog", async ({ page }) => {
    const screenshotDir = path.resolve(process.cwd(), "tests/e2e/screenshots");
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    await page.goto("/");
    // Click "Try with demo content"
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas")).toBeVisible();

    // 1. Media Tab
    const mediaTabBtn = page.getByRole("tab", { name: "Media" });
    await expect(mediaTabBtn).toBeVisible();
    await mediaTabBtn.click();

    // Verify media grid contains thumbnails and badges
    await expect(page.locator(".grid").first()).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "library-media-tab.png") });

    // 2. Projects Dialog
    const menuBtn = page.getByRole("button", { name: /MockupMotion/i });
    await menuBtn.click();
    const projectsMenuItem = page.getByRole("menuitem", { name: /Projects/i });
    await expect(projectsMenuItem).toBeVisible();
    await projectsMenuItem.click();

    // Verify Projects dialog opened
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Your projects")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "projects-dialog.png") });
  });

  test("accessibility: Axe check on the Media tab", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas")).toBeVisible();

    // Switch to media tab
    await page.getByRole("tab", { name: "Media" }).click();

    const scanResults = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();

    const serious = scanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious).toEqual([]);
  });

  test("Media cards show each screenshot, and the badge switches its role", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await page.getByRole("tab", { name: "Media" }).click();

    // Demo screenshots have no stored blob; each card still loads its image (it showed a
    // generic icon before).
    const cards = page.getByTestId("media-card");
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const img = cards.nth(i).locator("img");
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
        .toBeGreaterThan(0);
    }

    const first = cards.first();
    const id = await first.getAttribute("data-asset-id");
    const role = () =>
      page.evaluate(
        (assetId) =>
          (
            window as unknown as {
              __editorStore: {
                getState: () => { doc: { assets: { id: string; role?: string }[] } };
              };
            }
          ).__editorStore
            .getState()
            .doc.assets.find((a) => a.id === assetId)?.role,
        id,
      );
    expect(await role()).toBe("desktop");
    await first.getByRole("button", { name: /Desktop screenshot\. Change to Mobile/ }).click();
    expect(await role()).toBe("mobile");
    await expect(first.getByTestId("media-role")).toHaveText("Mobile");
  });
});
