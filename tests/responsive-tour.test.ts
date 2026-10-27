import { describe, expect, it } from "vitest";
import { createDoc } from "../src/doc/defaults";
import type { Aspect, AssetRef, Layout, ProjectDoc } from "../src/doc/types";
import { sanitizeDoc } from "../src/doc/validate";
import { showsCameraControls } from "../src/editor/inspector/shot/camera-visibility";
import { timelineMarks } from "../src/editor/timeline/marks";
import { textureWidths } from "../src/engine/textures/sizing";
import { demoAssetId } from "../src/lab/demo-assets";
import {
  evaluate,
  fixedShotCamera,
  isSteppedLayout,
  type LayoutNode,
  minShotScreenshots,
  paceTargets,
  resolveResponsiveLayout,
  resolveResponsiveTourLayout,
  responsiveGeometry,
  schedule,
  type ScreenPane,
  sliderDuration,
  sliderStep,
} from "../src/motion";
import { aspectRatioValue } from "../src/motion/camera";
import { createEditorStore } from "../src/state/store";
import { convertDocToUserTemplate, fillUserTemplateSlots } from "../src/storage/user-templates";
import {
  BUILTIN_TEMPLATES,
  buildTemplate,
  buildTemplatePreviewDoc,
  missingRequiredSlots,
  pairedTemplateId,
  responsiveTourTemplate,
  templateInCategory,
  templateNeeds,
  validateTemplateRequirements,
} from "../src/templates";
import { FLAT_TONES, templateTones } from "../src/templates/looks";

type TourLayout = Extract<Layout, { kind: "responsive-tour" }>;
type Role = "desktop" | "mobile";

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];

function shotOf(role: Role, i: number): AssetRef {
  return {
    id: `${role}-${i}`,
    kind: "image",
    name: `${role} ${i}`,
    mime: "image/png",
    bytes: 1,
    width: role === "mobile" ? 780 : 2880,
    height: role === "mobile" ? 1688 : 1800,
    role,
  };
}

const shots = (role: Role, n: number) => Array.from({ length: n }, (_, i) => shotOf(role, i));
const ids = (role: Role, n: number) => shots(role, n).map((a) => a.id);

/**
 * A capture of one page, `desktop-<page>` or `mobile-<page>`, that names its page by its capture
 * URL (`meta.page`) or only by its file name, as `npm run capture` writes it
 * (packages/capture/src/naming.mjs).
 */
function pageCapture(role: Role, page: string, by: "url" | "name"): AssetRef {
  const size = role === "mobile" ? "mobile-390@2x" : "desktop-1440";
  return {
    ...shotOf(role, 0),
    id: `${role}-${page}`,
    name: by === "name" ? `example.com_${page}-${size}.png` : `${role}-${page}.png`,
    meta: by === "url" ? { page: `https://example.com/${page}` } : undefined,
  };
}

/** The tour's pages, each as its desktop and mobile screenshot. */
function pagesOf(layout: Layout): [string, string][] {
  if (layout.kind !== "responsive-tour") throw new Error(`Not a tour: ${layout.kind}`);
  return layout.desktopIds.map((id, i) => [id, layout.mobileIds[i]]);
}

function tour(n: number, step = 2): TourLayout {
  return {
    kind: "responsive-tour",
    desktopIds: ids("desktop", n),
    mobileIds: ids("mobile", n),
    step,
  };
}

function cardsAt(layout: TourLayout, aspect: Aspect, t: number): [LayoutNode, LayoutNode] {
  const nodes = resolveResponsiveTourLayout(layout, aspect, t);
  expect(nodes.map((node) => node.id)).toEqual([
    "responsive-tour:desktop",
    "responsive-tour:mobile",
  ]);
  return [nodes[0], nodes[1]];
}

/** A one-shot tour document, as the template builds it. */
function tourDoc(desktops: number, mobiles: number, aspect: Aspect = "16:9"): ProjectDoc {
  const assets = [...shots("desktop", desktops), ...shots("mobile", mobiles)];
  const built = buildTemplate(responsiveTourTemplate, { aspect, assets, name: "Test" });
  return { ...createDoc(), aspect, assets, ...built };
}

