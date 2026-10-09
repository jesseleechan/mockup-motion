import { describe, expect, it } from "vitest";
import type { Aspect, AssetRef, Layout } from "../src/doc/types";
import { createDoc } from "../src/doc/defaults";
import { sanitizeDoc } from "../src/doc/validate";
import {
  framesAssetIds,
  framesDuration,
  type LayoutNode,
  minShotDuration,
  resolveLayout,
} from "../src/motion/layouts";

// PF02: the Frames period mode on columns (Mobile Frames, motion only). The counts and widths
// are quality-bar §4 (Mobile Frames), written out so a change there has to change them here.
type ColumnsLayout = Extract<Layout, { kind: "columns" }>;

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
const MOBILE_FRAMES: Record<Aspect, { columns: 2 | 3 | 4 | 5; cardWidth: number }> = {
  "16:9": { columns: 5, cardWidth: 0.269 },
  "4:3": { columns: 4, cardWidth: 0.253 },
  "1:1": { columns: 3, cardWidth: 0.258 },
  "4:5": { columns: 3, cardWidth: 0.246 },
  "9:16": { columns: 2, cardWidth: 0.222 },
};
const GAP = 0.065;
// Decision D6 (quality-bar §2.5), written out so a change to the code's constant fails here.
const FRAMES_LIMIT = 0.2;
const PHONE_SCREEN_ASPECT = 0.4615;
// The template's 15 s floor (docs/phone-frames-plan/README.md §3, D8).
const MIN_LOOP = 15;
const COUNTS = [4, 5, 6, 7, 8, 9, 10];

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
const ids = (count: number) => mobiles(count).map((a) => a.id);

function mobileFramesLayout(aspect: Aspect, assetIds: string[]): ColumnsLayout {
  return {
    kind: "columns",
    assetIds,
    ...MOBILE_FRAMES[aspect],
    device: "card",
    gap: GAP,
    tilt: 0,
    speed: 0.35,
    travel: "period",
  };
}

interface Case {
  aspect: Aspect;
  count: number;
  layout: ColumnsLayout;
  assets: AssetRef[];
  duration: number;
}

function cases(counts = COUNTS): Case[] {
  return ASPECTS.flatMap((aspect) =>
    counts.map((count) => {
      const assets = mobiles(count);
      const layout = mobileFramesLayout(
        aspect,
        assets.map((a) => a.id),
      );
      const duration = Math.max(MIN_LOOP, framesDuration(layout, aspect));
      return { aspect, count, layout, assets, duration };
    }),
  );
}

const label = (c: Case) => `${c.aspect} N=${c.count}`;
const nodesAt = (c: Case, t: number, duration = c.duration) =>
  resolveLayout(c.layout, c.aspect, c.assets, t, duration);
const colOf = (node: LayoutNode) => Number(node.id.match(/^col(\d+):/)![1]);
// A column's window is the frame height plus one card: a card is in view while any of it is.
const inColumnWindow = (node: LayoutNode) => Math.abs(node.transform.y) - node.height / 2 < 0.5;
const samples = (total: number, rate = 30) =>
  Array.from({ length: Math.round(total * rate) + 1 }, (_, i) => i / rate);

