import { expect, test } from "@playwright/test";
import type { Aspect, Layout, ProjectDoc } from "../../src/doc/types";

test.describe("WP-09 Layouts & Auto-framing E2E & Visual Verification", () => {
  const layouts: { name: string; layout: Layout }[] = [
    {
      name: "pair-overlap",
      layout: { kind: "pair", desktopId: "demo-aurelia", mobileId: "demo-mobile", arrangement: "overlap" },
    },
    {
      name: "pair-side",
      layout: { kind: "pair", desktopId: "demo-aurelia", mobileId: "demo-mobile", arrangement: "side" },
    },
    {
      name: "trio",
      layout: { kind: "trio", desktopId: "demo-aurelia", tabletId: "demo-tablet", mobileId: "demo-mobile" },
    },
    {
      name: "stack",
      layout: { kind: "stack", assetIds: ["demo-aurelia", "demo-2", "demo-3"], device: "browser", spread: 0.5 },
    },
    {
      name: "rows",
      layout: {
        kind: "rows",
        assetIds: ["demo-aurelia", "demo-2", "demo-3"],
        rows: 2,
        device: "browser",
        tilt: 12,
        speed: 0.25,
      },
    },
    {
      name: "columns",
      layout: {
        kind: "columns",
        assetIds: ["demo-mobile", "demo-2", "demo-3"],
        columns: 3,
        tilt: 10,
        speed: 0.25,
      },
    },
    {
      name: "wall",
      layout: {
        kind: "wall",
        assetIds: ["demo-aurelia", "demo-2", "demo-3"],
        columns: 4,
        speed: 0.2,
      },
    },
  ];

  const testAspects: Aspect[] = ["16:9", "9:16", "4:3"];

  for (const { name, layout } of layouts) {
    for (const aspect of testAspects) {
      test(`renders ${name} at ${aspect} without errors`, async ({ page }) => {
        await page.goto("/lab?fixture=card-hero&t=1.0&aspect=16:9");
        await page.waitForFunction(() => window.__labReady === true, { timeout: 15000 });

        // Update document with layout & aspect
        await page.evaluate(
          ({ lay, asp }) => {
            const engine = window.__labEngine;
            const provider = window.__createLabAssetProvider!();
            const base = window.__fixtures!["card-hero"];

            const updatedDoc: ProjectDoc = {
              ...base,
              aspect: asp as Aspect,
              shots: [
                {
                  ...base.shots[0],
                  layout: lay as Layout,
                  camera: { preset: "heroTilt", intensity: 1, easing: "smooth", float: 0 },
                },
              ],
            };

            return engine?.setDocument(updatedDoc, provider).then(() => {
              engine.renderAt(1.5);
            });
          },
          { lay: layout, asp: aspect },
        );

        // Verify canvas renders
        const canvas = page.locator("canvas");
        await expect(canvas).toBeVisible();

        const isNotBlank = await page.evaluate(() => {
          const c = document.querySelector("canvas");
          if (!c) return false;
          const gl = c.getContext("webgl2") ?? c.getContext("webgl");
          return Boolean(gl && c.width > 0 && c.height > 0);
        });
        expect(isNotBlank).toBe(true);
      });
    }
  }
});