/** The part of the screen a pane draws on, [left, right] in screen widths. */
function band(pane: ScreenPane): [number, number] {
  return [Math.max(0, pane.clip[0], pane.offset), Math.min(1, pane.clip[1], pane.offset + 1)];
}

describe("Responsive Tour motion (presets round two, D12)", () => {
  it("moves both cards to the next page together, page i pairing the i-th screenshots", () => {
    const N = 4;
    const layout = tour(N);
    for (let t = 0; t < N * 2; t += 0.05) {
      const [desktop, mobile] = cardsAt(layout, "16:9", t);
      // Every frame lists every page on both cards, in page order.
      expect(desktop.panes!.map((pane) => pane.assetId)).toEqual(layout.desktopIds);
      expect(mobile.panes!.map((pane) => pane.assetId)).toEqual(layout.mobileIds);
      // In step: page i sits at the same offset on both cards, at every time.
      expect(mobile.panes!.map((pane) => pane.offset)).toEqual(
        desktop.panes!.map((pane) => pane.offset),
      );
      // The current page leaves to the left as the next one arrives from the right.
      const { k, p } = sliderStep(t, 2);
      const [current, next] = [k % N, (k + 1) % N];
      expect(desktop.panes![current].offset, `t=${t}`).toBeCloseTo(p < 1 ? -p : 1, 12);
      expect(desktop.panes![next].offset, `t=${t}`).toBeCloseTo(1 - p, 12);
      // Both cards show the same page.
      expect(desktop.assetId?.replace("desktop", "")).toBe(mobile.assetId?.replace("mobile", ""));
      for (const pane of [...desktop.panes!, ...mobile.panes!]) {
        expect(pane.clip).toEqual([0, 1]);
        // A full page shows its top.
        expect(pane.scroll).toBe(0);
      }
    }
  });

  it("never reverses: every page only moves left on both cards", () => {
    for (const n of [2, 3, 5]) {
      const layout = tour(n);
      let previous = cardsAt(layout, "4:5", 0);
      for (let t = 0.01; t < sliderDuration(layout); t += 0.01) {
        const cards = cardsAt(layout, "4:5", t);
        cards.forEach((card, c) => {
          card.panes!.forEach((pane, i) => {
            const before = previous[c].panes![i];
            const [left, right] = band(before);
            // It leaves the left edge (under a thousandth still showing) to wait at the right.
            const wrapped = before.offset < 0 && right - left < 1e-3 && pane.offset === 1;
            expect(pane.offset <= before.offset + 1e-12 || wrapped, `N=${n} t=${t}`).toBe(true);
          });
        });
        previous = cards;
      }
    }
  });

  it("loops natively: frame(N × step) is frame(0) at every aspect and pace", () => {
    for (const aspect of ASPECTS) {
      for (const n of [1, 3, 4, 5]) {
        for (const step of [1.6, 2, 2.4]) {
          const layout = tour(n, step);
          const total = sliderDuration(layout);
          expect(total).toBeCloseTo(n * step, 12);
          expect(cardsAt(layout, aspect, total), `${aspect} N=${n} ${step}`).toEqual(
            cardsAt(layout, aspect, 0),
          );
        }
      }
      // The built document too, through the timeline: a cut wrap, no crossfade.
      const doc = tourDoc(4, 4, aspect);
      const { total } = schedule(doc);
      expect(total).toBe(8);
      expect(evaluate(doc, total)).toEqual(evaluate(doc, 0));
      expect(evaluate(doc, total - 1e-4).layers[0].frame.nodes).toEqual(
        evaluate(doc, 0).layers[0].frame.nodes,
      );
    }
  });

  it("draws a missing side as the empty fill, and an empty tour as two empty cards", () => {
    const layout: TourLayout = { ...tour(3), mobileIds: ["mobile-0", "", "mobile-2"] };
    const [, mobile] = cardsAt(layout, "16:9", 2.5);
    expect(mobile.panes!.map((pane) => pane.assetId)).toEqual(["mobile-0", null, "mobile-2"]);
    const empty = cardsAt({ ...layout, desktopIds: [], mobileIds: [] }, "16:9", 0.4);
    for (const card of empty) {
      expect(card.panes).toEqual([{ assetId: null, offset: 0, clip: [0, 1], scroll: 0 }]);
    }
  });
});

