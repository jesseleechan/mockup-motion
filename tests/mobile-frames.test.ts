import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Aspect, AssetRef, Layout, ProjectDoc } from "../src/doc/types";
import { createDoc } from "../src/doc/defaults";
import { sanitizeDoc } from "../src/doc/validate";
import { changeAspect } from "../src/editor/aspect";
import { aspectRatioValue } from "../src/motion/camera";
import { evaluate } from "../src/motion/evaluate";
import { framesDuration, type LayoutNode, resolveLayout } from "../src/motion/layouts";
import { schedule } from "../src/motion/timeline";
import { createEditorStore } from "../src/state/store";
import {
  BUILTIN_TEMPLATES,
  buildTemplate,
  fillSlots,
  framesLayout,
  framesTemplate,
  mobileFramesLayout,
  mobileFramesTemplate,
  refitFramesLayout,
  validateTemplateRequirements,
} from "../src/templates";
import { desktopFramesDocs } from "./fixtures/desktop-frames-template-cases";

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
const COUNTS = [4, 5, 6];
// Quality bar §4 (Mobile Frames), written out so a change to the template fails here.
const COMPOSITION: Record<Aspect, { columns: number; cardWidth: number }> = {
  "16:9": { columns: 5, cardWidth: 0.269 },
  "4:3": { columns: 4, cardWidth: 0.253 },
  "1:1": { columns: 3, cardWidth: 0.258 },
  "4:5": { columns: 3, cardWidth: 0.246 },
  "9:16": { columns: 2, cardWidth: 0.222 },
};
// docs/phone-frames-plan/README.md §3: the shot duration for N = 4 / 5 / 6.
const DURATIONS: Record<Aspect, number[]> = {
  "16:9": [15, 16.5, 19.5],
  "4:3": [15, 15.5, 18.5],
  "1:1": [15, 16, 19],
  "4:5": [15, 15, 18],
  "9:16": [15, 15, 16.5],
};
const GAP = 0.065;
const PHONE_SCREEN_ASPECT = 0.4615;
// Quality bar §4: side margins of 4.8% of the frame width; at 4:5 the outer columns are
// cropped by 14% of their width.
const SIDE_MARGIN = 0.048;
const OUTER_CROP_4X5 = 0.14;

const mobile = (n: number, height = 2532): AssetRef => ({
  id: `m${n}`,
  kind: "image",
  name: `Mobile ${n}`,
  mime: "image/png",
  bytes: 100,
  width: 1170,
  height,
  role: "mobile",
});
const mobiles = (count: number, height?: number) =>
  Array.from({ length: count }, (_, i) => mobile(i + 1, height));
const desktop = (n: number): AssetRef => ({
  id: `d${n}`,
  kind: "image",
  name: `Desktop ${n}`,
  mime: "image/png",
  bytes: 100,
  width: 1440,
  height: 900,
  role: "desktop",
});
const desktops = (count: number) => Array.from({ length: count }, (_, i) => desktop(i + 1));

function mobileFramesDoc(aspect: Aspect, assets: AssetRef[]): ProjectDoc {
  const built = buildTemplate(mobileFramesTemplate, { aspect, assets, name: "Mobile Frames" });
  return { ...createDoc(), aspect, assets, ...built, templateId: mobileFramesTemplate.id };
}

const nodesAt = (doc: ProjectDoc, t: number) => {
  const shot = doc.shots[0];
  return resolveLayout(shot.layout, doc.aspect, doc.assets, t, shot.duration, shot.entrance);
};
const colOf = (node: LayoutNode) => Number(node.id.match(/^col(\d+):/)![1]);
// Rounds to 4 decimals without a "-0.0000" for values just below zero.
const round4 = (v: number) => (Math.round(v * 1e4) / 1e4 + 0).toFixed(4);
const within3Percent = (actual: number, expected: number, what: string) =>
  expect(Math.abs(actual / expected - 1), `${what}: ${actual} vs ${expected}`).toBeLessThan(0.03);

describe("Desktop Frames is unchanged by the factory (Frames plan PF03, D4)", () => {
  it("builds the same documents as the template before PF03", () => {
    const golden = JSON.parse(
      readFileSync(new URL("./fixtures/desktop-frames-template.json", import.meta.url), "utf8"),
    );
    expect(Object.keys(golden)).toHaveLength(15);
    expect(desktopFramesDocs()).toEqual(golden);
  });

  it("keeps the id and description, and shows the name Desktop Frames", () => {
    expect(framesTemplate).toMatchObject({
      id: "frames",
      name: "Desktop Frames",
      description: "Rows of desktop screens that glide past in alternating directions.",
      category: "desktop",
    });
  });
});

