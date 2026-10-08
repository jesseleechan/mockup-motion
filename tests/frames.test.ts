import { describe, expect, it } from "vitest";
import type { Aspect, AssetRef, ProjectDoc } from "../src/doc/types";
import { createDoc } from "../src/doc/defaults";
import { sanitizeDoc } from "../src/doc/validate";
import { aspectRatioValue } from "../src/motion/camera";
import { evaluate } from "../src/motion/evaluate";
import { MARQUEE_MAX_FRAME_WIDTHS_PER_SECOND } from "../src/motion/layouts/marquee";
import {
  framesAssetIds,
  framesDuration,
  type LayoutNode,
  resolveLayout,
} from "../src/motion/layouts";
import { schedule } from "../src/motion/timeline";
import { createEditorStore } from "../src/state/store";
import {
  buildTemplate,
  framesLayout,
  framesTemplate,
  validateTemplateRequirements,
} from "../src/templates";

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
const COUNTS = [4, 5, 6];
// Decision D2 (quality-bar §2.5), written out so a change to the code's constant fails here.
const FRAMES_LIMIT = 0.2;

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

function framesDoc(aspect: Aspect, count: number): ProjectDoc {
  const assets = desktops(count);
  const built = buildTemplate(framesTemplate, { aspect, assets, name: "Frames" });
  return { ...createDoc(), aspect, assets, ...built, templateId: framesTemplate.id };
}

const nodesAt = (doc: ProjectDoc, t: number) => {
  const shot = doc.shots[0];
  return resolveLayout(shot.layout, doc.aspect, doc.assets, t, shot.duration, shot.entrance);
};
// Rounds to 4 decimals without a "-0.0000" for values just below zero.
const round4 = (v: number) => (Math.round(v * 1e4) / 1e4 + 0).toFixed(4);
const rowOf = (node: LayoutNode) => Number(node.id.match(/^row(\d+):/)![1]);
const inRowWindow = (aspect: Aspect, node: LayoutNode) =>
  Math.abs(node.transform.x) - node.width / 2 < aspectRatioValue(aspect) / 2;
const samples = (total: number, rate = 30) =>
  Array.from({ length: Math.round(total * rate) + 1 }, (_, i) => i / rate);

