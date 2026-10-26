import { describe, expect, it } from "vitest";
import { createDoc } from "../src/doc/defaults";
import type { Aspect, AssetRef, Layout, ProjectDoc } from "../src/doc/types";
import { sanitizeDoc } from "../src/doc/validate";
import { cardCornerRadius } from "../src/engine/devices/card";
import { showsCameraControls } from "../src/editor/inspector/shot/camera-visibility";
import { shotSummary } from "../src/editor/labels";
import { demoAssetId, demoAssetRef } from "../src/lab/demo-assets";
import {
  applyPace,
  evaluate,
  type LayoutNode,
  paceLimited,
  resolveLayout,
  schedule,
} from "../src/motion";
import { aspectRatioValue } from "../src/motion/camera";
import { createEditorStore } from "../src/state/store";
import { convertDocToUserTemplate, fillUserTemplateSlots } from "../src/storage/user-templates";
import {
  buildTemplate,
  buildTemplatePreviewDoc,
  desktopPageColumnsTemplate,
  fittingTemplateId,
  missingRequiredSlots,
  mobilePageColumnsTemplate,
  pairedTemplateId,
  templateNeeds,
  validateTemplateRequirements,
} from "../src/templates";

// Desktop and Mobile Page Columns (docs/presets-2-plan, D9–D11, D13; quality bar §2.2, §4).

type Shape = "desktop" | "mobile";
type PageColumnsLayout = Extract<Layout, { kind: "pageColumns" }>;

const ASPECTS: Aspect[] = ["16:9", "4:3", "1:1", "4:5", "9:16"];
const SPEED_LIMIT = 0.5; // column heights per second (D10)
const WRAP = 0.8;

/**
 * Column count, column width and window height per aspect (quality bar §4). Desktop has fewer,
 * wider columns than mobile at 1:1, 4:5 and 9:16, so its pages drift (owner, 26 October 2026).
 */
const GEOMETRY: Record<Shape, Record<Aspect, [number, number, number]>> = {
  desktop: {
    "16:9": [3, 0.4863, 0.84],
    "4:3": [3, 0.3589, 0.84],
    "1:1": [2, 0.4125, 0.84],
    "4:5": [1, 0.688, 0.84],
    "9:16": [1, 0.48375, 0.84],
  },
  // Never wider than a phone screen: 0.8 × 0.4615 = 0.3692 binds at 16:9.
  mobile: {
    "16:9": [3, 0.3692, 0.8],
    "4:3": [3, 0.3589, 0.8],
    "1:1": [3, 0.2633, 0.8],
    "4:5": [2, 0.3265, 0.8],
    "9:16": [2, 0.2244, 0.8],
  },
};

/** A full-page capture of any size. */
function page(id: string, role: Shape, width: number, height: number): AssetRef {
  return {
    id,
    kind: "image",
    name: `${id}.png`,
    mime: "image/png",
    bytes: 1,
    width,
    height,
    role,
    meta: { tall: true },
  };
}

const full = (site: "aurelia" | "northwind" | "maison-oak", role: Shape) =>
  demoAssetRef(demoAssetId(site, role, "full"));
const demoPages = (role: Shape) => [
  full("aurelia", role),
  full("northwind", role),
  full("maison-oak", role),
];

function columnsDoc(role: Shape, aspect: Aspect, assets = demoPages(role)): ProjectDoc {
  const template = role === "desktop" ? desktopPageColumnsTemplate : mobilePageColumnsTemplate;
  const built = buildTemplate(template, { aspect, assets, name: "Test" });
  return { ...createDoc(), aspect, assets, ...built };
}

/** The single layer's nodes at time t (outside the wrap crossfade). */
function nodesAt(doc: ProjectDoc, t: number): LayoutNode[] {
  const shot = doc.shots[0];
  return resolveLayout(shot.layout, doc.aspect, doc.assets, t, shot.duration);
}

