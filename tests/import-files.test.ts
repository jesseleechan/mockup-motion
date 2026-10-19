import { describe, expect, it } from "vitest";
import {
  importRole,
  nameList,
  roleFromName,
  sortImportFiles,
  unsupportedMessage,
} from "../src/editor/import/sort-files";
import type { CaptureFile, CaptureJson } from "../src/assets/capture-json";
import type { AssetRef } from "../src/doc/types";

function entry(path: string, type = "") {
  return { name: path.slice(path.lastIndexOf("/") + 1), path, type };
}

function capture(name: string, viewportWidth: number, scale: number, pageHeight: number) {
  const json: CaptureJson = {
    url: "https://a.test/",
    viewportWidth,
    scale,
    pageHeight,
    sections: [],
  };
  return { name, capture: json } satisfies CaptureFile;
}

function image(name: string, width: number, height: number, role?: AssetRef["role"]): AssetRef {
  return { id: name, kind: "image", name, mime: "image/png", bytes: 1, width, height, role };
}

// The files `npm run capture https://a.test` writes, in the order a folder read returns them.
const CAPTURES_FOLDER = [
  entry("captures/a.test-mobile-390@2x-full.png", "image/png"),
  entry("captures/a.test-desktop-1440.json", "application/json"),
  entry("captures/.DS_Store"),
  entry("captures/a.test-mobile-390@2x.png", "image/png"),
  entry("captures/a.test-desktop-1440-full.png", "image/png"),
  entry("captures/a.test-desktop-1440.png", "image/png"),
  entry("captures/a.test-mobile-390@2x.json", "application/json"),
];

describe("sorting dropped and pasted files", () => {
  it("imports a captures folder's full pages with their JSON, in path order", () => {
    const sorted = sortImportFiles(CAPTURES_FOLDER);
    expect(sorted.images.map((f) => f.name)).toEqual([
      "a.test-desktop-1440-full.png",
      "a.test-mobile-390@2x-full.png",
    ]);
    expect(sorted.captures.map((f) => f.name)).toEqual([
      "a.test-desktop-1440.json",
      "a.test-mobile-390@2x.json",
    ]);
    expect(sorted.viewportDuplicates).toEqual([
      "a.test-desktop-1440.png",
      "a.test-mobile-390@2x.png",
    ]);
    expect(sorted.unsupported).toEqual([]);
  });

  it("keeps a viewport capture whose full page isn't in the import", () => {
    const sorted = sortImportFiles([
      entry("c/a.test-desktop-1440.png", "image/png"),
      entry("c/a.test-desktop-1440.json", "application/json"),
    ]);
    expect(sorted.images.map((f) => f.name)).toEqual(["a.test-desktop-1440.png"]);
  });

  it("keeps same-named screenshots that no capture file describes", () => {
    const sorted = sortImportFiles([
      entry("home.png", "image/png"),
      entry("home-full.png", "image/png"),
    ]);
    expect(sorted.images).toHaveLength(2);
  });

  it("orders numbered files naturally and names unsupported ones", () => {
    const sorted = sortImportFiles([
      entry("shots/page-10.png", "image/png"),
      entry("shots/notes.txt", "text/plain"),
      entry("shots/page-2.jpg"),
      entry("shots/logo.svg", "image/svg+xml"),
      entry("shots/thumbs.db"),
    ]);
    expect(sorted.images.map((f) => f.name)).toEqual(["page-2.jpg", "page-10.png"]);
    expect(sorted.unsupported).toEqual(["logo.svg", "notes.txt"]);
    expect(unsupportedMessage(sorted.unsupported)).toBe(
      "Not imported: logo.svg, notes.txt. Use PNG, JPG, WebP, or AVIF.",
    );
    expect(unsupportedMessage([])).toBeUndefined();
    expect(nameList(["a", "b", "c", "d", "e"])).toBe("a, b, c and 2 more");
  });
});

describe("roles of imported screenshots", () => {
  it("reads desktop and mobile from file names", () => {
    expect(roleFromName("a.test-desktop-1440-full.png")).toBe("desktop");
    expect(roleFromName("a.test-mobile-390@2x-full.png")).toBe("mobile");
    expect(roleFromName("Home (iPhone).png")).toBe("mobile");
    expect(roleFromName("desktopia.png")).toBeUndefined();
    expect(roleFromName("Pasted screenshot.png")).toBeUndefined();
  });

  it("uses the matching capture's viewport when the name says nothing", () => {
    const captures = [capture("site-a.json", 1440, 2, 6000), capture("site-b.json", 390, 3, 4000)];
    // A full-page desktop capture is taller than wide, so its size alone says mobile.
    expect(importRole(image("site-a-full.png", 2880, 12000, "mobile"), captures)).toBe("desktop");
    expect(importRole(image("site-b.png", 1170, 12000, "desktop"), captures)).toBe("mobile");
    // A capture of another size describes another image.
    expect(importRole(image("site-a.png", 2880, 1800, "desktop"), captures)).toBe("desktop");
    expect(importRole(image("site-a.png", 1000, 3000, "mobile"), captures)).toBe("mobile");
  });

  it("lets the name win over the capture", () => {
    const captures = [capture("x-mobile.json", 1440, 1, 3000)];
    expect(importRole(image("x-mobile.png", 1440, 3000, "desktop"), captures)).toBe("mobile");
  });
});
