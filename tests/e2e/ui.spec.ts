import { expect, test } from "@playwright/test";

test.describe("/lab/ui Component Gallery & Keyboard Interaction", () => {
  test("renders gallery in dark and light themes", async ({ page }) => {
    await page.goto("/lab/ui");
    await expect(page.locator("h1")).toContainText("UI Design System Gallery");

    // Default dark theme
    const container = page.locator("#ui-gallery");
    await expect(container).toHaveAttribute("data-theme", "dark");

    // Toggle to light theme
    const themeBtn = page.getByRole("button", { name: /Theme:/i });
    await themeBtn.click();
    await expect(container).toHaveAttribute("data-theme", "light");

    // Toggle back to dark theme
    await themeBtn.click();
    await expect(container).toHaveAttribute("data-theme", "dark");
  });

  test("interactive components keyboard navigation (Tab, Arrow keys, Enter, Esc)", async ({
    page,
  }) => {
    await page.goto("/lab/ui");

    // 1. Slider keyboard adjustment via Arrow keys
    const sliderThumb = page.locator('[role="slider"]').first();
    await sliderThumb.focus();
    const initialVal = await sliderThumb.getAttribute("aria-valuenow");
    await page.keyboard.press("ArrowRight");
    const increasedVal = await sliderThumb.getAttribute("aria-valuenow");
    expect(Number(increasedVal)).toBeGreaterThan(Number(initialVal));

    await page.keyboard.press("ArrowLeft");
    const decreasedVal = await sliderThumb.getAttribute("aria-valuenow");
    expect(Number(decreasedVal)).toBe(Number(initialVal));

    // 2. Dialog open with Enter, close with Esc
    const dialogTrigger = page.getByRole("button", { name: "Open Modal Dialog" });
    await dialogTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Export Video Package")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // 3. Dropdown Menu open with Enter, navigate with ArrowDown, dismiss with Esc
    const dropdownTrigger = page.getByRole("button", { name: "Dropdown Menu" });
    await dropdownTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Duplicate Shot" })).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).not.toBeVisible();

    // 4. Toast notification trigger
    const toastBtn = page.getByRole("button", { name: "Trigger Toast" });
    await toastBtn.click();
    await expect(page.getByText("Saved changes successfully")).toBeVisible();
  });
});