/** A page's travel range in column heights, from the geometry table: fit to the column width. */
function expectedRange(asset: AssetRef, role: Shape, aspect: Aspect): number {
  const [, width, height] = GEOMETRY[role][aspect];
  return Math.max(0, (width * asset.height!) / asset.width! / height - 1);
}

describe("Page Columns geometry (quality bar §4)", () => {
  it("lays out desktop 3, 3, 2, 1, 1 and mobile 3, 3, 3, 2, 2 columns at 16:9, 4:3, 1:1, 4:5, 9:16, centred in 0.86 of the width", () => {
    for (const role of ["desktop", "mobile"] as const) {
      for (const aspect of ASPECTS) {
        const label = `${role} ${aspect}`;
        const [count, width, height] = GEOMETRY[role][aspect];
        const nodes = nodesAt(columnsDoc(role, aspect), 0);
        expect(nodes, label).toHaveLength(count);
        const W = aspectRatioValue(aspect);
        for (const [i, node] of nodes.entries()) {
          expect(node.width, label).toBeCloseTo(width, 4);
          expect(node.height, label).toBeLessThanOrEqual(height + 1e-9);
          expect(node.transform.y, label).toBe(0);
          expect(node.device, label).toBe("card");
          expect(node.cardShape, label).toBe(role);
          if (i > 0) {
            const gap = node.transform.x - nodes[i - 1].transform.x - node.width;
            expect(gap, `${label}: gap`).toBeCloseTo(0.035, 9);
          }
        }
        const left = nodes[0].transform.x - nodes[0].width / 2;
        const right = nodes[count - 1].transform.x + nodes[count - 1].width / 2;
        expect(left + right, `${label}: centred`).toBeCloseTo(0, 9);
        // The 7% safe margin: the group spans at most 0.86 of the frame width and height.
        expect(right - left, label).toBeLessThanOrEqual(0.86 * W + 1e-9);
        if (role === "desktop") expect(right - left, label).toBeCloseTo(0.86 * W, 9);
      }
    }
  });

  it("shows each page fit to its column's width, so nothing is cropped at the sides", () => {
    for (const aspect of ASPECTS) {
      for (const node of nodesAt(columnsDoc("mobile", aspect), 0)) {
        // The card is the screen: its aspect is its own, and the image fills its width.
        expect(node.screenAspect).toBeCloseTo(node.width / node.height, 12);
      }
    }
  });

  it("shows a page shorter than its column whole on a shorter card that stays still", () => {
    const hero = demoAssetRef(demoAssetId("northwind", "desktop", "hero"));
    const assets = [full("aurelia", "desktop"), hero, full("maison-oak", "desktop")];
    const doc = columnsDoc("desktop", "16:9", assets);
    // The slots take full pages first; put the hero in the middle column.
    doc.shots[0].layout = {
      kind: "pageColumns",
      assetIds: assets.map((a) => a.id),
      shape: "desktop",
    };
    const loop = schedule(doc).total;
    for (const t of [0, loop / 2, loop]) {
      const middle = nodesAt(doc, t)[1];
      expect(middle.assetId).toBe(hero.id);
      // As tall as the hero fit to the column width: the screen shows the whole image.
      expect(middle.width / middle.height).toBeCloseTo(hero.width! / hero.height!, 9);
      expect(middle.height).toBeLessThan(0.84);
      expect(middle.scroll).toBe(0);
    }
  });

  it("keeps the desktop card radius on a tall desktop column", () => {
    const node = nodesAt(columnsDoc("desktop", "16:9"), 0)[0];
    expect(node.screenAspect).toBeLessThan(1);
    expect(cardCornerRadius(node.width, node.screenAspect, node.cardShape)).toBeCloseTo(
      0.016 * node.width,
      12,
    );
    const mobile = nodesAt(columnsDoc("mobile", "16:9"), 0)[0];
    expect(cardCornerRadius(mobile.width, mobile.screenAspect, mobile.cardShape)).toBeCloseTo(
      0.075 * mobile.width,
      12,
    );
  });
});