describe("Columns with travel period (Mobile Frames, PF02)", () => {
  it("loops natively: the cards at t = 0 and t = duration are identical", () => {
    // Every card that can be in view, with a card of margin. A card exactly on the ring's wrap
    // point, half a ring (several frame heights) away, may land on either end after rounding.
    const nearView = (n: LayoutNode) => Math.abs(n.transform.y) - n.height < 0.5 + GAP;
    const signature = (nodes: LayoutNode[]) =>
      nodes
        .filter(nearView)
        .map((n) =>
          [n.assetId, ...Object.values(n.transform).map((v) => (v + 0).toFixed(6))].join("|"),
        )
        .sort();
    for (const c of cases()) {
      expect(signature(nodesAt(c, c.duration)), label(c)).toEqual(signature(nodesAt(c, 0)));
    }
  });

  it("moves even columns up and odd columns down, linearly, without reversing", () => {
    const failures: string[] = [];
    const dt = 1 / 30;
    for (const c of cases()) {
      const speeds = new Set<string>();
      let previous = new Map(nodesAt(c, 0).map((node) => [node.id, node]));
      for (const t of samples(c.duration).slice(1)) {
        const nodes = nodesAt(c, t);
        for (const node of nodes) {
          const before = previous.get(node.id)!;
          const dy = node.transform.y - before.transform.y;
          const wrapped = !inColumnWindow(node) && !inColumnWindow(before);
          if (wrapped && Math.abs(dy) > 0.5) continue; // a card jumps ends far outside the frame
          const expected = colOf(node) % 2 === 0 ? 1 : -1;
          if (Math.sign(dy) !== expected) {
            failures.push(`${label(c)} ${node.id} t=${t.toFixed(3)} dy=${dy}`);
          }
          if (node.transform.x !== before.transform.x) {
            failures.push(`${label(c)} ${node.id} t=${t.toFixed(3)} moved sideways`);
          }
          speeds.add((Math.abs(dy) / dt).toFixed(6));
        }
        previous = new Map(nodes.map((node) => [node.id, node]));
      }
      // Linear and the same for every column (D6): one speed throughout.
      expect([...speeds], `${label(c)} speeds`).toHaveLength(1);
    }
    expect(failures.slice(0, 10), `${failures.length} wrong-way moves`).toEqual([]);
  });

  it("places column c at (c - (columns - 1) / 2) × (cardWidth + gap), c / columns of a period along", () => {
    for (const c of cases([4, 7])) {
      const { columns, cardWidth } = MOBILE_FRAMES[c.aspect];
      const nodes = nodesAt(c, 0);
      const height = cardWidth / PHONE_SCREEN_ASPECT;
      const shown = framesAssetIds(c.layout, c.aspect).length;
      const period = shown * (height + GAP);
      const perColumn = nodes.length / columns;
      const ringSpan = perColumn * (height + GAP);
      for (let col = 0; col < columns; col++) {
        const column = nodes.filter((n) => colOf(n) === col);
        expect(column, `${label(c)} col ${col}`).toHaveLength(perColumn);
        const x = (col - (columns - 1) / 2) * (cardWidth + GAP);
        for (const node of column) expect(node.transform.x).toBeCloseTo(x, 12);
        // Item j of column c sits c / columns of a period ahead of item j of column 0.
        column.forEach((node, j) => {
          const first = nodes.find((n) => n.id === `col0:item${j}`)!;
          const ahead = (node.transform.y - first.transform.y + ringSpan) % ringSpan;
          expect(ahead, `${label(c)} ${node.id}`).toBeCloseTo((col * period) / columns, 9);
        });
      }
    }
  });

  it("never shows a screenshot twice within a column's window", () => {
    const failures: string[] = [];
    for (const c of cases()) {
      for (const t of samples(c.duration, 10)) {
        const columns = new Map<number, string[]>();
        for (const node of nodesAt(c, t)) {
          if (!inColumnWindow(node)) continue;
          columns.set(colOf(node), [...(columns.get(colOf(node)) ?? []), node.assetId ?? ""]);
        }
        for (const [col, seen] of columns) {
          if (new Set(seen).size !== seen.length) {
            failures.push(`${label(c)} col ${col} t=${t.toFixed(2)}: ${seen.join(",")}`);
          }
        }
      }
    }
    expect(failures.slice(0, 10), `${failures.length} repeats`).toEqual([]);
  });

  it("stays at or under 0.20 stage units per second, also at the shortest duration", () => {
    for (const c of cases()) {
      for (const duration of [c.duration, framesDuration(c.layout, c.aspect)]) {
        const a = nodesAt(c, 1, duration);
        const b = nodesAt(c, 2, duration);
        const speeds = a
          .map((node, i) => Math.abs(b[i].transform.y - node.transform.y))
          .filter((v) => v < 0.5);
        const text = `${label(c)} duration ${duration}`;
        expect(Math.max(...speeds), text).toBeLessThanOrEqual(FRAMES_LIMIT + 1e-9);
        expect(Math.min(...speeds), text).toBeGreaterThan(0);
      }
    }
  });

  it("framesDuration gives the plan's durations (README §3) once the 15 s floor applies", () => {
    // docs/phone-frames-plan/README.md §3, "Duration for N = 4 / 5 / 6".
    const table: Record<Aspect, number[]> = {
      "16:9": [15, 16.5, 19.5],
      "4:3": [15, 15.5, 18.5],
      "1:1": [15, 16, 19],
      "4:5": [15, 15, 18],
      "9:16": [15, 15, 16.5],
    };
    for (const aspect of ASPECTS) {
      const got = [4, 5, 6].map((n) =>
        Math.max(MIN_LOOP, framesDuration(mobileFramesLayout(aspect, ids(n)), aspect)),
      );
      expect(got, aspect).toEqual(table[aspect]);
    }
  });

  it("framesDuration is the shortest half second under the limit, and minShotDuration uses it", () => {
    for (const aspect of ASPECTS) {
      for (const count of [1, 4, 6, 9, 12]) {
        const layout = mobileFramesLayout(aspect, ids(count));
        const duration = framesDuration(layout, aspect);
        const shown = framesAssetIds(layout, aspect).length;
        const period = shown * (MOBILE_FRAMES[aspect].cardWidth / PHONE_SCREEN_ASPECT + GAP);
        const text = `${aspect} N=${count}`;
        expect(duration * 2, text).toBe(Math.round(duration * 2));
        expect(period / duration, text).toBeLessThanOrEqual(FRAMES_LIMIT);
        expect(period / (duration - 0.5), text).toBeGreaterThan(FRAMES_LIMIT);
        expect(duration, text).toBeLessThanOrEqual(30);
        expect(minShotDuration(layout, aspect), text).toBe(duration);
        // The tilted phone marquee (travel steps) sets no minimum.
        expect(minShotDuration({ ...layout, travel: "steps" }, aspect), text).toBe(1);
      }
    }
  });

  it("shows the first 9 screenshots at 16:9, 4:3 and 1:1 and 10 at 4:5 and 9:16", () => {
    const cap: Record<Aspect, number> = { "16:9": 9, "4:3": 9, "1:1": 9, "4:5": 10, "9:16": 10 };
    for (const aspect of ASPECTS) {
      const layout = mobileFramesLayout(aspect, ids(20));
      expect(framesAssetIds(layout, aspect), aspect).toEqual(ids(cap[aspect]));
      const shown = new Set(
        resolveLayout(layout, aspect, mobiles(20), 0, 30).map((n) => n.assetId),
      );
      expect(shown.size, aspect).toBe(cap[aspect]);
      // The tilted phone marquee keeps every screenshot.
      expect(framesAssetIds({ ...layout, travel: "steps" }, aspect), aspect).toEqual(ids(20));
    }
  });

  it("draws portrait cards at the phone screen aspect, even for a tall capture", () => {
    for (const aspect of ASPECTS) {
      // 1170 × 5000: screenAspectFor("card", tall) would say 1.6, a landscape strip.
      const assets = mobiles(5, 5000);
      const layout = mobileFramesLayout(
        aspect,
        assets.map((a) => a.id),
      );
      const { cardWidth } = MOBILE_FRAMES[aspect];
      for (const node of resolveLayout(layout, aspect, assets, 0.8, 16)) {
        expect(node.device, aspect).toBe("card");
        expect(node.screenAspect, aspect).toBe(PHONE_SCREEN_ASPECT);
        expect(node.width, aspect).toBe(cardWidth);
        expect(node.height, aspect).toBe(cardWidth / PHONE_SCREEN_ASPECT);
      }
    }
  });

  it("keeps node ids, devices and sizes fixed across the shot", () => {
    for (const c of cases([4, 10])) {
      const signature = (t: number) =>
        nodesAt(c, t).map((n) => `${n.id}|${n.device}|${n.width}|${n.height}|${n.screenAspect}`);
      for (const t of [0.8, c.duration / 2, c.duration]) {
        expect(signature(t), `${label(c)} t=${t}`).toEqual(signature(0));
      }
    }
  });
});