describe("Frames: rows with travel period (presets P04)", () => {
  it("loops natively: the cards at t = 0 and t = duration are identical", () => {
    const signature = (nodes: LayoutNode[]) =>
      nodes
        .map((n) =>
          [n.assetId, ...Object.values(n.transform).map((v) => (v + 0).toFixed(6))].join("|"),
        )
        .sort();
    for (const aspect of ASPECTS) {
      for (const count of COUNTS) {
        const doc = framesDoc(aspect, count);
        const duration = doc.shots[0].duration;
        expect(signature(nodesAt(doc, duration)), `${aspect} N=${count}`).toEqual(
          signature(nodesAt(doc, 0)),
        );
      }
    }
  });

  it("moves even rows left and odd rows right, linearly, without reversing", () => {
    const failures: string[] = [];
    for (const aspect of ASPECTS) {
      for (const count of COUNTS) {
        const doc = framesDoc(aspect, count);
        const duration = doc.shots[0].duration;
        const dt = 1 / 30;
        const speeds = new Set<string>();
        let previous = new Map(nodesAt(doc, 0).map((node) => [node.id, node]));
        for (const t of samples(duration).slice(1)) {
          for (const node of nodesAt(doc, t)) {
            const before = previous.get(node.id)!;
            const dx = node.transform.x - before.transform.x;
            const wrapped = !inRowWindow(aspect, node) && !inRowWindow(aspect, before);
            if (wrapped && Math.abs(dx) > 0.5) continue; // a card jumps ends far outside the frame
            const expected = rowOf(node) % 2 === 0 ? -1 : 1;
            if (Math.sign(dx) !== expected) {
              failures.push(`${aspect} N=${count} ${node.id} t=${t.toFixed(3)} dx=${dx}`);
            }
            speeds.add((Math.abs(dx) / dt).toFixed(6));
          }
          previous = new Map(nodesAt(doc, t).map((node) => [node.id, node]));
        }
        // Linear and the same for every row (decision D3): one speed throughout.
        expect([...speeds], `${aspect} N=${count} speeds`).toHaveLength(1);
      }
    }
    expect(failures.slice(0, 10), `${failures.length} wrong-way moves`).toEqual([]);
  });

  it("never shows a screenshot twice within a row's window", () => {
    const failures: string[] = [];
    for (const aspect of ASPECTS) {
      for (const count of COUNTS) {
        const doc = framesDoc(aspect, count);
        for (const t of samples(doc.shots[0].duration)) {
          const rows = new Map<number, string[]>();
          for (const node of nodesAt(doc, t)) {
            if (!inRowWindow(aspect, node)) continue;
            rows.set(rowOf(node), [...(rows.get(rowOf(node)) ?? []), node.assetId ?? ""]);
          }
          for (const [row, ids] of rows) {
            if (new Set(ids).size !== ids.length) {
              failures.push(`${aspect} N=${count} row ${row} t=${t.toFixed(2)}: ${ids.join(",")}`);
            }
          }
        }
      }
    }
    expect(failures.slice(0, 10), `${failures.length} repeats`).toEqual([]);
  });

  it("never lines up a screenshot in two rows that move together", () => {
    // Rows of the same direction keep their distance for the whole loop, so the same
    // screenshot overlapping in both would sit in one column window throughout.
    const failures: string[] = [];
    for (const aspect of ASPECTS) {
      for (const count of COUNTS) {
        const doc = framesDoc(aspect, count);
        for (const t of samples(doc.shots[0].duration, 4)) {
          const visible = nodesAt(doc, t).filter((node) => inRowWindow(aspect, node));
          for (const a of visible) {
            for (const b of visible) {
              const together = rowOf(a) !== rowOf(b) && rowOf(a) % 2 === rowOf(b) % 2;
              const overlap = Math.abs(a.transform.x - b.transform.x) < a.width;
              if (together && overlap && a.assetId === b.assetId && rowOf(a) < rowOf(b)) {
                failures.push(`${aspect} N=${count} t=${t} ${a.id} ${b.id} ${a.assetId}`);
              }
            }
          }
        }
      }
    }
    expect(failures.slice(0, 10), `${failures.length} aligned repeats`).toEqual([]);
  });

  it("stays at or under 0.20 frame heights per second (decision D2)", () => {
    for (const aspect of ASPECTS) {
      for (const count of COUNTS) {
        const template = framesDoc(aspect, count);
        // The template's own duration, and the shortest one framesDuration allows.
        const shortest = structuredClone(template);
        shortest.shots[0].duration = framesDuration(
          shortest.shots[0].layout as Parameters<typeof framesDuration>[0],
          aspect,
        );
        for (const doc of [template, shortest]) {
          const a = nodesAt(doc, 1);
          const b = nodesAt(doc, 2);
          const speed = Math.max(
            ...a
              .map((node, i) => Math.abs(b[i].transform.x - node.transform.x))
              .filter((v) => v < 0.5),
          );
          const label = `${aspect} N=${count} duration ${doc.shots[0].duration}`;
          expect(speed, label).toBeLessThanOrEqual(FRAMES_LIMIT + 1e-9);
          expect(speed, label).toBeGreaterThan(0);
        }
      }
    }
  });

  it("framesDuration is the shortest half second under the limit", () => {
    for (const aspect of ASPECTS) {
      for (const count of [1, 4, 6, 8]) {
        const layout = framesLayout(
          aspect,
          desktops(count).map((a) => a.id),
        );
        const duration = framesDuration(layout, aspect);
        expect(duration * 2, `${aspect} N=${count}`).toBe(Math.round(duration * 2));
        const period =
          (resolveLayout(layout, aspect, [], 0, 1)[1].transform.x -
            resolveLayout(layout, aspect, [], 0, 1)[0].transform.x) *
          count;
        expect(period / duration).toBeLessThanOrEqual(FRAMES_LIMIT);
        expect(period / (duration - 0.5)).toBeGreaterThan(FRAMES_LIMIT);
      }
    }
  });

  it("matches the reference composition at 4:5 within 3%", () => {
    // docs/presets-plan/reference.md, "Frames 1-01", in stage units.
    const doc = framesDoc("4:5", 5);
    const nodes = nodesAt(doc, 0);
    const card = nodes[0];
    const close = (actual: number, expected: number, what: string) =>
      expect(Math.abs(actual / expected - 1), what).toBeLessThan(0.03);
    close(card.width, 0.52, "card width");
    close(card.height, 0.315, "card height");
    const row0 = nodes.filter((n) => rowOf(n) === 0).map((n) => n.transform.x);
    const xs = [...row0].sort((a, b) => a - b);
    const pitch = Math.min(...xs.slice(1).map((x, i) => x - xs[i]));
    close(pitch, 0.585, "pitch along a row");
    close(pitch - card.width, 0.065, "gap between cards");
    const rowYs = [...new Set(nodes.map((n) => n.transform.y.toFixed(6)))].map(Number).sort();
    expect(rowYs, "three rows").toHaveLength(3);
    expect(rowYs[1], "middle row centred").toBeCloseTo(0, 9);
    close(rowYs[2] - rowYs[1], 0.315 + 0.065, "row pitch");
    close(rowYs[2] - rowYs[1] - card.height, 0.065, "gap between rows");
  });

  it("uses 3 rows on tall and square frames and 2 rows on wide ones", () => {
    for (const aspect of ASPECTS) {
      const rows = new Set(nodesAt(framesDoc(aspect, 4), 0).map(rowOf));
      const wide = aspect === "16:9" || aspect === "4:3";
      expect(rows.size, aspect).toBe(wide ? 2 : 3);
    }
  });

  it("keeps older rows layouts as they were when the new fields are unset", () => {
    const old = {
      kind: "rows" as const,
      assetIds: ["d1", "d2", "d3"],
      rows: 2 as const,
      device: "browser" as const,
      tilt: 8,
      speed: 0.35,
    };
    const assets = desktops(3);
    for (const aspect of ASPECTS) {
      for (const t of [0, 2.5, 7.9]) {
        expect(resolveLayout({ ...old, travel: "steps" }, aspect, assets, t, 8)).toEqual(
          resolveLayout(old, aspect, assets, t, 8),
        );
        // Unset gap: 0.14 frame widths between cards, as before the Frames fields (measured
        // without tilt, which rotates the rows).
        const flat = { ...old, tilt: 0 };
        const nodes = resolveLayout(flat, aspect, assets, 0, 8).filter((n) => rowOf(n) === 0);
        const xs = nodes.map((n) => n.transform.x);
        const steps = xs.slice(1).map((x, i) => Math.abs(x - xs[i]));
        const W = aspectRatioValue(aspect);
        expect(Math.min(...steps.filter((s) => s > 1e-9)), aspect).toBeCloseTo(
          nodes[0].width + 0.14 * W,
          3,
        );
        expect(MARQUEE_MAX_FRAME_WIDTHS_PER_SECOND).toBe(0.12);
      }
    }
  });
});

