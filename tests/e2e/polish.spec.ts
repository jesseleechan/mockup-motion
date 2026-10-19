import { expect, test } from "@playwright/test";

async function resetAndOpen(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("mockupmotion-v2");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
  await page.goto("/");
}

test.describe("WP-18 polish", () => {
  test("WebGL context loss during playback recovers", async ({ page }) => {
    await resetAndOpen(page);
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas").first()).toBeVisible();
    await page.getByRole("button", { name: "Play" }).first().click();

    await page.evaluate(() => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      const ext = gl?.getExtension("WEBGL_lose_context");
      (window as unknown as { __glExt?: WEBGL_lose_context }).__glExt = ext ?? undefined;
      ext?.loseContext();
    });
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      (window as unknown as { __glExt?: WEBGL_lose_context }).__glExt?.restoreContext();
    });
    await expect(page.locator("canvas").first()).toBeVisible();
    await page.getByRole("button", { name: "Pause" }).first().click();
  });
});