describe("Responsive Tour geometry (quality bar §4)", () => {
  it("is Responsive Scroll's pair of cards at every aspect, still", () => {
    for (const aspect of ASPECTS) {
      const scroll = resolveResponsiveLayout(
        { kind: "responsive", desktopId: "desktop-0", mobileId: "mobile-0" },
        aspect,
      );
      const { desktop, mobile } = responsiveGeometry(aspect);
      for (const t of [0, 2.5, 7.9]) {
        const cards = cardsAt(tour(4), aspect, t);
        cards.forEach((card, i) => {
          const twin = scroll[i];
          expect([card.device, card.width, card.height, card.screenAspect], aspect).toEqual([
            "card",
            twin.width,
            twin.height,
            twin.screenAspect,
          ]);
          expect(card.transform, aspect).toEqual(twin.transform);
          expect(card.opacity).toBe(1);
        });
      }
      const [d, m] = cardsAt(tour(4), aspect, 0);
      if (aspect === "4:5" || aspect === "9:16") {
        // Stacked: desktop on top, both centred across.
        expect([d.transform.x, m.transform.x]).toEqual([0, 0]);
        expect(d.transform.y).toBeGreaterThan(m.transform.y);
      } else {
        // Side by side: desktop left, both centred down.
        expect([d.transform.y, m.transform.y]).toEqual([0, 0]);
        expect(d.transform.x).toBeLessThan(m.transform.x);
      }
      expect([d.screenAspect, m.screenAspect]).toEqual([1.6, 0.4615]);
      // The pair keeps the 7% safe margin.
      const W = aspectRatioValue(aspect);
      const margin = 0.07 * Math.min(W, 1);
      for (const card of [desktop, mobile]) {
        expect(W / 2 - (Math.abs(card.x) + card.width / 2)).toBeGreaterThanOrEqual(margin - 1e-9);
        expect(0.5 - (Math.abs(card.y) + card.height / 2)).toBeGreaterThanOrEqual(margin - 1e-9);
      }
    }
  });

  it("decodes each page at its card's width", () => {
    const doc = tourDoc(4, 4);
    const widths = textureWidths(doc, { outputWidthPx: 1920, supersample: 1 });
    expect([...widths.keys()].sort()).toEqual(doc.assets.map((a) => a.id).sort());
    const { desktop, mobile } = responsiveGeometry("16:9");
    const want = (card: { width: number }) =>
      Math.ceil(((card.width / aspectRatioValue("16:9")) * 1920 * 1.5) / 256) * 256;
    expect(widths.get("desktop-2")).toBe(want(desktop));
    expect(widths.get("mobile-2")).toBe(Math.min(780, want(mobile)));
  });
});

