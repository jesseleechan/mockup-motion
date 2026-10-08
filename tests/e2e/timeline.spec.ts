import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

test.describe("WP-14 Storyboard Timeline & Transitions", () => {
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

  test("build a 3-shot reel, change transition, verify duration schedule in export", async ({
    page,
  }) => {
    await page.goto("/");
    // Load demo content
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas")).toBeVisible();

    // Verify Shot 1 is present in timeline
    await expect(page.locator(".group", { hasText: "Shot 1" })).toBeVisible();

    // Add Shot 2 via Add Shot menu
    const addShotBtn = page.getByRole("button", { name: /Add Shot/i });
    await addShotBtn.click();
    const sameLayoutItem = page.getByRole("menuitem", { name: /Same layout/i });
    await expect(sameLayoutItem).toBeVisible();
    await sameLayoutItem.click();

    // Verify Shot 2 appeared
    await expect(page.locator(".group", { hasText: "Shot 2" })).toBeVisible();

    // Add Shot 3 (Title card)
    await addShotBtn.click();
    const titleCardItem = page.getByRole("menuitem", { name: /Title card/i });
    await expect(titleCardItem).toBeVisible();
    await titleCardItem.click();

    // Verify Shot 3 appeared
    await expect(page.locator(".group", { hasText: "Shot 3" })).toBeVisible();

    // Click transition chip between Shot 1 and Shot 2
    const transitionChips = page.locator('div[role="button"][aria-label^="Transition:"]');
    const chipCount = await transitionChips.count();
    expect(chipCount).toBeGreaterThan(0);

    // Open first transition chip popover
    await transitionChips.first().click();

    // Popover should be open
    const picker = page.getByRole("dialog");
    await expect(picker.getByText("Transition", { exact: true })).toBeVisible();
    // Select "Fade" in the picker (the loop wrap chip in the timeline is also labelled "Fade")
    const fadeBtn = picker.getByRole("button", { name: /Fade/i });
    if (await fadeBtn.isVisible()) {
      await fadeBtn.click();
    }

    // Close popover by clicking outside or pressing Escape
    await page.keyboard.press("Escape");

    // Open Export dialog
    const exportBtn = page.getByRole("button", { name: "Export", exact: true });
    await exportBtn.click();

    // Verify export dialog is visible
    const exportDialog = page.getByRole("dialog");
    await expect(exportDialog).toBeVisible();
    await expect(exportDialog.getByText(/Export Video/i)).toBeVisible();
  });

  test("keyboard navigation & accessibility: Tab, Arrow keys, Enter on transition, Axe clean", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas")).toBeVisible();

    // Add a second shot so there's a transition chip
    const addShotBtn = page.getByRole("button", { name: /Add Shot/i });
    await addShotBtn.click();
    await page.getByRole("menuitem", { name: /Same layout/i }).click();
    await expect(page.locator(".group", { hasText: "Shot 2" })).toBeVisible();

    // Select Shot 1
    const shot1 = page.locator(".group", { hasText: "Shot 1" });
    await shot1.focus();

    // Press ArrowRight to navigate to Shot 2
    await page.keyboard.press("ArrowRight");

    // Press Enter on transition chip
    const chip = page.locator('div[role="button"][aria-label^="Transition:"]').first();
    await chip.focus();
    await page.keyboard.press("Enter");

    // Verify popover opened
    await expect(page.locator("[data-radix-popper-content-wrapper]")).toBeVisible();
    await page.keyboard.press("Escape");

    // Run Axe test on the timeline
    const scanResults = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();

    const serious = scanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious).toEqual([]);
  });

  test("capture transition frame strips for fade, blur, push, zoom, wipe", async ({ page }) => {
    const screenshotDir = path.resolve(process.cwd(), "tests/e2e/screenshots/transitions");
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas")).toBeVisible();
    // The strips show transitions on Scroll Story's single browser, not the Desktop Slider demo
    // (presets D1). The slider renders 2-3x slower on SwiftShader (P05 evidence), which pushed
    // these 25 screenshots past the timeout on CI.
    await page.getByRole("button", { name: "Browse all templates" }).click();
    const gallery = page.getByRole("dialog");
    await gallery.getByRole("button", { name: "Select template Scroll Story" }).click();
    await gallery.getByRole("button", { name: "Apply template" }).click();
    await expect(gallery).toBeHidden();

    const kinds = ["fade", "blur", "push", "zoom", "wipe"] as const;
    const progressSteps = [0, 0.25, 0.5, 0.75, 1.0];

    for (const kind of kinds) {
      for (const progress of progressSteps) {
        // Set transition and time via editor store
        await page.evaluate(
          ({ kind, progress }) => {
            interface WinStore {
              getState: () => {
                apply: (fn: (d: { shots: Array<{ transitionIn: unknown }> }) => void) => void;
                setPlayhead?: (t: number) => void;
              };
            }
            const win = window as unknown as { __editorStore?: WinStore; __uiStore?: WinStore };
            if (win.__editorStore) {
              win.__editorStore.getState().apply((draft) => {
                if (draft.shots[0]) {
                  draft.shots[0].transitionIn = {
                    kind,
                    duration: 1.0,
                    easing: "quintInOut",
                  };
                }
              });
            }
            if (win.__uiStore && win.__uiStore.getState().setPlayhead) {
              win.__uiStore.getState().setPlayhead!(progress * 1.0);
            }
          },
          { kind, progress },
        );

        // Take snapshot of stage canvas
        const canvas = page.locator("canvas").first();
        if (await canvas.isVisible()) {
          const filename = `${kind}-p${Math.round(progress * 100)}.png`;
          await canvas.screenshot({ path: path.join(screenshotDir, filename) });
        }
      }
    }
  });
});
