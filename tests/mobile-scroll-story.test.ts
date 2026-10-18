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
// The phone's screen aspect (quality bar §3.3), as `screenAspectFor("phone")` returns it.
const PHONE_SCREEN_ASPECT = 0.4615;

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
      float: 0.05,
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
    // Aurelia needs 9.6 s at 0.9 screen heights per second, Northwind 10.6 s.
    expect(build([mobileFull("aurelia")]).shots[0].duration).toBe(10);
    expect(build([mobileFull("northwind")]).shots[0].duration).toBe(11);
    expect(build([mobileFull("field-notes")]).shots[0].duration).toBe(10.5);
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
      const scrollableFrames = PHONE_SCREEN_ASPECT / (asset.width! / asset.height!) - 1;
      // Quality bar §2.2: never faster than 0.9 screen heights per second on average.
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