describe("Rows fields in sanitizeDoc (presets P04)", () => {
  const sanitizedLayout = (layout: Record<string, unknown>) => {
    const doc = createDoc({ assets: desktops(4) });
    (doc.shots[0] as { layout: unknown }).layout = layout;
    return sanitizeDoc(doc).doc.shots[0].layout;
  };
  const base = {
    kind: "rows",
    assetIds: ["d1", "d2"],
    rows: 3,
    device: "card",
    tilt: 0,
    speed: 0.35,
  };

  it("keeps valid Frames fields and leaves absent ones unset", () => {
    const frames = { ...base, cardHeight: 0.32, gap: 0.065, travel: "period" };
    expect(sanitizedLayout(frames)).toEqual(frames);
    expect(sanitizedLayout(base)).toEqual(base);
    expect(Object.keys(sanitizedLayout(base))).not.toContain("travel");
  });

  it("repairs invalid Frames fields", () => {
    expect(sanitizedLayout({ ...base, cardHeight: 5, gap: -1, travel: "warp" })).toEqual({
      ...base,
      cardHeight: 0.8,
      gap: 0,
    });
    expect(sanitizedLayout({ ...base, cardHeight: Number.NaN, gap: "0.1" })).toEqual(base);
  });
});

describe("Frames template (presets P04)", () => {
  it("builds at all five aspects with a native loop and a cut wrap", () => {
    for (const aspect of ASPECTS) {
      for (const count of COUNTS) {
        const doc = framesDoc(aspect, count);
        const label = `${aspect} N=${count}`;
        expect(sanitizeDoc(doc).warnings, label).toEqual([]);
        const shot = doc.shots[0];
        expect(doc.loop, label).toBe(true);
        expect(shot.transitionIn.kind, label).toBe("cut");
        expect(schedule(doc).total, label).toBe(shot.duration);
        expect(shot.duration, label).toBeGreaterThanOrEqual(15);
        expect(shot.layout, label).toMatchObject({ device: "card", tilt: 0, travel: "period" });
        expect(doc.style.background).toEqual({ kind: "solid", color: "#DFE1E3" });
        expect(doc.style).toMatchObject({ shadow: "none", grain: 0, vignette: 0 });
        expect(shot.camera).toMatchObject({ preset: "static", intensity: 0, float: 0 });

        // evaluate wraps t = total to 0, so compare the frame just before the loop point:
        // it already shows the cards of the first frame (cut wrap, no crossfade).
        const first = evaluate(doc, 0).layers;
        const last = evaluate(doc, schedule(doc).total - 1e-6).layers;
        expect(first, label).toHaveLength(1);
        expect(last, label).toHaveLength(1);
        expect(evaluate(doc, schedule(doc).total)).toEqual(evaluate(doc, 0));
        // Cards within a card of the frame; far out, a ring card may sit on either end.
        const cards = (nodes: LayoutNode[]) =>
          nodes
            .filter((n) => Math.abs(n.transform.x) < aspectRatioValue(aspect) / 2 + n.width)
            .map((n) => `${n.assetId}|${round4(n.transform.x)}|${round4(n.transform.y)}`)
            .sort();
        expect(cards(last[0].frame.nodes), label).toEqual(cards(first[0].frame.nodes));
      }
    }
  });

  it("dedupes slot assets and needs four desktop screenshots", () => {
    const three = desktops(3);
    expect(validateTemplateRequirements(framesTemplate, three)).toEqual({
      valid: false,
      reason: "Needs 4+ desktop screenshots",
    });
    expect(validateTemplateRequirements(framesTemplate, desktops(4)).valid).toBe(true);
    const built = buildTemplate(framesTemplate, { aspect: "4:5", assets: desktops(4), name: "x" });
    const ids = (built.shots[0].layout as { assetIds: string[] }).assetIds;
    expect(ids).toEqual(["d1", "d2", "d3", "d4"]);
  });
});