describe("Mobile Frames template (Frames plan PF03)", () => {
  it("is registered after Desktop Frames with mobile slots, 4 of them required", () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id);
    expect(ids.indexOf("mobile-frames")).toBe(ids.indexOf("frames") + 1);
    expect(mobileFramesTemplate).toMatchObject({
      id: "mobile-frames",
      name: "Mobile Frames",
      description: "Columns of mobile screens that glide up and down in alternating directions.",
      category: "mobile",
    });
    expect(mobileFramesTemplate.slots.map((s) => [s.key, s.role, s.required])).toEqual([
      ["mobile1", "mobile", true],
      ["mobile2", "mobile", true],
      ["mobile3", "mobile", true],
      ["mobile4", "mobile", true],
      ["mobile5", "mobile", false],
      ["mobile6", "mobile", false],
    ]);
  });

  it("builds at all five aspects with a native loop and a cut wrap", () => {
    for (const aspect of ASPECTS) {
      COUNTS.forEach((count, i) => {
        const doc = mobileFramesDoc(aspect, mobiles(count));
        const label = `${aspect} N=${count}`;
        expect(sanitizeDoc(doc).warnings, label).toEqual([]);
        expect(doc.shots, label).toHaveLength(1);
        const shot = doc.shots[0];
        expect(shot.layout, label).toEqual({
          kind: "columns",
          assetIds: mobiles(count).map((a) => a.id),
          ...COMPOSITION[aspect],
          device: "card",
          tilt: 0,
          speed: 0.35,
          gap: GAP,
          travel: "period",
        });
        expect(doc.loop, label).toBe(true);
        expect(shot.transitionIn.kind, label).toBe("cut");
        expect(shot.entrance, label).toBe("none");
        expect(shot.duration, label).toBe(DURATIONS[aspect][i]);
        expect(schedule(doc).total, label).toBe(shot.duration);
        expect(shot.duration, label).toBeGreaterThanOrEqual(15);
        expect(doc.style.background).toEqual({ kind: "solid", color: "#DFE1E3" });
        expect(doc.style).toMatchObject({ shadow: "none", grain: 0, vignette: 0 });
        expect(shot.camera).toEqual({ preset: "static", intensity: 0, easing: "smooth", float: 0 });

        // evaluate wraps t = total to 0, so compare the frame just before the loop point too:
        // it already shows the cards of the first frame (cut wrap, no crossfade).
        const total = schedule(doc).total;
        expect(evaluate(doc, total), label).toEqual(evaluate(doc, 0));
        const first = evaluate(doc, 0).layers;
        const last = evaluate(doc, total - 1e-6).layers;
        expect(first, label).toHaveLength(1);
        expect(last, label).toHaveLength(1);
        // Cards within a card of the frame; far out, a ring card may sit on either end
        // (tests/columns-period.test.ts).
        const cards = (nodes: LayoutNode[]) =>
          nodes
            .filter((n) => Math.abs(n.transform.y) < 0.5 + n.height)
            .map((n) => `${n.assetId}|${round4(n.transform.x)}|${round4(n.transform.y)}`)
            .sort();
        // At least two cards per column are near the frame, so the comparison is not empty.
        expect(cards(first[0].frame.nodes).length, label).toBeGreaterThanOrEqual(
          2 * COMPOSITION[aspect].columns,
        );
        expect(cards(last[0].frame.nodes), label).toEqual(cards(first[0].frame.nodes));
      });
    }
  });

  it("matches the quality bar §4 composition within 3% at every aspect", () => {
    for (const aspect of ASPECTS) {
      const { columns, cardWidth } = COMPOSITION[aspect];
      const W = aspectRatioValue(aspect);
      const nodes = nodesAt(mobileFramesDoc(aspect, mobiles(5)), 0);
      const card = nodes[0];
      within3Percent(card.width, cardWidth, `${aspect} card width`);
      within3Percent(card.height, cardWidth / PHONE_SCREEN_ASPECT, `${aspect} card height`);

      const xs = [...new Set(nodes.map((n) => round4(n.transform.x)))].map(Number);
      xs.sort((a, b) => a - b);
      expect(xs, `${aspect} columns`).toHaveLength(columns);
      expect(xs[0] + xs[xs.length - 1], `${aspect} centred`).toBeCloseTo(0, 9);
      within3Percent(xs[1] - xs[0] - card.width, GAP, `${aspect} gap between columns`);
      const column = nodes
        .filter((n) => colOf(n) === 0)
        .map((n) => n.transform.y)
        .sort((a, b) => a - b);
      within3Percent(column[1] - column[0] - card.height, GAP, `${aspect} gap in a column`);

      // How far the outer columns' edges sit inside (+) or outside (−) the frame.
      const inside = W / 2 - (xs[xs.length - 1] + card.width / 2);
      if (aspect === "4:5") {
        within3Percent(-inside / card.width, OUTER_CROP_4X5, `${aspect} outer column crop`);
      } else {
        within3Percent(inside / W, SIDE_MARGIN, `${aspect} side margin`);
      }
      // Quality bar §4: cards are 0.48–0.58 of the frame height tall.
      expect(card.height, aspect).toBeGreaterThanOrEqual(0.48 - 0.005);
      expect(card.height, aspect).toBeLessThanOrEqual(0.58 + 0.005);
    }
  });

  it("draws every screen as a portrait card at the phone aspect, even a full-page capture", () => {
    for (const aspect of ASPECTS) {
      // A 1170 × 5000 full-page capture: screenAspectFor("card", …) would give 1.6 and crop it
      // to a landscape strip.
      const doc = mobileFramesDoc(aspect, mobiles(4, 5000));
      for (const t of [0, 3.3, doc.shots[0].duration / 2]) {
        for (const node of nodesAt(doc, t)) {
          const where = `${aspect} t=${t} ${node.id}`;
          expect(node.device, where).toBe("card");
          expect(node.screenAspect, where).toBe(PHONE_SCREEN_ASPECT);
          // The card is the screen's own aspect, so the screenshot fits its width exactly.
          expect(node.width / node.height, where).toBeCloseTo(PHONE_SCREEN_ASPECT, 9);
          expect(node.transform, where).toMatchObject({ rx: 0, ry: 0, scale: 1 });
          expect(Math.abs(node.transform.rz), where).toBe(0);
        }
      }
    }
  });
});

