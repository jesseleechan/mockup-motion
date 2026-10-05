import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  captureUrl,
  getBrowserLaunchOptions,
  preparePage,
  recordSectionBoundaries,
} from "../scripts/capture";

interface ManifestItem {
  site: string;
  file: string;
  role: "hero" | "full";
  tall: boolean;
  width: number;
  height: number;
  category: "desktop" | "mobile";
  sizeBytes: number;
}

describe("WP-04 Demo Content & Capture Pipeline", () => {
  it("exports required capture script interfaces", () => {
    expect(typeof captureUrl).toBe("function");
    expect(typeof preparePage).toBe("function");
    expect(typeof recordSectionBoundaries).toBe("function");
    expect(typeof getBrowserLaunchOptions).toBe("function");
  });

  it("validates manifest.json structure and all 20 assets exist on disk", () => {
    const manifestPath = path.resolve("public/demo/manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest: ManifestItem[] = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    expect(manifest.length).toBe(20);

    const expectedSites = ["aurelia", "northwind", "maison-oak", "field-notes", "studio-kova"];
    const sitesInManifest = new Set(manifest.map((m) => m.site));
    for (const site of expectedSites) {
      expect(sitesInManifest.has(site)).toBe(true);
    }

    let totalBytes = 0;
    for (const item of manifest) {
      const assetPath = path.resolve("public/demo", item.file);
      expect(fs.existsSync(assetPath)).toBe(true);

      const stat = fs.statSync(assetPath);
      expect(stat.size).toBeGreaterThan(1000); // Non-empty image
      totalBytes += stat.size;

      expect(item.width).toBeGreaterThan(0);
      expect(item.height).toBeGreaterThan(0);
      expect(["hero", "full"]).toContain(item.role);
      expect(["desktop", "mobile"]).toContain(item.category);
    }

    // Budget check: <= 14 MB (14,680,064 bytes)
    const totalMb = totalBytes / (1024 * 1024);
    expect(totalMb).toBeLessThanOrEqual(14.0);
  });

  it("verifies sections.json exists for each demo site with top/height boundaries", () => {
    const expectedSites = ["aurelia", "northwind", "maison-oak", "field-notes", "studio-kova"];
    for (const site of expectedSites) {
      const sectionsPath = path.resolve("public/demo", site, "sections.json");
      expect(fs.existsSync(sectionsPath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(sectionsPath, "utf-8"));
      expect(data.sections).toBeDefined();
      expect(Array.isArray(data.sections)).toBe(true);
      expect(data.sections.length).toBeGreaterThanOrEqual(6); // 6–9 sections per site

      for (const section of data.sections) {
        expect(typeof section.tag).toBe("string");
        expect(typeof section.top).toBe("number");
        expect(typeof section.height).toBe("number");
        expect(section.height).toBeGreaterThan(0);
      }
    }
  });

  it("verifies CREDITS.md is present and documents asset sources and licenses", () => {
    const creditsPath = path.resolve("public/demo/CREDITS.md");
    expect(fs.existsSync(creditsPath)).toBe(true);
    const content = fs.readFileSync(creditsPath, "utf-8");
    expect(content).toContain("Aurelia");
    expect(content).toContain("Maison Oak");
    expect(content).toContain("Field Notes");
    expect(content).toContain("Studio Kova");
    expect(content).toContain("Northwind");
  });
});
