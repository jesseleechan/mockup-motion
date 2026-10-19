import { expect, test } from "@playwright/test";

test.describe("WP-08 Shadows and Post-Processing E2E", () => {
  test("shadow presets: renders soft, medium, dramatic without errors", async ({ page }) => {
    await page.goto("/lab?fixture=card-hero&t=0&aspect=16:9");
    await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

    const success = await page.evaluate(async () => {
      const engine = window.__labEngine;
      if (!engine) return false;

      const doc = JSON.parse(JSON.stringify(window.__fixtures?.["card-hero"]));

      for (const preset of ["none", "soft", "medium", "dramatic"] as const) {
        doc.style.shadow = preset;
        await engine.setDocument(doc, window.__createLabAssetProvider!());
        engine.renderAt(0);
      }

      return true;
    });

    expect(success).toBe(true);
  });
});