describe("Mobile Frames slots (Frames plan PF03, D8)", () => {
  it("needs 4 mobile screenshots", () => {
    expect(validateTemplateRequirements(mobileFramesTemplate, mobiles(3))).toEqual({
      valid: false,
      reason: "Needs 4+ mobile screenshots",
    });
    expect(validateTemplateRequirements(mobileFramesTemplate, mobiles(4))).toEqual({ valid: true });
  });

  it("never fills a mobile slot with a desktop screenshot", () => {
    const assets = [...desktops(6), ...mobiles(3)];
    expect(validateTemplateRequirements(mobileFramesTemplate, assets)).toEqual({
      valid: false,
      reason: "Needs 4+ mobile screenshots",
    });
    const slots = fillSlots(mobileFramesTemplate, desktops(6));
    expect(Object.values(slots).every((asset) => asset === undefined)).toBe(true);
    const built = buildTemplate(mobileFramesTemplate, { aspect: "4:5", assets, name: "x" });
    const ids = (built.shots[0].layout as { assetIds: string[] }).assetIds;
    expect(ids).toEqual(["m1", "m2", "m3"]);
  });
});

describe("Mobile Frames in the editor store (Frames plan PF03)", () => {
  function frameStore(count: number) {
    const store = createEditorStore();
    const doc = mobileFramesDoc("4:5", mobiles(count));
    store
      .getState()
      .applyTemplateResult(
        { style: doc.style, shots: doc.shots, loop: doc.loop },
        mobileFramesTemplate.id,
      );
    store.getState().apply((draft) => {
      draft.aspect = "4:5";
      draft.assets = mobiles(6);
    });
    return store;
  }

  it("keeps the shot duration at or above framesDuration", () => {
    const store = frameStore(6);
    const layout = store.getState().doc.shots[0].layout as Parameters<typeof framesDuration>[0];
    expect(layout.kind).toBe("columns");
    const shortest = framesDuration(layout, "4:5");
    expect(shortest).toBeGreaterThan(3);
    store.getState().setShotDuration(0, 3);
    expect(store.getState().doc.shots[0].duration).toBe(shortest);
    store.getState().setShotDuration(0, 25);
    expect(store.getState().doc.shots[0].duration).toBe(25);
  });

  it("lengthens the shot when another screenshot lengthens the period", () => {
    const store = frameStore(5);
    store.getState().setShotDuration(0, 1);
    const before = store.getState().doc.shots[0].duration;
    store.getState().assignAssetToSlot(0, "add", "m6");
    const after = store.getState().doc.shots[0];
    const layout = after.layout as Parameters<typeof framesDuration>[0];
    expect(layout.assetIds).toHaveLength(6);
    expect(after.duration).toBe(framesDuration(layout, "4:5"));
    expect(after.duration).toBeGreaterThan(before);
  });
});

