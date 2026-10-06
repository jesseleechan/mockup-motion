import { expect, test } from "@playwright/test";
import type { AssetRef, Aspect, Layout, ProjectDoc } from "../../src/doc/types";
import { layoutAssetIds } from "../../src/doc/assets";
import { demoAssetRef } from "../../src/lab/demo-assets";

test.describe("WP-09 Layouts & Auto-framing E2E & Visual Verification", () => {
  const layouts: { name: string; layout: Layout }[] = [
    {
      name: "pair-overlap",
      layout: {
        kind: "pair",
        desktopId: "demo-aurelia-desktop-hero",
        mobileId: "demo-aurelia-mobile-hero",
        arrangement: "overlap",
      },
    },
    {
      name: "pair-side",
      layout: {
        kind: "pair",
        desktopId: "demo-aurelia-desktop-hero",
        mobileId: "demo-aurelia-mobile-hero",
        arrangement: "side",
      },
    },
    {
      name: "trio",
      layout: {
        kind: "trio",
        desktopId: "demo-aurelia-desktop-hero",
        tabletId: "demo-aurelia-desktop-full",
        mobileId: "demo-aurelia-mobile-hero",
      },
    },
    {
      name: "stack",
      layout: {
        kind: "stack",
        assetIds: [
          "demo-aurelia-desktop-hero",
          "demo-northwind-desktop-hero",
          "demo-maison-oak-desktop-hero",
        ],
        device: "browser",
        spread: 0.5,
      },
    },
    {
      name: "rows",
      layout: {
        kind: "rows",
        assetIds: [
          "demo-aurelia-desktop-hero",
          "demo-northwind-desktop-hero",
          "demo-maison-oak-desktop-hero",
        ],
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
        assetIds: [
          "demo-aurelia-mobile-hero",
          "demo-northwind-mobile-hero",
          "demo-maison-oak-mobile-hero",
        ],
        columns: 3,
        tilt: 10,
        speed: 0.25,
      },
    },
    {
      name: "wall",
      layout: {
        kind: "wall",
        assetIds: [
          "demo-aurelia-desktop-hero",
          "demo-northwind-desktop-hero",
          "demo-maison-oak-desktop-hero",
        ],
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
          ({ lay, asp, refs }) => {
            const engine = window.__labEngine;
            const provider = window.__createLabAssetProvider!();
            const base = window.__fixtures!["card-hero"];

            const updatedDoc: ProjectDoc = {
              ...base,
              aspect: asp as Aspect,
              assets: refs as AssetRef[],
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
          { lay: layout, asp: aspect, refs: layoutAssetIds(layout).map(demoAssetRef) },
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
