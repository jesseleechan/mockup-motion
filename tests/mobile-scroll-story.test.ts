import { describe, expect, it } from "vitest";
import type { Aspect, AssetRef } from "../src/doc/types";
import { demoAssetId, demoAssetRef } from "../src/lab/demo-assets";
import { resolveLayout } from "../src/motion/layouts";
import { minDurationFor, scrollPosition } from "../src/motion/scroll";
import {
  buildTemplate,
  buildTemplatePreviewDoc,
  fillSlots,
  mobileScrollStoryTemplate,
  scrollStoryDuration,
  scrollStoryTemplate,
} from "../src/templates";

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
// The phone's screen aspect and the part of it below the status bar (quality bar §3.3), written
// out so a change to the phone fails here.
const PHONE_SCREEN_ASPECT = 0.4615;
const PHONE_VIEWPORT = 1 - 62 / 874;

const mobileFull = (site: Parameters<typeof demoAssetId>[0]) =>
  demoAssetRef(demoAssetId(site, "mobile", "full"));
const mobileHero = demoAssetRef(demoAssetId("aurelia", "mobile", "hero"));
const desktopFull = demoAssetRef(demoAssetId("aurelia", "desktop", "full"));

function build(assets: AssetRef[], aspect: Aspect = "9:16") {
  return buildTemplate(mobileScrollStoryTemplate, { aspect, assets, name: "Test" });
}

describe("Mobile Scroll Story", () => {
  it("is the mobile size of Scroll Story", () => {
    expect(mobileScrollStoryTemplate.category).toBe("mobile");
    expect(mobileScrollStoryTemplate.slots).toEqual([
      expect.objectContaining({ role: "mobile", required: true, prefer: "tall" }),
    ]);
  });

  it("takes the tall mobile screenshot and never a desktop one", () => {
    const slots = fillSlots(mobileScrollStoryTemplate, [
      desktopFull,
      mobileHero,
      mobileFull("aurelia"),
    ]);
    expect(Object.values(slots).map((a) => a?.id)).toEqual([mobileFull("aurelia").id]);
    expect(Object.values(fillSlots(mobileScrollStoryTemplate, [desktopFull]))).toEqual([undefined]);
  });

  it("shows one phone with Scroll Story's camera and scroll, on Fog, without a loop", () => {
    const asset = mobileFull("aurelia");
    const mobile = build([asset]);
    const desktop = buildTemplate(scrollStoryTemplate, {
      aspect: "9:16",
      assets: [desktopFull],
      name: "Test",
    });
    expect(mobile.loop).toBe(false);
    expect(mobile.shots).toHaveLength(1);
    const [shot] = mobile.shots;
    expect(shot.layout).toEqual({ kind: "single", device: "phone", assetId: asset.id });
    expect(shot.camera).toEqual({
      preset: "pushIn",
      intensity: 0.2,
      easing: "smooth",
    });
    expect(shot.scroll).toEqual({
      enabled: true,
      stops: [0, 0.33, 0.66, 1],
      hold: 0.8,
      easing: "smooth",
    });
    expect(shot.camera).toEqual(desktop.shots[0].camera);
    expect(shot.scroll).toEqual(desktop.shots[0].scroll);
    expect(mobile.style.background).toEqual(desktop.style.background);
  });

  it("sizes the phone at 70-78% of the frame height at every aspect (quality bar §4)", () => {
    const [shot] = build([mobileFull("aurelia")]).shots;
    for (const aspect of ASPECTS) {
      const [node] = resolveLayout(shot.layout, aspect, [mobileFull("aurelia")], 0, shot.duration);
      expect(node.device, aspect).toBe("phone");
      expect(node.height, aspect).toBeGreaterThanOrEqual(0.7);
      expect(node.height, aspect).toBeLessThanOrEqual(0.78);
    }
  });

  it("lasts 10 s, or longer when the page needs it", () => {
    // Below the status bar, at 0.9 viewport heights per second: Aurelia needs 10.2 s, Northwind
    // 11.3 s, Field Notes 11.0 s, Maison Oak 9.2 s.
    expect(build([mobileFull("aurelia")]).shots[0].duration).toBe(10.5);
    expect(build([mobileFull("northwind")]).shots[0].duration).toBe(11.5);
    expect(build([mobileFull("field-notes")]).shots[0].duration).toBe(11.5);
    expect(build([mobileFull("maison-oak")]).shots[0].duration).toBe(10);
    expect(scrollStoryDuration("phone", mobileHero)).toBe(10);
    expect(scrollStoryDuration("phone", undefined)).toBe(10);
  });

  for (const site of [
    "aurelia",
    "northwind",
    "field-notes",
    "maison-oak",
    "studio-kova",
  ] as const) {
    it(`reaches the bottom of the ${site} page within the speed limit`, () => {
      const asset = mobileFull(site);
      const [shot] = build([asset]).shots;
      const scrollableFrames =
        PHONE_SCREEN_ASPECT / (asset.width! / asset.height!) / PHONE_VIEWPORT - 1;
      // Quality bar §2.2: never faster than 0.9 viewport heights per second on average.
      expect(shot.duration).toBeGreaterThanOrEqual(minDurationFor(shot.scroll!, scrollableFrames));
      // A shot shorter than the scroll would end before the bottom of the page.
      const end = scrollPosition(
        shot.scroll!,
        shot.duration - 1e-6,
        shot.duration,
        scrollableFrames,
      );
      expect(end).toBe(1);
    });
  }

  it("previews Aurelia's full mobile page", () => {
    const doc = buildTemplatePreviewDoc(mobileScrollStoryTemplate);
    expect(doc.assets.map((a) => a.id)).toEqual([mobileFull("aurelia").id]);
    expect(doc.shots[0].layout).toMatchObject({ kind: "single", device: "phone" });
  });
});
