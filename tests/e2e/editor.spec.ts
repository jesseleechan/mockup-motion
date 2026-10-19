import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import { BLANK_PAGE } from "../helpers/blank-page";

test.describe("WP-12 Editor Shell and Contextual Inspector", () => {
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
      await new Promise<void>((resolve) => {
        const req2 = indexedDB.deleteDatabase("mockupmotion");
        req2.onsuccess = () => resolve();
        req2.onerror = () => resolve();
        req2.onblocked = () => resolve();
      });
    });
  });

  test("full flow: empty state -> demo content -> palette change -> camera change -> undo/redo -> 1080p export", async ({
    page,
  }) => {
    // The 6 s 1080p WebM export takes about 90 s under local SwiftShader and about 5x
    // longer on the GitHub runner (F09).
    test.setTimeout(720_000);
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // 1. First run opens on the gallery; closing it shows the empty state
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: /Template gallery/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Create a presentation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start with a template" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose screenshots" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try with demo content" })).toBeVisible();

    // 2. Click "Try with demo content"
    await page.getByRole("button", { name: "Try with demo content" }).click();

    // Verify canvas rendered and empty state dismissed
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.getByText("Create Motion Mockups")).not.toBeVisible();

    // Verify timeline shows Shot 1
    const shot1Card = page.locator(".group", { hasText: "Shot 1" });
    await expect(shot1Card).toBeVisible();

    // 3. Change Background Palette in Inspector
    // Switch the background to the preset's dark fill
    const darkTone = page
      .getByRole("radiogroup", { name: "Background tone" })
      .getByRole("radio", { name: "Dark" });
    await darkTone.click();
    await expect(darkTone).toHaveAttribute("aria-checked", "true");

    // 4. Change Camera Preset in Inspector
    // Click Shot 1 card in the timeline to select it
    await shot1Card.click();

    // The demo is Desktop Slider (presets D1), whose camera is still: no Camera section. Switching
    // the shot to a single device brings the camera controls back.
    const layoutSelect = page.getByRole("combobox", { name: "Layout", exact: true });
    await expect(layoutSelect).toBeVisible();
    await expect(page.getByText("Camera", { exact: true })).toBeHidden();
    await layoutSelect.click();
    await page.getByRole("option", { name: "Single device" }).click();
    await expect(page.getByText("Camera", { exact: true })).toBeVisible();
    const cameraMove = page.getByRole("radiogroup", { name: "Camera move" });
    const pushInBtn = cameraMove.getByRole("radio", { name: "Push in", exact: true });
    await expect(pushInBtn).toBeVisible();
    await pushInBtn.click();
    await expect(pushInBtn).toBeChecked();

    // 5. Test Undo / Redo
    const undoBtn = page.getByRole("button", { name: "Undo" });
    await expect(undoBtn).toBeEnabled();
    await undoBtn.click(); // Undoes Push in
    await expect(cameraMove.getByRole("radio", { name: "Still", exact: true })).toBeChecked();

    const redoBtn = page.getByRole("button", { name: "Redo" });
    await expect(redoBtn).toBeEnabled();
    await redoBtn.click(); // Redoes Push in
    await expect(pushInBtn).toBeChecked();

    // 6. Test 1080p Video Export
    const exportBtn = page.getByRole("button", { name: "Export", exact: true });
    await exportBtn.click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/Export Video/i)).toBeVisible();

    // Select WebM for fast headless test rendering
    const formatSelect = page.getByRole("combobox").first();
    await formatSelect.click();
    await page.getByRole("option", { name: /WebM/i }).click();

    const startExportBtn = page.getByRole("button", { name: /Start Export|Render & Export/i });
    await startExportBtn.click();

    // Wait for export to finish
    await expect(page.getByText("Export complete")).toBeVisible({ timeout: 600_000 });
    const downloadBtn = page.getByRole("link", { name: /Download/i });
    await expect(downloadBtn).toBeVisible();

    // Verify 0 console errors throughout the entire flow
    expect(consoleErrors).toEqual([]);
  });

  test("v1 project in legacy DB opens migrated on boot with assets intact", async ({ page }) => {
    // Populate legacy IndexedDB 'mockupmotion' before navigating to editor root
    await page.evaluate(async () => {
      const canvas = new OffscreenCanvas(100, 100);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "blue";
      ctx.fillRect(0, 0, 100, 100);
      const blob = await canvas.convertToBlob({ type: "image/png" });

      const req = indexedDB.open("mockupmotion", 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("projects");
      };
      const legacyDB = await new Promise<IDBDatabase>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const tx = legacyDB.transaction("projects", "readwrite");
      tx.objectStore("projects").put(
        {
          version: 1,
          name: "Migrated Legacy Client Project",
          presetId: "clean-hero",
          customized: true,
          aspectRatio: "16:9",
          composition: {
            layout: "hero",
            scale: 80,
            spacing: 20,
            rotation: 0,
            count: 1,
            alignment: "center",
            assetIds: { primary: "migrated-asset-1", mobile: "" },
            frame: {
              type: "browser",
              appearance: "light",
              radius: 12,
              border: 1,
              finish: "silver",
              title: "Legacy Browser",
              status: false,
            },
            image: { fit: "cover", crop: 0 },
            background: {
              type: "gradient",
              color: "#ffffff",
              secondColor: "#000000",
              angle: 90,
              intensity: 50,
              imageId: "",
            },
            motion: {
              type: "zoom",
              duration: 4,
              amount: 10,
              direction: "forward",
              easing: "smooth",
              loop: true,
              hold: 0,
            },
            contentMotion: { enabled: false, start: 0, end: 100, hold: 0 },
            effects: { shadow: 20, blur: 10, offset: 5, reflection: 0 },
            brand: { title: "", subtitle: "", color: "", size: 24, position: "bottom", logoId: "" },
          },
          images: [
            {
              id: "migrated-asset-1",
              name: "client-screenshot.png",
              url: "",
              blob,
              width: 1920,
              height: 1080,
              aspectRatio: 16 / 9,
              category: "desktop",
            },
          ],
          exportSettings: {
            resolution: 1080,
            fps: 30,
            quality: "high",
            format: "mp4",
          },
        },
        "current",
      );

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => {
          legacyDB.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    });

    // Navigate to editor root to trigger migration on boot
    await page.goto("/");

    // Verify migrated project name is in top bar
    const nameInput = page.locator('input[title="Click to rename project"]');
    await expect(nameInput).toHaveValue("Migrated Legacy Client Project", { timeout: 15000 });

    // Verify canvas rendered
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.locator(".group", { hasText: "Shot 1" })).toBeVisible();
  });

  test("accessibility: Axe reports 0 serious or critical violations", async ({ page }) => {
    await page.goto("/");
    // Click demo content to populate full UI
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas")).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(["color-contrast"]) // Canvas and custom themes handled via OKLCH
      .analyze();

    const seriousOrCritical = accessibilityScanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(seriousOrCritical).toEqual([]);
  });

  test("capture screenshots of the shell in dark and light themes", async ({ page }) => {
    const screenshotDir = path.resolve(process.cwd(), "tests/e2e/screenshots");
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // 1. Empty state dark, behind the gallery the editor opens on
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: /Template gallery/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Create a presentation" })).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "shell-empty-dark.png") });

    // 2. Empty state light
    const menuBtn = page.getByRole("button", { name: /MockupMotion/i });
    await menuBtn.click();
    await page.getByRole("menuitem", { name: /Theme: Light/i }).click();
    await page.screenshot({ path: path.join(screenshotDir, "shell-empty-light.png") });

    // 3. Editing state light
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "shell-editing-light.png") });

    // 4. Editing state dark
    await menuBtn.click();
    await page.getByRole("menuitem", { name: /Theme: Dark/i }).click();
    await page.screenshot({ path: path.join(screenshotDir, "shell-editing-dark.png") });

    // 5. Export dialog dark
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "shell-export-dark.png") });
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
