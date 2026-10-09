import { describe, expect, it } from "vitest";
import type { AssetRef, AssetRole } from "../src/doc/types";
import {
  BUILTIN_TEMPLATES,
  fittingTemplateId,
  librarySize,
  pairedTemplateId,
} from "../src/templates";

// Frames plan §8, suggestion 2: the gallery picks the size that fits the screenshots.

function image(id: string, role: AssetRole | undefined): AssetRef {
  return { id, kind: "image", name: `${id}.png`, mime: "image/png", bytes: 1, role };
}

const desktop = [image("d1", "desktop"), image("d2", "desktop")];
const mobile = [image("m1", "mobile"), image("m2", "mobile")];

describe("pairedTemplateId", () => {
  it("pairs Desktop Slider with Mobile Slider and Desktop Frames with Mobile Frames", () => {
    expect(pairedTemplateId("desktop-slider")).toBe("mobile-slider");
    expect(pairedTemplateId("mobile-slider")).toBe("desktop-slider");
    expect(pairedTemplateId("frames")).toBe("mobile-frames");
    expect(pairedTemplateId("mobile-frames")).toBe("frames");
  });

  it("gives Scroll Story and unknown ids no pair", () => {
    expect(pairedTemplateId("scroll-story")).toBeUndefined();
    expect(pairedTemplateId("removed-template")).toBeUndefined();
  });

  it("pairs every paired built-in with a built-in of the other category", () => {
    for (const t of BUILTIN_TEMPLATES) {
      const pairId = pairedTemplateId(t.id);
      if (!pairId) continue;
      const pair = BUILTIN_TEMPLATES.find((p) => p.id === pairId);
      expect(pair, t.id).toBeDefined();
      expect(pair!.category, t.id).not.toBe(t.category);
    }
  });
});

describe("librarySize", () => {
  it("is the role every screenshot shares", () => {
    expect(librarySize(mobile)).toBe("mobile");
    expect(librarySize(desktop)).toBe("desktop");
  });

  it("is none for no screenshots, mixed sizes, or tablet screenshots", () => {
    expect(librarySize([])).toBeUndefined();
    expect(librarySize([...mobile, ...desktop])).toBeUndefined();
    expect(librarySize([...mobile, image("t1", "tablet")])).toBeUndefined();
    expect(librarySize([image("t1", "tablet")])).toBeUndefined();
  });

  it("ignores logos, backgrounds, other images and non-image assets", () => {
    const font: AssetRef = { id: "f1", kind: "font", name: "Inter", mime: "font/woff2", bytes: 1 };
    const extras = [
      image("logo", "logo"),
      image("bg", "background"),
      image("x", "other"),
      image("unknown", undefined),
      font,
    ];
    expect(librarySize([...mobile, ...extras])).toBe("mobile");
    expect(librarySize(extras)).toBeUndefined();
  });
});

describe("fittingTemplateId", () => {
  it("offers the mobile size of a desktop preset when every screenshot is mobile", () => {
    expect(fittingTemplateId("desktop-slider", mobile)).toBe("mobile-slider");
    expect(fittingTemplateId("frames", mobile)).toBe("mobile-frames");
  });

  it("offers the desktop size of a mobile preset when every screenshot is desktop", () => {
    expect(fittingTemplateId("mobile-slider", desktop)).toBe("desktop-slider");
    expect(fittingTemplateId("mobile-frames", desktop)).toBe("frames");
  });

  it("offers nothing when the preset already fits", () => {
    expect(fittingTemplateId("mobile-frames", mobile)).toBeUndefined();
    expect(fittingTemplateId("desktop-slider", desktop)).toBeUndefined();
  });

  it("offers nothing with no screenshots or a mixed library, so Desktop Slider stays the default", () => {
    for (const t of BUILTIN_TEMPLATES) {
      expect(fittingTemplateId(t.id, []), t.id).toBeUndefined();
      expect(fittingTemplateId(t.id, [...mobile, ...desktop]), t.id).toBeUndefined();
    }
  });

  it("offers nothing for Scroll Story, which has no mobile size", () => {
    expect(fittingTemplateId("scroll-story", mobile)).toBeUndefined();
  });
});