describe("Frames in the editor store (presets P04)", () => {
  function frameStore(count: number) {
    const store = createEditorStore();
    const doc = framesDoc("4:5", count);
    store
      .getState()
      .applyTemplateResult(
        { style: doc.style, shots: doc.shots, loop: doc.loop },
        framesTemplate.id,
      );
    store.getState().apply((draft) => {
      draft.aspect = "4:5";
      draft.assets = desktops(6);
    });
    return store;
  }

  it("keeps the shot duration at or above framesDuration", () => {
    const store = frameStore(6);
    const layout = store.getState().doc.shots[0].layout as Parameters<typeof framesDuration>[0];
    const shortest = framesDuration(layout, "4:5");
    store.getState().setShotDuration(0, 3);
    expect(store.getState().doc.shots[0].duration).toBe(shortest);
    store.getState().setShotDuration(0, 25);
    expect(store.getState().doc.shots[0].duration).toBe(25);
  });

  it("lengthens the shot when another screenshot lengthens the period", () => {
    const store = frameStore(5);
    store.getState().setShotDuration(0, 1);
    const before = store.getState().doc.shots[0].duration;
    store.getState().assignAssetToSlot(0, "add", "d6");
    const after = store.getState().doc.shots[0];
    const layout = after.layout as Parameters<typeof framesDuration>[0];
    expect(layout.assetIds).toHaveLength(6);
    expect(after.duration).toBe(framesDuration(layout, "4:5"));
    expect(after.duration).toBeGreaterThan(before);
  });
});