describe("Page Columns motion (D9)", () => {
  it("drifts every column at one constant speed, at most 0.5 column heights per second", () => {
    for (const role of ["desktop", "mobile"] as const) {
      for (const aspect of ASPECTS) {
        const doc = columnsDoc(role, aspect);
        const loop = schedule(doc).total;
        const steps = 24;
        const samples = Array.from({ length: steps + 1 }, (_, k) =>
          nodesAt(doc, (k * loop) / steps),
        );
        for (let c = 0; c < samples[0].length; c++) {
          const label = `${role} ${aspect} column ${c}`;
          const asset = doc.assets.find((a) => a.id === samples[0][c].assetId)!;
          const range = expectedRange(asset, role, aspect);
          const at = samples.map((nodes) => nodes[c].scroll * range); // column heights
          const deltas = at.slice(1).map((v, k) => v - at[k]);
          for (const delta of deltas) expect(delta, label).toBeCloseTo(deltas[0], 9);
          expect(Math.abs(deltas[0]) / (loop / steps), label).toBeLessThanOrEqual(
            SPEED_LIMIT + 1e-9,
          );
        }
      }
    }
  });

  it("drifts every desktop column at every aspect with the demo pages", () => {
    // In columns as narrow as mobile ones the demo desktop pages fit whole, so 1:1 and 9:16 were
    // a still board (owner, 26 October 2026).
    for (const aspect of ASPECTS) {
      const doc = buildTemplatePreviewDoc(desktopPageColumnsTemplate, aspect);
      const start = nodesAt(doc, 0);
      const end = nodesAt(doc, schedule(doc).total);
      start.forEach((node, c) => {
        const asset = doc.assets.find((a) => a.id === node.assetId)!;
        // How far the page, fit to the column's width, reaches past its window, in column heights.
        const range = (node.width * asset.height!) / asset.width! / node.height - 1;
        const travel = Math.abs(end[c].scroll - node.scroll) * range;
        expect(travel, `${aspect} column ${c}`).toBeGreaterThan(0);
      });
    }
  });

  it("never reverses: the first column moves up from its top, the middle one down from its bottom", () => {
    for (const role of ["desktop", "mobile"] as const) {
      const doc = columnsDoc(role, "16:9");
      const duration = doc.shots[0].duration;
      const scrolls = Array.from({ length: 101 }, (_, k) =>
        nodesAt(doc, (k * duration) / 100).map((n) => n.scroll),
      );
      const [first] = scrolls;
      expect(first[0], role).toBe(0);
      expect(first[1], role).toBe(1);
      expect(first[2], role).toBe(0);
      for (let k = 1; k < scrolls.length; k++) {
        expect(scrolls[k][0], role).toBeGreaterThanOrEqual(scrolls[k - 1][0]);
        expect(scrolls[k][1], role).toBeLessThanOrEqual(scrolls[k - 1][1]);
        expect(scrolls[k][2], role).toBeGreaterThanOrEqual(scrolls[k - 1][2]);
      }
      // Each page travels its whole length by the loop point.
      const end = nodesAt(doc, schedule(doc).total).map((n) => n.scroll);
      expect(end, role).toEqual([1, 0, 1]);
    }
  });

  it("wraps with the 0.8 s crossfade: the loop's end is frame(0), and the outgoing pages keep drifting", () => {
    for (const role of ["desktop", "mobile"] as const) {
      for (const aspect of ASPECTS) {
        const label = `${role} ${aspect}`;
        const doc = columnsDoc(role, aspect);
        const shot = doc.shots[0];
        expect(doc.loop, label).toBe(true);
        expect(shot.transitionIn, label).toEqual({
          kind: "fade",
          duration: WRAP,
          easing: "quintInOut",
        });
        const { total } = schedule(doc);
        expect(total, label).toBeCloseTo(shot.duration - WRAP, 9);
        expect(evaluate(doc, total), label).toEqual(evaluate(doc, 0));

        const start = evaluate(doc, 0).layers[0].frame.nodes;
        const end = evaluate(doc, total - 1e-6).layers;
        const incoming = end.reduce((a, b) => (b.weight > a.weight ? b : a));
        expect(incoming.weight, label).toBeGreaterThan(0.999);
        expect(incoming.frame.nodes, label).toEqual(start);

        const mid = evaluate(doc, total - WRAP / 2).layers;
        expect(mid, label).toHaveLength(2);
        const outgoing = mid[0].frame.nodes;
        const later = evaluate(doc, total - WRAP / 4).layers[0].frame.nodes;
        outgoing.forEach((node, c) => {
          if (node.height < 0.8 - 1e-9) return; // a short page stays still
          const moving = later[c].scroll - node.scroll;
          expect(Math.abs(moving), `${label} column ${c}`).toBeGreaterThan(0);
        });
      }
    }
  });

  it("keeps the camera still and offers no Camera controls", () => {
    const doc = columnsDoc("desktop", "16:9");
    doc.shots[0].camera = { preset: "pushIn", intensity: 1, easing: "smooth" };
    const fixed = createEditorStore(doc).getState().doc.shots[0];
    expect(fixed.camera).toEqual({ preset: "static", intensity: 0, easing: "smooth" });
    expect(showsCameraControls(fixed)).toBe(false);
    expect(shotSummary(fixed)).toBe("Desktop page columns · Still");
  });
});

