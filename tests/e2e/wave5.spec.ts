import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Wave 5: Templates & Gallery, Scroll & Cursor, Export v2", () => {
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

  test("WP-11: Template Gallery Modal opens, filters, applies template, and passes Axe scan", async ({
    page,
  }) => {
    await page.goto("/");
    // Load demo content
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas")).toBeVisible();

    // The Library panel's chips are the same tabs
    const library = page.locator('[data-panel="library"]');
    const libraryIds = () =>
      library
        .getByTestId("library-template-card")
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-template-id")));
    await library.getByRole("button", { name: "Mobile", exact: true }).click();
    await expect.poll(libraryIds).toEqual(["mobile-slider", "mobile-frames"]);
    await library.getByRole("button", { name: "Desktop", exact: true }).click();
    await expect.poll(libraryIds).toEqual(["desktop-slider", "frames", "scroll-story"]);
    await library.getByRole("button", { name: "All", exact: true }).click();

    // Open Library panel Templates tab
    const browseTemplatesBtn = page.getByRole("button", { name: "Browse all templates" });
    await expect(browseTemplatesBtn).toBeVisible();
    await browseTemplatesBtn.click();

    // Verify Template Gallery Modal is open
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal.getByText("Template gallery")).toBeVisible();

    // The tabs match the preset pairs: All · Desktop · Mobile (Frames plan §8)
    for (const name of ["All", "Desktop", "Mobile"]) {
      await expect(modal.getByRole("button", { name, exact: true })).toBeVisible();
    }
    for (const name of ["Single shot", "Portfolio", "Reels", "Responsive"]) {
      await expect(modal.getByRole("button", { name, exact: true })).toHaveCount(0);
    }
    const cards = modal.getByTestId("template-card");
    const cardIds = () =>
      cards.evaluateAll((els) => els.map((el) => el.getAttribute("data-template-id")));
    await modal.getByRole("button", { name: "Mobile", exact: true }).click();
    await expect.poll(cardIds).toEqual(["mobile-slider", "mobile-frames"]);
    // Each card names its tab in words, never the raw id
    await expect(modal.getByTestId("template-category")).toHaveText(["Mobile", "Mobile"]);
    await modal.getByRole("button", { name: "Desktop", exact: true }).click();
    await expect.poll(cardIds).toEqual(["desktop-slider", "frames", "scroll-story"]);
    await expect(modal.getByTestId("template-category")).toHaveText([
      "Desktop",
      "Desktop",
      "Desktop",
    ]);
    await modal.getByRole("button", { name: "All", exact: true }).click();
    await expect(cards).toHaveCount(5);

    // Search filter
    const searchInput = modal.getByPlaceholder(/Search templates/i);
    await searchInput.fill("Scroll");
    await expect(modal.getByRole("heading", { name: "Scroll Story" })).toBeVisible();

    // Clear search
    await searchInput.fill("");

    // Click on the "Desktop Frames" template card (Frames plan D4)
    const framesCard = modal.getByRole("button", { name: "Select template Desktop Frames" });
    await expect(framesCard).toBeVisible();
    await framesCard.click();

    // Apply template
    const applyBtn = modal.getByRole("button", { name: "Apply template" });
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();

    // Modal should close and template applied
    await expect(modal).not.toBeVisible();

    // Reopen modal to run Axe scan
    await browseTemplatesBtn.click();
    await expect(modal).toBeVisible();

    const scanResults = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
    const serious = scanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious).toEqual([]);
  });

  test("WP-15: Scroll Story and Cursor Overlay inspector controls toggle and configure", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas")).toBeVisible();

    // Scroll and cursor are single-device controls, and the first-run demo is Desktop Slider
    // (presets D1), so switch to Scroll Story's single browser first.
    await page.getByRole("button", { name: "Browse all templates" }).click();
    const gallery = page.getByRole("dialog");
    await gallery.getByRole("button", { name: "Select template Scroll Story" }).click();
    await gallery.getByRole("button", { name: "Apply template" }).click();
    await expect(gallery).toBeHidden();

    // Select Shot 1 in the timeline to view ShotInspector
    const shot1Card = page.locator(".group", { hasText: "Shot 1" });
    await shot1Card.click();

    // 1. Scroll section
    await expect(page.getByText("Scroll through page")).toBeVisible();
    const scrollSwitch = page.getByRole("switch", { name: "Scroll through page" });
    await expect(scrollSwitch).toBeVisible();

    // Scroll Story turns scroll on, with its settings (Hold at stops, Easing, Stops)
    await expect(scrollSwitch).toHaveAttribute("data-state", "checked");
    await expect(page.getByText("Hold", { exact: true })).toBeVisible();

    // Toggle scroll OFF hides the settings
    await scrollSwitch.click();
    await expect(scrollSwitch).toHaveAttribute("data-state", "unchecked");
    await expect(page.getByText("Hold", { exact: true })).toHaveCount(0);

    // Toggle scroll ON shows them again
    await scrollSwitch.click();
    await expect(scrollSwitch).toHaveAttribute("data-state", "checked");
    await expect(page.getByText("Hold", { exact: true })).toBeVisible();

    // 2. Cursor section
    await expect(page.getByText("Show cursor")).toBeVisible();
    const cursorSwitch = page.getByRole("switch", { name: "Show cursor" });
    await expect(cursorSwitch).toBeVisible();

    // Toggle cursor ON
    await cursorSwitch.click();
    expect(await cursorSwitch.getAttribute("data-state")).toBe("checked");

    // Cursor Style and Keyframes should be visible
    await expect(page.getByRole("combobox", { name: "Cursor style" })).toBeVisible();
    await expect(page.getByText(/Keyframes/i)).toBeVisible();

    // Verify initial keyframe with Click badge is rendered
    await expect(page.getByText("Click", { exact: true })).toBeVisible();
  });

  test("WP-16: Export v2 destination presets switch dimensions, formats, and passes Axe scan", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas")).toBeVisible();

    // Open Export modal
    const exportBtn = page.getByRole("button", { name: "Export", exact: true });
    await exportBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Export video" })).toBeVisible();

    // Check Destination Presets are rendered
    await expect(dialog.getByRole("button", { name: "Website", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Dribbble/i })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Instagram", exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "4K presentation", exact: true }),
    ).toBeVisible();

    // Select Dribbble preset
    await dialog.getByRole("button", { name: /Dribbble/i }).click();

    // Should indicate Dribbble 4:3 recommendation and switch prompt
    await expect(dialog.getByText(/Preset recommends/i)).toBeVisible();

    // Select 4K presentation preset
    await dialog.getByRole("button", { name: "4K presentation", exact: true }).click();

    // Verify format dropdown options include MP4, WebM, Web Bundle, GIF, Still Frame
    const formatSelect = dialog.getByRole("combobox").first();
    await formatSelect.click();
    await expect(page.getByRole("option", { name: /Animated GIF/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /Web Bundle/i })).toBeVisible();
    await page.keyboard.press("Escape");

    // Run Axe scan on Export Modal
    const scanResults = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
    const serious = scanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious).toEqual([]);
  });
});
