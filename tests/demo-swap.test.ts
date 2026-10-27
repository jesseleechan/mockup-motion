import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { applyDemoSwap, planDemoSwap } from "../src/editor/demo-swap";
import { createDoc } from "../src/doc/defaults";
import type { AssetRef, ProjectDoc } from "../src/doc/types";
import { applyTemplate, demoAssetsToFill, getTemplateById } from "../src/templates";
import { isDemoAssetId } from "../src/lab/demo-assets";

function upload(id: string, role: "desktop" | "mobile"): AssetRef {
  return {
    id,
    kind: "image",
    name: `${id}.png`,
    mime: "image/png",
    bytes: 1,
    width: 1,
    height: 1,
    role,
  };
}

/** A document after "Try with demo content" on a template, then the given uploads. */
function demoDoc(templateId: string, uploads: AssetRef[]): ProjectDoc {
  const template = getTemplateById(templateId);
  if (!template) throw new Error(`Unknown template ${templateId}`);
  const base = createDoc();
  const filled = { ...base, assets: demoAssetsToFill(template, base.assets) };
  const built = applyTemplate(template, filled);
  return { ...filled, ...built, templateId, assets: [...filled.assets, ...uploads] };
}

function shownIds(doc: ProjectDoc): string[] {
  return doc.shots.flatMap((shot) => {
    const layout = shot.layout;
    if ("assetIds" in layout) return layout.assetIds;
    if (layout.kind === "single") return [layout.assetId];
    if ("desktopId" in layout) return [layout.desktopId, layout.mobileId];
    return [];
  });
}

describe("Use my screenshots", () => {
  it("swaps demo screenshots for uploads in order, in every slot that shows them", () => {
    const demoCount = new Set(shownIds(demoDoc("desktop-slider", []))).size;
    // One more upload than demo screenshots.
    const uploads = Array.from({ length: demoCount + 1 }, (_, i) => upload(`u${i}`, "desktop"));
    const doc = demoDoc("desktop-slider", uploads);
    expect(shownIds(doc).every(isDemoAssetId)).toBe(true);

    const plan = planDemoSwap(doc);
    const swapped = produce(doc, (draft) => applyDemoSwap(draft, plan.replacements));
    expect([...new Set(shownIds(swapped))]).toEqual(uploads.slice(0, demoCount).map((u) => u.id));
    expect(plan.remaining).toBe(0);
    // The replaced demos leave the library; the unused upload stays.
    expect(swapped.assets.some((a) => isDemoAssetId(a.id))).toBe(false);
    expect(swapped.assets.map((a) => a.id)).toContain(`u${demoCount}`);
  });

  it("matches desktop to desktop and mobile to mobile", () => {
    const doc = demoDoc("desktop-slider", [upload("phone", "mobile"), upload("site", "desktop")]);
    const plan = planDemoSwap(doc);
    const [demo] = [...plan.replacements.keys()];
    expect(doc.assets.find((a) => a.id === demo)?.role).toBe("desktop");
    expect([...plan.replacements.values()]).toEqual(["site"]);

    const mobileDoc = demoDoc("mobile-slider", [
      upload("site", "desktop"),
      upload("phone", "mobile"),
    ]);
    expect([...planDemoSwap(mobileDoc).replacements.values()]).toEqual(["phone"]);
  });

  it("keeps demos it has no upload of their role for, and skips uploads a shot already shows", () => {
    const doc = demoDoc("desktop-slider", [upload("m", "mobile"), upload("a", "desktop")]);
    const demos = [...new Set(shownIds(doc))];
    const plan = planDemoSwap(doc);
    expect([...plan.replacements.values()]).toEqual(["a"]);
    expect(plan.remaining).toBe(demos.length - 1);

    const once = produce(doc, (draft) => applyDemoSwap(draft, plan.replacements));
    // "a" is now on screen, so a second swap has nothing to offer.
    expect(planDemoSwap(once).replacements.size).toBe(0);
  });

  it("pairs a page's desktop and mobile uploads by page, else in Library order", () => {
    const pagesAfterSwap = (templateId: string, uploads: AssetRef[]) => {
      const doc = demoDoc(templateId, uploads);
      const swapped = produce(doc, (draft) => applyDemoSwap(draft, planDemoSwap(doc).replacements));
      const layout = swapped.shots[0].layout;
      if (layout.kind === "responsive") return [[layout.desktopId, layout.mobileId]];
      if (layout.kind !== "responsive-tour") throw new Error(`Unexpected ${layout.kind}`);
      return layout.desktopIds.map((id, i) => [id, layout.mobileIds[i]]);
    };
    const byUrl = (id: string, role: "desktop" | "mobile", page: string): AssetRef => ({
      ...upload(id, role),
      meta: { page: `https://example.com/${page}` },
    });

    // Responsive Tour, by capture URL: the mobile uploads sit in another order.
    const pages = ["home", "about", "work", "blog"];
    const shuffled = ["work", "blog", "home", "about"];
    expect(
      pagesAfterSwap("responsive-tour", [
        ...pages.map((page) => byUrl(`d-${page}`, "desktop", page)),
        ...shuffled.map((page) => byUrl(`m-${page}`, "mobile", page)),
      ]),
    ).toEqual(pages.map((page) => [`d-${page}`, `m-${page}`]));

    // Responsive Scroll, by file name: the pair of one page, not the first of each size.
    expect(
      pagesAfterSwap("responsive-scroll", [
        upload("example.com_about-desktop-1440", "desktop"),
        upload("example.com_home-desktop-1440", "desktop"),
        upload("example.com_home-mobile-390@2x", "mobile"),
      ]),
    ).toEqual([["example.com_home-desktop-1440", "example.com_home-mobile-390@2x"]]);

    // Without page data, Library order as before.
    const plain = [
      ...pages.map((page) => upload(`desktop ${page}`, "desktop")),
      ...shuffled.map((page) => upload(`mobile ${page}`, "mobile")),
    ];
    expect(pagesAfterSwap("responsive-tour", plain)).toEqual(
      pages.map((page, i) => [`desktop ${page}`, `mobile ${shuffled[i]}`]),
    );
  });

  it("offers nothing without demo screenshots on screen", () => {
    const doc = { ...createDoc(), assets: [upload("a", "desktop")] };
    expect(planDemoSwap(doc).replacements.size).toBe(0);
  });
});