describe("Frames fits a 30 s shot (presets P05 follow-up)", () => {
  // Quality bar §2.2: 10 screenshots with the 3-row cards, 8 with the 2-row cards.
  const FIT: Record<Aspect, number> = { "16:9": 8, "4:3": 8, "9:16": 10, "1:1": 10, "4:5": 10 };
  const ids = (count: number) => desktops(count).map((a) => a.id);
  const pitch = (aspect: Aspect) => {
    const layout = framesLayout(aspect, ids(2));
    const nodes = resolveLayout(layout, aspect, [], 0, 1);
    return nodes[1].transform.x - nodes[0].transform.x;
  };

  it("shows the first screenshots whose loop fits 30 s at 0.20 frame heights per second", () => {
    for (const aspect of ASPECTS) {
      const layout = framesLayout(aspect, ids(20));
      expect(framesAssetIds(layout, aspect), aspect).toEqual(ids(FIT[aspect]));
      expect(framesDuration(layout, aspect), aspect).toBeLessThanOrEqual(30);
      // One more screenshot would need more than 30 s under the limit.
      expect(((FIT[aspect] + 1) * pitch(aspect)) / FRAMES_LIMIT, aspect).toBeGreaterThan(30);
      // Up to the fit, every screenshot shows.
      const fitting = framesLayout(aspect, ids(FIT[aspect]));
      expect(framesAssetIds(fitting, aspect), aspect).toEqual(ids(FIT[aspect]));
    }
  });

  it("draws only the shown screenshots and still loops natively under the limit", () => {
    for (const aspect of ASPECTS) {
      const layout = framesLayout(aspect, ids(14));
      const duration = framesDuration(layout, aspect);
      const shown = new Set(ids(FIT[aspect]));
      const at = (t: number) => resolveLayout(layout, aspect, desktops(14), t, duration);
      expect(
        at(0).filter((node) => !shown.has(node.assetId ?? "")),
        aspect,
      ).toEqual([]);
      const key = (n: LayoutNode) =>
        `${n.assetId}|${round4(n.transform.x)}|${round4(n.transform.y)}`;
      expect(at(duration).map(key).sort(), aspect).toEqual(at(0).map(key).sort());
      const speed = Math.max(
        ...at(1)
          .map((node, i) => Math.abs(at(2)[i].transform.x - node.transform.x))
          .filter((v) => v < 0.5),
      );
      expect(speed, aspect).toBeLessThanOrEqual(FRAMES_LIMIT + 1e-9);
    }
  });

  it("keeps a Frames shot at 30 s or less in the store when an 11th screenshot is added", () => {
    const store = createEditorStore();
    const doc = framesDoc("4:5", 6);
    store
      .getState()
      .applyTemplateResult(
        { style: doc.style, shots: doc.shots, loop: doc.loop },
        framesTemplate.id,
      );
    store.getState().apply((draft) => {
      draft.aspect = "4:5";
      draft.assets = desktops(11);
    });
    for (const id of ["d7", "d8", "d9", "d10", "d11"]) {
      store.getState().assignAssetToSlot(0, "add", id);
    }
    const shot = store.getState().doc.shots[0];
    const layout = shot.layout as Parameters<typeof framesDuration>[0];
    expect(layout.assetIds).toHaveLength(11);
    expect(shot.duration).toBe(framesDuration(layout, "4:5"));
    expect(shot.duration).toBeLessThanOrEqual(30);
  });
});