describe("The Responsive Tour template", () => {
  it("is last in the gallery, under both tabs, with 5 pages of slots, 3 required", () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id);
    expect(ids[ids.length - 1]).toBe("responsive-tour");
    expect(ids.indexOf("responsive-tour")).toBe(ids.indexOf("responsive-scroll") + 1);
    const t = responsiveTourTemplate;
    expect([t.name, t.category, pairedTemplateId(t.id)]).toEqual([
      "Responsive Tour",
      "both",
      undefined,
    ]);
    expect(t.description).toBe(
      "Each page in desktop and mobile. Every step moves both to the next page.",
    );
    for (const tab of ["all", "desktop", "mobile"] as const) {
      expect(templateInCategory(t, tab)).toBe(true);
    }
    expect(templateTones(t)).toEqual(FLAT_TONES);
    expect(t.slots.map((s) => [s.key, s.role, s.required, s.prefer])).toEqual(
      [1, 2, 3, 4, 5].flatMap((n) => [
        [`desktop${n}`, "desktop", n <= 3, "any"],
        [`mobile${n}`, "mobile", n <= 3, "any"],
      ]),
    );
  });

  it("needs 3 pages in both sizes, and says so", () => {
    const t = responsiveTourTemplate;
    expect(templateNeeds(t)).toBe("Needs 3+ pages in desktop and mobile");
    const fail = { valid: false, reason: "Needs 3+ pages in desktop and mobile" };
    expect(
      validateTemplateRequirements(t, [...shots("desktop", 5), ...shots("mobile", 2)]),
    ).toEqual(fail);
    expect(validateTemplateRequirements(t, shots("desktop", 3))).toEqual(fail);
    expect(
      validateTemplateRequirements(t, [...shots("desktop", 3), ...shots("mobile", 3)]),
    ).toEqual({ valid: true });
    // With only desktop screenshots, demo content fills the three required mobile slots.
    expect(missingRequiredSlots(t, shots("desktop", 4)).map((s) => s.key)).toEqual([
      "mobile1",
      "mobile2",
      "mobile3",
    ]);
  });

  it("builds a still, natively looping pair of cards on Ash, pairing pages in Library order", () => {
    for (const aspect of ASPECTS) {
      for (const n of [3, 4, 5]) {
        const doc = tourDoc(n, n, aspect);
        const [shot] = doc.shots;
        expect(shot.layout).toEqual(tour(n));
        expect([shot.duration, shot.transitionIn.kind, doc.loop]).toEqual([n * 2, "cut", true]);
        expect(shot.camera).toEqual({ preset: "static", intensity: 0, easing: "smooth" });
        expect(doc.style).toMatchObject({
          background: { kind: "solid", color: "#DFE1E3" },
          frameAppearance: "light",
          shadow: "none",
          grain: 0,
          vignette: 0,
        });
      }
    }
  });

  it("shows only whole pages, each once, when one size runs short", () => {
    // fillSlots reuses a mobile screenshot for pages 4 and 5; those pages are left out.
    expect(tourDoc(5, 3).shots[0].layout).toEqual(tour(3));
    expect(tourDoc(3, 6).shots[0].layout).toEqual(tour(3));
  });

  it("pairs each desktop capture with its page's mobile capture, whatever the Library order", () => {
    const build = (assets: AssetRef[]) =>
      pagesOf(
        buildTemplate(responsiveTourTemplate, { aspect: "16:9", assets, name: "Test" }).shots[0]
          .layout,
      );
    const pages = ["home", "about", "work", "blog"];
    const shuffled = ["work", "blog", "home", "about"];
    for (const by of ["url", "name"] as const) {
      const assets = [
        ...shuffled.map((page) => pageCapture("mobile", page, by)),
        ...pages.map((page) => pageCapture("desktop", page, by)),
      ];
      expect(build(assets), by).toEqual(pages.map((p) => [`desktop-${p}`, `mobile-${p}`]));
    }

    // A desktop capture without a match takes the next mobile screenshot in Library order.
    const unmatched = (id: string): AssetRef => ({ ...shotOf("mobile", 0), id, name: `${id}.png` });
    expect(
      build([
        ...["home", "about", "work"].map((page) => pageCapture("desktop", page, "url")),
        pageCapture("mobile", "about", "url"),
        unmatched("phone-1"),
        unmatched("phone-2"),
      ]),
    ).toEqual([
      ["desktop-home", "phone-1"],
      ["desktop-about", "mobile-about"],
      ["desktop-work", "phone-2"],
    ]);

    // With too few mobile captures, the page without its own is the one left out.
    expect(
      build([
        ...["home", "about", "work"].map((page) => pageCapture("desktop", page, "url")),
        ...["work", "home"].map((page) => pageCapture("mobile", page, "url")),
      ]),
    ).toEqual([
      ["desktop-home", "mobile-home"],
      ["desktop-work", "mobile-work"],
    ]);
  });

  it("previews Aurelia's home, studio, works and journal pages in both sizes", () => {
    const doc = buildTemplatePreviewDoc(responsiveTourTemplate);
    const pages = ["home", "studio", "works", "journal"] as const;
    expect(doc.shots[0].layout).toEqual({
      kind: "responsive-tour",
      desktopIds: pages.map((page) => demoAssetId("aurelia", "desktop", "hero", page)),
      mobileIds: pages.map((page) => demoAssetId("aurelia", "mobile", "hero", page)),
      step: 2,
    });
  });
});