describe("Columns fields in sanitizeDoc (PF02)", () => {
  const sanitizedLayout = (layout: Record<string, unknown>) => {
    const doc = createDoc({ assets: mobiles(4) });
    (doc.shots[0] as { layout: unknown }).layout = layout;
    return sanitizeDoc(doc).doc.shots[0].layout;
  };
  // A saved Phone Parade shot: the tilted phone marquee with none of the new fields.
  const phoneParade = {
    kind: "columns",
    assetIds: ["m1", "m2", "m3"],
    columns: 3,
    tilt: 12,
    speed: 0.4,
  };

  it("round-trips a saved Phone Parade layout unchanged, with no new fields", () => {
    const layout = sanitizedLayout(phoneParade);
    expect(layout).toEqual(phoneParade);
    expect(Object.keys(layout).sort()).toEqual(Object.keys(phoneParade).sort());
  });

  it("keeps valid Frames fields", () => {
    const frames = { ...phoneParade, device: "card", cardWidth: 0.246, gap: 0.065, tilt: 0 };
    for (const travel of ["steps", "period"]) {
      expect(sanitizedLayout({ ...frames, travel })).toEqual({ ...frames, travel });
    }
  });

  it("drops or clamps invalid Frames fields", () => {
    // "phone" is the default, so it stays unset; other devices are not columns devices.
    for (const device of ["phone", "browser", "tablet", 1, null]) {
      expect(sanitizedLayout({ ...phoneParade, device }), String(device)).toEqual(phoneParade);
    }
    expect(sanitizedLayout({ ...phoneParade, cardWidth: 5, gap: -1, travel: "warp" })).toEqual({
      ...phoneParade,
      cardWidth: 0.8,
      gap: 0,
    });
    expect(sanitizedLayout({ ...phoneParade, cardWidth: 0.01, gap: 2 })).toEqual({
      ...phoneParade,
      cardWidth: 0.1,
      gap: 0.5,
    });
    expect(
      sanitizedLayout({ ...phoneParade, cardWidth: Number.NaN, gap: "0.1", travel: 1 }),
    ).toEqual(phoneParade);
    expect(sanitizedLayout({ ...phoneParade, cardWidth: Infinity })).toEqual(phoneParade);
  });
});