describe("Changing the aspect re-fits Frames shots (Frames plan D13)", () => {
  const tilted: Layout[] = [
    {
      kind: "rows",
      assetIds: ["d1", "d2", "d3"],
      rows: 2,
      device: "browser",
      tilt: 8,
      speed: 0.35,
    },
    { kind: "columns", assetIds: ["m1", "m2", "m3"], columns: 3, tilt: 12, speed: 0.4 },
    { kind: "columns", assetIds: ["m1", "m2"], columns: 2, tilt: 0, speed: 0.4, device: "card" },
  ];

  it("gives Mobile Frames the layout and duration it is built with at the new aspect", () => {
    for (const count of COUNTS) {
      for (const from of ASPECTS) {
        for (const to of ASPECTS) {
          const doc = mobileFramesDoc(from, mobiles(count));
          const fresh = mobileFramesDoc(to, mobiles(count));
          changeAspect(doc, to);
          const label = `N=${count} ${from} → ${to}`;
          expect(doc.aspect, label).toBe(to);
          expect(doc.shots[0].layout, label).toEqual(fresh.shots[0].layout);
          // Moving to an aspect that needs a longer loop lengthens the shot; a shorter
          // minimum keeps the shot's length.
          expect(doc.shots[0].duration, label).toBe(
            Math.max(
              mobileFramesDoc(from, mobiles(count)).shots[0].duration,
              fresh.shots[0].duration,
            ),
          );
        }
      }
    }
    const doc = mobileFramesDoc("9:16", mobiles(6));
    changeAspect(doc, "16:9");
    const fresh = mobileFramesDoc("16:9", mobiles(6));
    expect(doc.shots[0].layout).toEqual(fresh.shots[0].layout);
    expect(doc.shots[0].duration).toBe(fresh.shots[0].duration);
    expect(doc.shots[0].duration).toBe(19.5);
  });

  it("gives Desktop Frames 3 rows at 4:5", () => {
    const layout = framesLayout("16:9", ["d1", "d2", "d3", "d4"]);
    expect(layout.rows).toBe(2);
    expect(refitFramesLayout(layout, "4:5")).toEqual(framesLayout("4:5", layout.assetIds));
    expect(refitFramesLayout(layout, "4:5")).toMatchObject({ rows: 3 });
    const columns = mobileFramesLayout("9:16", ["m1", "m2", "m3", "m4"]);
    expect(refitFramesLayout(columns, "16:9")).toMatchObject({ columns: 5, cardWidth: 0.269 });
  });

  it("leaves every other layout as it is", () => {
    for (const layout of tilted) {
      for (const aspect of ASPECTS) {
        expect(refitFramesLayout(layout, aspect)).toBe(layout);
      }
    }
    const doc = createDoc();
    doc.shots[0].layout = tilted[1];
    doc.shots[0].duration = 7;
    const before = structuredClone(doc.shots);
    changeAspect(doc, "9:16");
    expect(doc.shots).toEqual(before);
  });

  it("restores the aspect and the layouts with one undo", () => {
    const store = createEditorStore();
    const doc = mobileFramesDoc("9:16", mobiles(6));
    const desktopFrames = buildTemplate(framesTemplate, {
      aspect: "9:16",
      assets: desktops(4),
      name: "x",
    }).shots[0];
    store.getState().apply((draft) => {
      draft.aspect = "9:16";
      draft.assets = [...mobiles(6), ...desktops(4)];
      draft.shots = [doc.shots[0], desktopFrames];
    });
    const before = store.getState().doc;
    const past = store.getState().past.length;

    store.getState().apply((draft) => changeAspect(draft, "16:9"));
    const after = store.getState().doc;
    expect(store.getState().past.length).toBe(past + 1);
    expect(after.aspect).toBe("16:9");
    expect(after.shots[0].layout).toMatchObject({ columns: 5, cardWidth: 0.269 });
    expect(after.shots[0].duration).toBe(19.5);
    expect(after.shots[1].layout).toMatchObject({ rows: 2, cardHeight: 0.42 });

    store.getState().undo();
    expect(store.getState().doc).toBe(before);
    expect(store.getState().doc.shots[0].layout).toMatchObject({ columns: 2, cardWidth: 0.222 });
    expect(store.getState().doc.shots[1].layout).toMatchObject({ rows: 3, cardHeight: 0.32 });
  });
});