describe("A Responsive Tour is a stepped shot", () => {
  it("lasts N × step on the pace's step, with a still camera, no Camera section and step marks", () => {
    const layout = tour(5);
    expect(isSteppedLayout(layout)).toBe(true);
    expect(minShotScreenshots(layout)).toBe(3);
    expect(paceTargets({ layout }, "16:9")).toEqual({ calm: 2.4, default: 2, brisk: 1.6 });
    const camera = { preset: "pushIn", intensity: 1, easing: "smooth" } as const;
    expect(fixedShotCamera(layout, camera)).toEqual({
      preset: "static",
      intensity: 0,
      easing: "smooth",
    });
    expect(showsCameraControls({ layout, camera })).toBe(false);
    expect(timelineMarks(layout, 10).steps).toEqual([0, 2, 4, 6, 8]);
  });

  it("keeps its pages paired through edits, and N × step through each", () => {
    const doc = tourDoc(3, 3);
    doc.assets.push(shotOf("desktop", 7), shotOf("mobile", 7), shotOf("mobile", 8));
    const store = createEditorStore(doc);
    const layout = () => store.getState().doc.shots[0].layout as TourLayout;
    const duration = () => store.getState().doc.shots[0].duration;
    // A desktop screenshot starts page 4, whose mobile side waits for one.
    store.getState().addAssetToShot(0, "desktop-7");
    expect([layout().desktopIds[3], layout().mobileIds[3], duration()]).toEqual([
      "desktop-7",
      "",
      8,
    ]);
    // A mobile screenshot fills the first page without one.
    store.getState().addAssetToShot(0, "mobile-7");
    expect(layout().mobileIds).toEqual([...ids("mobile", 3), "mobile-7"]);
    // A screenshot dropped on a card joins that card's side.
    store.getState().assignAssetToSlot(0, "responsive-tour:mobile", "mobile-8");
    expect([layout().desktopIds[4], layout().mobileIds[4], duration()]).toEqual([
      "",
      "mobile-8",
      10,
    ]);
    // Moving and removing take a page's two screenshots together.
    store.getState().moveAssetInShot(0, "mobile-7", 0);
    expect([layout().desktopIds[0], layout().mobileIds[0]]).toEqual(["desktop-7", "mobile-7"]);
    expect(layout().desktopIds.slice(1, 4)).toEqual(ids("desktop", 3));
    store.getState().removeAssetFromShot(0, "desktop-1");
    store.getState().removeAssetFromShot(0, "mobile-8");
    expect(layout()).toEqual({
      kind: "responsive-tour",
      desktopIds: ["desktop-7", "desktop-0", "desktop-2"],
      mobileIds: ["mobile-7", "mobile-0", "mobile-2"],
      step: 2,
    });
    // Three pages are the minimum.
    store.getState().removeAssetFromShot(0, "desktop-0");
    expect(layout().desktopIds).toHaveLength(3);
    store.getState().setShotPace(0, "calm");
    expect(layout().step).toBe(2.4);
    expect(duration()).toBeCloseTo(7.2, 12);
  });

  it("puts an added screenshot on its page, by capture URL or file name", async () => {
    const doc = tourDoc(3, 3);
    const added = (store: ReturnType<typeof createEditorStore>) =>
      pagesOf(store.getState().doc.shots[0].layout).slice(3);

    // One at a time, by URL. Blog's desktop capture starts a page, since its mobile one waits in
    // the Library; Contact's mobile capture doesn't take that page, and Blog's joins it.
    const blog = [pageCapture("desktop", "blog", "url"), pageCapture("mobile", "blog", "url")];
    const contact = pageCapture("mobile", "contact", "url");
    const one = createEditorStore({ ...doc, assets: [...doc.assets, ...blog, contact] });
    for (const id of ["desktop-blog", "mobile-contact", "mobile-blog"]) {
      one.getState().addAssetToShot(0, id);
    }
    expect(added(one)).toEqual([
      ["desktop-blog", "mobile-blog"],
      ["", "mobile-contact"],
    ]);

    // Uploaded together in any order, by file name: each page's two captures make one page.
    const uploads = [
      pageCapture("mobile", "about", "name"),
      pageCapture("desktop", "home", "name"),
      pageCapture("mobile", "home", "name"),
      pageCapture("desktop", "about", "name"),
    ];
    const many = createEditorStore(doc);
    await many.getState().addScreenshotsToShot(0, uploads, {});
    expect(added(many)).toEqual([
      ["desktop-about", "mobile-about"],
      ["desktop-home", "mobile-home"],
    ]);
  });
});

