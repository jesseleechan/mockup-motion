import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CaptureMetadata } from "../scripts/capture";
import manifest from "../public/demo/manifest.json" with { type: "json" };

const DEMO_DIR = path.resolve("public/demo");
const SITES = ["aurelia", "northwind", "maison-oak", "field-notes", "studio-kova"];
const pageOf = (m: (typeof manifest)[number]) => m.page ?? "home";
// Every site's home page, then every other page in the manifest (a home page's files sit in the
// site's folder, any other page's in a folder of its own).
const PAGES = [
  ...SITES.map((site) => ({ site, page: "home", dir: site })),
  ...[...new Set(manifest.filter((m) => pageOf(m) !== "home").map((m) => `${m.site}/${m.page}`))]
    .map((dir) => dir.split("/"))
    .map(([site, page]) => ({ site, page, dir: `${site}/${page}` })),
];

function readCapture(dir: string, file: string): CaptureMetadata {
  return JSON.parse(fs.readFileSync(path.join(DEMO_DIR, dir, file), "utf-8")) as CaptureMetadata;
}

function fullPageHeight(site: string, page: string, category: "desktop" | "mobile"): number {
  const entry = manifest.find(
    (m) => m.site === site && pageOf(m) === page && m.category === category && m.role === "full",
  );
  if (!entry) throw new Error(`No ${category} full page for ${site} ${page} in manifest.json`);
  return entry.height;
}

// Responsive Scroll stops both screens on the same section (docs/responsive-scroll-plan, R01).
describe("demo section data", () => {
  for (const { site, page, dir } of PAGES) {
    it(`${site} ${page}: desktop and mobile sections describe the committed full pages`, () => {
      const desktop = readCapture(dir, "sections.json");
      const mobile = readCapture(dir, "sections-mobile.json");

      expect(desktop.viewportWidth * desktop.scale).toBe(1440);
      expect(mobile.viewportWidth * mobile.scale).toBe(780);
      expect(desktop.pageHeight * desktop.scale).toBe(fullPageHeight(site, page, "desktop"));
      expect(mobile.pageHeight * mobile.scale).toBe(fullPageHeight(site, page, "mobile"));

      const ids = (c: CaptureMetadata) => c.sections.map((s) => s.id);
      expect(ids(mobile)).toEqual(ids(desktop));
      for (const capture of [desktop, mobile]) {
        const tops = capture.sections.map((s) => s.top);
        expect(tops).toEqual([...tops].sort((a, b) => a - b));
        expect(Math.max(...tops)).toBeLessThan(capture.pageHeight);
      }
    });
  }
});
