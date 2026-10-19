import { describe, expect, it } from "vitest";
import type { AssetRef } from "../src/doc/types";
import { demoAssetId, demoAssetRef } from "../src/lab/demo-assets";
import {
  buildTemplatePreviewDoc,
  capturePageName,
  fillSlots,
  getTemplateById,
  responsiveScrollTemplate,
  templateInCategory,
  validateTemplateRequirements,
} from "../src/templates";

const demo = (site: "aurelia" | "northwind", device: "desktop" | "mobile") =>
  demoAssetRef(demoAssetId(site, device, "full"));

function upload(name: string, role: "desktop" | "mobile"): AssetRef {
  return {
    id: name,
    kind: "image",
    name,
    mime: "image/png",
    bytes: 1,
    width: role === "desktop" ? 1440 : 780,
    height: 9000,
    role,
    meta: { tall: true },
  };
}

describe("Responsive Scroll template (R05)", () => {
  it("is last in the gallery and sits under both tabs", () => {
    expect(getTemplateById("responsive-scroll")).toBe(responsiveScrollTemplate);
    expect(templateInCategory(responsiveScrollTemplate, "desktop")).toBe(true);
    expect(templateInCategory(responsiveScrollTemplate, "mobile")).toBe(true);
    expect(templateInCategory(responsiveScrollTemplate, "all")).toBe(true);
    const scrollStory = getTemplateById("scroll-story");
    if (!scrollStory) throw new Error("Scroll Story is missing");
    expect(templateInCategory(scrollStory, "mobile")).toBe(false);
  });

  it("builds flat cards on Ash, a still camera and a scroll that loops by crossfade", () => {
    const doc = buildTemplatePreviewDoc(responsiveScrollTemplate, "4:5");
    expect(doc.style.background).toEqual({ kind: "solid", color: "#DFE1E3" });
    expect(doc.style).toMatchObject({ shadow: "none", grain: 0, vignette: 0 });
    expect(doc.loop).toBe(true);
    const [shot] = doc.shots;
    expect(shot.layout).toEqual({
      kind: "responsive",
      desktopId: "demo-aurelia-desktop-full",
      mobileId: "demo-aurelia-mobile-full",
    });
    expect(shot.scroll).toEqual({
      enabled: true,
      stops: [0, 1 / 3, 2 / 3, 1],
      hold: 1,
      easing: "smooth",
    });
    expect(shot.camera).toMatchObject({ preset: "static", intensity: 0, float: 0 });
    expect(shot.transitionIn).toMatchObject({ kind: "fade", duration: 0.8 });
    expect(shot.duration).toBeCloseTo(9.377 + 0.8, 2);
  });

  it("needs a desktop and a mobile screenshot", () => {
    expect(
      validateTemplateRequirements(responsiveScrollTemplate, [demo("aurelia", "desktop")]),
    ).toEqual({
      valid: false,
      reason: "Needs a desktop and a mobile full-page screenshot",
    });
    expect(
      validateTemplateRequirements(responsiveScrollTemplate, [
        demo("aurelia", "desktop"),
        demo("aurelia", "mobile"),
      ]).valid,
    ).toBe(true);
  });

  it("names a capture's page without its size suffix", () => {
    expect(capturePageName("example.com-desktop-1440-full.png")).toBe("example.com");
    expect(capturePageName("example.com-mobile-390@2x-full.png")).toBe("example.com");
    expect(capturePageName("aurelia-desktop-full.webp")).toBe("aurelia");
    expect(capturePageName("homepage.png")).toBe("homepage");
  });

  it("pairs captures of the same page by URL before taking the first of each size", () => {
    // Greedy filling would show Northwind's desktop beside Aurelia's mobile.
    const assets = [
      demo("northwind", "desktop"),
      demo("aurelia", "mobile"),
      demo("aurelia", "desktop"),
      demo("northwind", "mobile"),
    ];
    const slots = fillSlots(responsiveScrollTemplate, assets);
    expect(slots.desktop1?.id).toBe("demo-northwind-desktop-full");
    expect(slots.mobile1?.id).toBe("demo-northwind-mobile-full");
  });

  it("pairs uploads by file name when they carry no capture URL", () => {
    const assets = [
      upload("one.com-desktop-1440-full.png", "desktop"),
      upload("two.com-mobile-390@2x-full.png", "mobile"),
      upload("two.com-desktop-1440-full.png", "desktop"),
      upload("one.com-mobile-390@2x-full.png", "mobile"),
    ];
    const slots = fillSlots(responsiveScrollTemplate, assets);
    expect(slots.desktop1?.id).toBe("one.com-desktop-1440-full.png");
    expect(slots.mobile1?.id).toBe("one.com-mobile-390@2x-full.png");
  });

  it("falls back to the first screenshot of each size when no pair matches", () => {
    const assets = [upload("home.png", "desktop"), upload("phone.png", "mobile")];
    const slots = fillSlots(responsiveScrollTemplate, assets);
    expect(slots.desktop1?.id).toBe("home.png");
    expect(slots.mobile1?.id).toBe("phone.png");
  });

  it("keeps the user's own assignment when the template is applied again", () => {
    const assets = [
      demo("northwind", "desktop"),
      demo("northwind", "mobile"),
      demo("aurelia", "desktop"),
      demo("aurelia", "mobile"),
    ];
    const slots = fillSlots(responsiveScrollTemplate, assets, {
      desktop1: "demo-aurelia-desktop-full",
      mobile1: "demo-northwind-mobile-full",
    });
    expect(slots.desktop1?.id).toBe("demo-aurelia-desktop-full");
    expect(slots.mobile1?.id).toBe("demo-northwind-mobile-full");
  });
});