describe("Saved Responsive Tours", () => {
  it("round-trip through JSON and sanitizeDoc unchanged", () => {
    const doc = tourDoc(5, 5, "9:16");
    doc.shots[0].pace = "brisk";
    doc.shots[0].layout = { ...(doc.shots[0].layout as TourLayout), step: 1.6 };
    doc.shots[0].duration = 8;
    const { doc: loaded, warnings } = sanitizeDoc(JSON.parse(JSON.stringify(doc)));
    expect(warnings).toEqual([]);
    expect(loaded.shots).toEqual(doc.shots);
    expect(evaluate(loaded, 4.3)).toEqual(evaluate(doc, 4.3));
  });

  it("keep later pages paired when a screenshot is missing, and drop a page with neither", () => {
    const raw = JSON.parse(JSON.stringify(tourDoc(4, 4)));
    raw.shots[0].layout.desktopIds[1] = "gone";
    raw.shots[0].layout.mobileIds.splice(2, 1, "gone-too");
    raw.shots[0].layout.desktopIds[2] = "gone-three";
    raw.shots[0].layout.mobileIds.pop();
    const { doc } = sanitizeDoc(raw);
    expect(doc.shots[0].layout).toEqual({
      kind: "responsive-tour",
      desktopIds: ["desktop-0", "", "desktop-3"],
      mobileIds: ["mobile-0", "mobile-1", ""],
      step: 2,
    });
    expect(doc.shots[0].duration).toBe(6);
  });

  it("keep the tour in a user template", () => {
    const template = convertDocToUserTemplate(tourDoc(4, 4), "Mine");
    const assets = [...shots("desktop", 4), ...shots("mobile", 4)].map((a) => ({
      ...a,
      id: `new-${a.id}`,
    }));
    const filled = fillUserTemplateSlots(template, assets, "4:3");
    expect(filled.shots[0].layout).toEqual({
      kind: "responsive-tour",
      desktopIds: ids("desktop", 4).map((id) => `new-${id}`),
      mobileIds: ids("mobile", 4).map((id) => `new-${id}`),
      step: 2,
    });
    expect(filled.shots[0].duration).toBe(8);
  });

  it("pair pages by capture when a user template is applied to a Library in another order", () => {
    const pages = ["home", "about", "work"];
    const desktops = pages.map((page) => pageCapture("desktop", page, "url"));
    const mobiles = pages.map((page) => pageCapture("mobile", page, "url"));
    const assets = [...desktops, ...mobiles];
    const built = buildTemplate(responsiveTourTemplate, { aspect: "16:9", assets, name: "Test" });
    const template = convertDocToUserTemplate({ ...createDoc(), assets, ...built }, "Mine");
    // Another project with the same pages, its mobile captures in another order.
    const fresh = (a: AssetRef) => ({ ...a, id: `new-${a.id}` });
    const other = [...desktops, mobiles[2], mobiles[0], mobiles[1]].map(fresh);
    expect(pagesOf(fillUserTemplateSlots(template, other, "16:9").shots[0].layout)).toEqual(
      pages.map((p) => [`new-desktop-${p}`, `new-mobile-${p}`]),
    );
  });
});
