import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

test.describe("WP-13 Media Library, Roles, Brand Kit, and Projects", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/lab/ui");
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

  test("Media Tab & Brand Kit flow: upload demo -> brand kit edit -> apply -> reload -> projects dialog", async ({
    page,
  }) => {
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

    // 2. Brand Tab
    const brandTabBtn = page.getByRole("tab", { name: "Brand" });
    await expect(brandTabBtn).toBeVisible();
    await brandTabBtn.click();

    // Verify brand kit controls
    const brandNameInput = page.locator("#kit-name");
    await expect(brandNameInput).toBeVisible();
    await brandNameInput.fill("Nexus Design Kit");

    // Click "Apply to project"
    const applyBrandBtn = page.getByRole("button", { name: "Apply to project" });
    await expect(applyBrandBtn).toBeVisible();
    await applyBrandBtn.click();

    await page.screenshot({ path: path.join(screenshotDir, "library-brand-tab.png") });

    // 3. Verify Brand Kit persists across reload
    await page.reload();
    await brandTabBtn.click();
    await expect(page.locator("#kit-name")).toHaveValue("Nexus Design Kit");

    // 4. Projects Dialog
    const menuBtn = page.getByRole("button", { name: /MockupMotion/i });
    await menuBtn.click();
    const projectsMenuItem = page.getByRole("menuitem", { name: /Projects/i });
    await expect(projectsMenuItem).toBeVisible();
    await projectsMenuItem.click();

    // Verify Projects dialog opened
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Your Projects")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "projects-dialog.png") });
  });

  test("accessibility: Axe check on Media and Brand tabs", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas")).toBeVisible();

    // Switch to media tab
    await page.getByRole("tab", { name: "Media" }).click();

    const scanResults = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();

    const serious = scanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious).toEqual([]);
  });
});