describe("Page Columns duration (D10) and pace (D13)", () => {
  const loopOf = (doc: ProjectDoc) => schedule(doc).total;

  it("loops in 12 s when every page keeps to the limit in less", () => {
    // The desktop demo pages travel under 1 column height at 16:9.
    const doc = columnsDoc("desktop", "16:9");
    expect(loopOf(doc)).toBeCloseTo(12, 9);
    expect(doc.shots[0].duration).toBeCloseTo(12.8, 9);
    expect(desktopPageColumnsTemplate.defaultDuration).toBe(12);
  });

  it("lengthens the loop in 0.5 s steps until the longest page keeps to 0.5 column heights per second", () => {
    // Northwind's mobile page is the longest demo page: 6.66 column heights at 16:9.
    const northwind = full("northwind", "mobile");
    const range = expectedRange(northwind, "mobile", "16:9");
    expect(range / SPEED_LIMIT).toBeGreaterThan(13);
    expect(range / SPEED_LIMIT).toBeLessThanOrEqual(13.5);
    const doc = columnsDoc("mobile", "16:9");
    expect(loopOf(doc)).toBeCloseTo(13.5, 9);
    expect(mobilePageColumnsTemplate.defaultDuration).toBe(13.5);

    const long = page("long", "mobile", 780, 15000);
    const longDoc = columnsDoc("mobile", "16:9", [full("aurelia", "mobile"), long]);
    expect(expectedRange(long, "mobile", "16:9") / SPEED_LIMIT).toBeCloseTo(15.75, 2);
    expect(loopOf(longDoc)).toBeCloseTo(16, 9);
  });

  it("past 30 s loops in 29.2 s and moves each column only as far as the limit allows", () => {
    const veryLong = page("very-long", "mobile", 780, 40000);
    const doc = columnsDoc("mobile", "16:9", [veryLong, full("aurelia", "mobile")]);
    const loop = loopOf(doc);
    expect(loop).toBeCloseTo(29.2, 9);
    expect(doc.shots[0].duration).toBeCloseTo(30, 9);
    const range = expectedRange(veryLong, "mobile", "16:9");
    const travelled = nodesAt(doc, loop)[0].scroll * range;
    expect(travelled).toBeCloseTo(SPEED_LIMIT * loop, 6);
    expect(paceLimited(doc.shots[0], doc.aspect, doc.assets)).toEqual({
      calm: "No room in 30 s",
      brisk: "Already at the speed limit",
    });
  });

  it("scales the loop by 1.2 and 0.8 within the speed limit and 30 s", () => {
    const desktop = columnsDoc("desktop", "16:9");
    const at = (doc: ProjectDoc, pace: "calm" | "brisk") =>
      applyPace(doc.shots[0], pace, doc.aspect, doc.assets).duration - WRAP;
    // 12 × 1.2 = 14.4 → 14.5; 12 × 0.8 = 9.6 → 9.5: Brisk may go under the Default's 12 s.
    expect(at(desktop, "calm")).toBeCloseTo(14.5, 9);
    expect(at(desktop, "brisk")).toBeCloseTo(9.5, 9);
    expect(paceLimited(desktop.shots[0], desktop.aspect, desktop.assets)).toEqual({});

    // The mobile demo's Default is already at the speed limit, so Brisk is unavailable.
    const mobile = columnsDoc("mobile", "16:9");
    expect(at(mobile, "calm")).toBeCloseTo(16, 9); // 13.5 × 1.2 = 16.2 → 16.0
    expect(at(mobile, "brisk")).toBeCloseTo(13.5, 9);
    expect(paceLimited(mobile.shots[0], mobile.aspect, mobile.assets)).toEqual({
      brisk: "Already at the speed limit",
    });
  });

  it("refits the loop when the aspect or the pages change", () => {
    const store = createEditorStore(columnsDoc("mobile", "16:9"));
    store.getState().apply((draft) => {
      draft.aspect = "9:16";
    });
    // 9:16 shows Aurelia and Northwind in narrower columns: both keep to the limit in 12 s.
    expect(store.getState().doc.shots[0].duration).toBeCloseTo(12.8, 9);
    store.getState().apply((draft) => {
      draft.aspect = "16:9";
    });
    store.getState().removeAssetFromShot(0, demoAssetId("northwind", "mobile", "full"));
    const shot = store.getState().doc.shots[0];
    expect(shot.layout.kind === "pageColumns" && shot.layout.assetIds).toHaveLength(2);
    // Without Northwind, Aurelia's 5.77 column heights fit in 12 s.
    expect(shot.duration).toBeCloseTo(12.8, 9);
  });
});

