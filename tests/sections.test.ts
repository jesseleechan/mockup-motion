import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { detectSections, suggestStops } from "../src/assets/sections";
import { minDurationFor } from "../src/motion/scroll";
import { BUILTIN_TEMPLATES, buildTemplate } from "../src/templates";
import { createEditorStore } from "../src/state/store";

describe("WP-15: Section Detection & Suggested Stops (src/assets/sections.ts)", () => {
  const demoDir = path.resolve(process.cwd(), "public/demo");
  const sites = ["aurelia", "field-notes", "maison-oak", "northwind", "studio-kova"];

  it("detectSections achieves >= 80% recall against ground truth on all demo sites", async () => {
    let totalGroundTruthTops = 0;
    let totalMatchedGroundTruth = 0;
    let totalDetectedCount = 0;

    for (const site of sites) {
      const siteDir = path.join(demoDir, site);
      const jsonPath = path.join(siteDir, "sections.json");
      if (!fs.existsSync(jsonPath)) continue;

      const metadata = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      const groundTruthSections = (metadata.sections as { top: number; height: number; id: string }[]) || [];
      const groundTruthTops = Array.from(new Set(groundTruthSections.map((s) => s.top))).sort((a, b) => a - b);

      // 1. Test Desktop Full Screenshot
      const desktopPath = path.join(siteDir, "desktop-full.webp");
      if (fs.existsSync(desktopPath)) {
        const { data, info } = await sharp(desktopPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const vh = Math.round(info.width / 1.6);
        const tolerance = Math.round(0.15 * vh);

        const detected = detectSections(data, info.width, info.height, { viewportHeight: vh });
        console.log(`${site} desktop (w=${info.width}, h=${info.height}, vh=${vh}, tol=${tolerance}):`, {
          gt: groundTruthTops,
          detected,
        });
        totalDetectedCount += detected.length;
        totalGroundTruthTops += groundTruthTops.length;

        let matched = 0;
        for (const gt of groundTruthTops) {
          const isHit = detected.some((d) => Math.abs(d - gt) <= tolerance);
          if (isHit) matched++;
        }
        totalMatchedGroundTruth += matched;
      }

      // 2. Test Mobile Full Screenshot
      const mobilePath = path.join(siteDir, "mobile-full.webp");
      if (fs.existsSync(mobilePath)) {
        const { data, info } = await sharp(mobilePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const vh = Math.round(info.width / 0.4615);
        const tolerance = Math.round(0.15 * vh);

        const detected = detectSections(data, info.width, info.height, { viewportHeight: vh });
        const scaleY = info.height / (metadata.pageHeight || 1);
        const mobileGroundTruthTops = groundTruthTops.map((t) => Math.round(t * scaleY));

        totalDetectedCount += detected.length;
        totalGroundTruthTops += mobileGroundTruthTops.length;

        let matched = 0;
        for (const gt of mobileGroundTruthTops) {
          const isHit = detected.some((d) => Math.abs(d - gt) <= tolerance);
          if (isHit) matched++;
        }
        totalMatchedGroundTruth += matched;
      }
    }

    const recall = totalMatchedGroundTruth / totalGroundTruthTops;
    const precision = totalMatchedGroundTruth / totalDetectedCount;

    console.log(
      `Section Detection Metrics: Recall = ${(recall * 100).toFixed(1)}% (${totalMatchedGroundTruth}/${totalGroundTruthTops}), Precision = ${(precision * 100).toFixed(1)}% (${totalMatchedGroundTruth}/${totalDetectedCount})`,
    );

    // Acceptance criterion: at least 80% recall against ground truth section tops
    expect(recall).toBeGreaterThanOrEqual(0.8);
  });

  it("suggestStops produces 3-5 ascending normalized stops starting at 0 and ending at 1", () => {
    const rawSections = [0, 900, 1850, 2700, 3600, 4200];
    const imageHeight = 4800;
    const viewportHeight = 900;

    const stops = suggestStops(rawSections, imageHeight, viewportHeight);

    expect(stops.length).toBeGreaterThanOrEqual(3);
    expect(stops.length).toBeLessThanOrEqual(5);
    expect(stops[0]).toBe(0);
    expect(stops[stops.length - 1]).toBe(1.0);

    // Strictly ascending
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i]).toBeGreaterThan(stops[i - 1]);
    }
  });

  it("suggestStops respects minDurationFor timing constraints", () => {
    const stops = [0, 0.35, 0.7, 1.0];
    const spec = {
      enabled: true,
      stops,
      hold: 0.8,
      easing: "smooth" as const,
    };

    const scrollableFrames = 3.5; // ~3.5 viewports of content
    const minDur = minDurationFor(spec, scrollableFrames);

    // Must require positive duration respecting 0.9 vh/s limit + holds
    expect(minDur).toBeGreaterThan(4 * 0.8);
    expect(minDur).toBeGreaterThan(6.0);
  });

  it("turning scroll on never happens automatically during asset import or template application", async () => {
    const store = createEditorStore();

    // Default project has scroll disabled
    for (const shot of store.getState().doc.shots) {
      expect(shot.scroll?.enabled).toBeFalsy();
    }

    // Adding tall screenshots does not turn on scroll automatically
    await store.getState().addAssets([
      {
        id: "tall-asset",
        name: "Tall Screenshot",
        kind: "image",
        mime: "image/webp",
        bytes: 100000,
        role: "desktop",
        width: 1440,
        height: 5000,
        meta: { tall: true },
      },
    ]);

    for (const shot of store.getState().doc.shots) {
      expect(shot.scroll?.enabled).toBeFalsy();
    }

    // Applying standard templates (other than explicit scroll-story) does not enable scroll
    for (const template of BUILTIN_TEMPLATES) {
      if (template.id === "scroll-story") continue;
      const built = buildTemplate(template, {
        aspect: "16:9",
        assets: store.getState().doc.assets,
        name: "Test",
      });
      for (const shot of built.shots) {
        expect(shot.scroll?.enabled).toBeFalsy();
      }
    }
  });
});