describe("Page Columns templates and slots (D11, D15)", () => {
  it("asks for 2 full pages of one size and takes a third", () => {
    for (const [template, role] of [
      [desktopPageColumnsTemplate, "desktop"],
      [mobilePageColumnsTemplate, "mobile"],
    ] as const) {
      expect(template.category).toBe(role);
      expect(template.slots.map((s) => [s.key, s.role, s.required, s.prefer])).toEqual([
        [`${role}1`, role, true, "tall"],
        [`${role}2`, role, true, "tall"],
        [`${role}3`, role, false, "tall"],
      ]);
      expect(templateNeeds(template)).toBe(`Needs 2+ full-page ${role} screenshots`);
    }
    expect(desktopPageColumnsTemplate.description).toBe(
      "Full pages side by side, drifting slowly through their whole length.",
    );
  });

  it("says what is missing: a second full page, not a short one or one of the other size", () => {
    const template = desktopPageColumnsTemplate;
    const needs = { valid: false, reason: "Needs 2+ full-page desktop screenshots" };
    const one = [full("aurelia", "desktop")];
    expect(validateTemplateRequirements(template, one)).toEqual(needs);
    // A hero in a full-page slot counts as missing, so demo content offers to fill it.
    const hero = demoAssetRef(demoAssetId("northwind", "desktop", "hero"));
    expect(validateTemplateRequirements(template, [...one, hero])).toEqual(needs);
    expect(missingRequiredSlots(template, [...one, hero]).map((s) => s.key)).toEqual(["desktop2"]);
    expect(validateTemplateRequirements(template, [...one, ...demoPages("mobile")])).toEqual(needs);
    const two = [...one, full("northwind", "desktop")];
    expect(validateTemplateRequirements(template, two)).toEqual({ valid: true });
    expect(missingRequiredSlots(template, two)).toEqual([]);
  });

  it("shows each page once, at most 3, and only the first in a single column", () => {
    const single = nodesAt(columnsDoc("desktop", "9:16"), 0);
    expect(single.map((node) => node.assetId)).toEqual([full("aurelia", "desktop").id]);
    const two = columnsDoc("desktop", "16:9", demoPages("desktop").slice(0, 2));
    const layout = two.shots[0].layout as PageColumnsLayout;
    expect(layout.assetIds).toHaveLength(2);
    expect(nodesAt(two, 0)).toHaveLength(2);
    const extra = page("extra", "desktop", 1440, 5000);
    const four = columnsDoc("desktop", "16:9", [...demoPages("desktop"), extra]);
    expect((four.shots[0].layout as PageColumnsLayout).assetIds).not.toContain("extra");
  });

  it("pairs the two sizes and shows demo content from three demo sites", () => {
    expect(pairedTemplateId("desktop-page-columns")).toBe("mobile-page-columns");
    expect(pairedTemplateId("mobile-page-columns")).toBe("desktop-page-columns");
    expect(fittingTemplateId("desktop-page-columns", demoPages("mobile"))).toBe(
      "mobile-page-columns",
    );
    for (const template of [desktopPageColumnsTemplate, mobilePageColumnsTemplate]) {
      const preview = buildTemplatePreviewDoc(template);
      expect(preview.assets.every((a) => a.meta?.tall && a.role === template.category)).toBe(true);
      expect(new Set(preview.assets.map((a) => a.id)).size).toBe(3);
      expect(schedule(preview).total).toBeCloseTo(template.defaultDuration, 9);
    }
  });
});

describe("Page Columns saved documents", () => {
  it("round-trips through JSON and sanitizeDoc unchanged, at every pace", () => {
    for (const role of ["desktop", "mobile"] as const) {
      for (const aspect of ASPECTS) {
        for (const pace of ["calm", "default", "brisk"] as const) {
          const label = `${role} ${aspect} ${pace}`;
          const doc = columnsDoc(role, aspect);
          doc.shots[0] = applyPace(doc.shots[0], pace, aspect, doc.assets);
          const loaded = sanitizeDoc(JSON.parse(JSON.stringify(doc))).doc;
          expect(loaded.shots, label).toEqual(doc.shots);
          expect(loaded.loop, label).toBe(true);
        }
      }
    }
  });

  it("refits a saved duration to its pace and drops screenshots that are gone", () => {
    const doc = columnsDoc("mobile", "16:9");
    const saved = JSON.parse(JSON.stringify(doc)) as ProjectDoc;
    saved.shots[0].duration = 5;
    saved.assets = saved.assets.filter((a) => a.id !== demoAssetId("northwind", "mobile", "full"));
    const loaded = sanitizeDoc(saved).doc.shots[0];
    expect(loaded.layout).toEqual({
      kind: "pageColumns",
      assetIds: [
        demoAssetId("aurelia", "mobile", "full"),
        demoAssetId("maison-oak", "mobile", "full"),
      ],
      shape: "mobile",
    });
    expect(loaded.pace).toBeUndefined();
    expect(loaded.duration).toBeCloseTo(12.8, 9);
  });

  it("keeps its pages through a user template", () => {
    const doc = columnsDoc("desktop", "16:9");
    const saved = convertDocToUserTemplate(doc, "Mine", "");
    const filled = fillUserTemplateSlots(saved, doc.assets, doc.aspect);
    expect(filled.shots[0].layout).toEqual(doc.shots[0].layout);
    expect(filled.shots[0].duration).toBeCloseTo(doc.shots[0].duration, 9);
  });
});
