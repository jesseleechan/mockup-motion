import { describe, expect, it } from "vitest";
import type { Aspect, Layout } from "../src/doc/types";
import { createDoc, defaultShot } from "../src/doc/defaults";
import { sanitizeDoc } from "../src/doc/validate";
import { aspectRatioValue } from "../src/motion/camera";
import { type LayoutNode, deckDepth, resolveLayout, sliderDuration } from "../src/motion/layouts";

// Stack plan S01: the deck arrangement of the slider layout (quality bar §2.2, §4).

type SliderLayout = Extract<Layout, { kind: "slider" }>;

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
const STEP = 2;
// Desktop Stack is a desktop deck on y, Mobile Stack a mobile deck on x.
const DECKS = [
  { axis: "y", shape: "desktop" },
  { axis: "x", shape: "mobile" },
] as const;

const image = (id: string, width: number, height: number) => ({
  id,
  kind: "image" as const,
  name: id,
  mime: "image/png",
  bytes: 100,
  width,
  height,
});
const assets = [1, 2, 3, 4, 5, 6].flatMap((i) => [
  image(`m${i}`, 390, 844),
  image(`d${i}`, 1440, 900),
]);

const deck = (axis: "x" | "y", shape: "mobile" | "desktop", n: number): SliderLayout => ({
  kind: "slider",
  assetIds: Array.from({ length: n }, (_, i) => `${shape === "mobile" ? "m" : "d"}${i + 1}`),
  axis,
  shape,
  step: STEP,
  arrangement: "deck",
});
const nodesAt = (layout: SliderLayout, aspect: Aspect, t: number) =>
  resolveLayout(layout, aspect, assets, t, sliderDuration(layout));

// Position along the direction the front card leaves: left on x, up on y, as negative values.
const along = (axis: "x" | "y", n: LayoutNode) => (axis === "x" ? n.transform.x : -n.transform.y);
const halfAlong = (axis: "x" | "y", n: LayoutNode) =>
  ((axis === "x" ? n.width : n.height) * n.transform.scale) / 2;
const inFrame = (aspect: Aspect, n: LayoutNode) => {
  const halfW = aspectRatioValue(aspect) / 2;
  const w = (n.width * n.transform.scale) / 2;
  const h = (n.height * n.transform.scale) / 2;
  return Math.abs(n.transform.x) - w < halfW && Math.abs(n.transform.y) - h < 0.5;
};
const visible = (aspect: Aspect, n: LayoutNode) => n.opacity > 0.01 && inFrame(aspect, n);
const times = (total: number, rate = 120) =>
  Array.from({ length: Math.round(total * rate) + 1 }, (_, i) => i / rate);
/** The bounding box of the given cards, in stage units. */
const box = (nodes: LayoutNode[]) => {
  const xs = nodes.flatMap((n) =>
    [-1, 1].map((s) => n.transform.x + (s * n.width * n.transform.scale) / 2),
  );
  const ys = nodes.flatMap((n) =>
    [-1, 1].map((s) => n.transform.y + (s * n.height * n.transform.scale) / 2),
  );
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    bottom: Math.min(...ys),
    top: Math.max(...ys),
  };
};

describe("Deck arrangement (stack plan S01)", () => {
  it("shows the front card and up to two behind it", () => {
    expect([1, 2, 3, 4, 5, 6, 18].map(deckDepth)).toEqual([1, 1, 2, 3, 3, 3, 3]);
  });

  it("loops natively: frame(0) equals frame(N × step)", () => {
    for (const { axis, shape } of DECKS) {
      for (const aspect of ASPECTS) {
        for (let n = 1; n <= 6; n++) {
          const layout = deck(axis, shape, n);
          expect(nodesAt(layout, aspect, n * STEP), `${axis} ${aspect} N=${n}`).toEqual(
            nodesAt(layout, aspect, 0),
          );
        }
      }
    }
  });

  it("rests with the front card at full size and each card behind 6% smaller, peeking out", () => {
    for (const { axis, shape } of DECKS) {
      for (const aspect of ASPECTS) {
        for (let n = 1; n <= 6; n++) {
          const layout = deck(axis, shape, n);
          const depth = deckDepth(n);
          for (let k = 0; k < n; k++) {
            for (const t of [k * STEP, (k + 1) * STEP - 0.01]) {
              const label = `${axis} ${aspect} N=${n} t=${t}`;
              const all = nodesAt(layout, aspect, t);
              const shown = all
                .filter((node) => visible(aspect, node))
                .sort((a, b) => b.depthOrder - a.depthOrder);
              expect(shown, label).toHaveLength(depth);
              // At the start of step k the front card is screenshot k; at the end of the hold
              // it has left and screenshot k + 1 is in front.
              const first = t === k * STEP ? k : k + 1;
              shown.forEach((node, r) => {
                expect(node.assetId, `${label} slot ${r}`).toBe(layout.assetIds[(first + r) % n]);
                expect(node.transform.scale, `${label} slot ${r}`).toBeCloseTo(1 - 0.06 * r, 6);
                expect(node.opacity, `${label} slot ${r}`).toBeCloseTo(1, 6);
                if (r > 0) {
                  // Each card behind shows past the far edge of the card in front.
                  const ahead = shown[r - 1];
                  const edge = (m: LayoutNode) => along(axis, m) + halfAlong(axis, m);
                  expect(edge(node) - edge(ahead), `${label} slot ${r}`).toBeGreaterThan(0.02);
                }
              });
              // The deck at rest is centred in the frame.
              const b = box(shown);
              expect((b.left + b.right) / 2, label).toBeCloseTo(0, 6);
              expect((b.top + b.bottom) / 2, label).toBeCloseTo(0, 6);
            }
          }
        }
      }
    }
  });

  it("peeks below on Desktop Stack and to the right on Mobile Stack", () => {
    for (const { axis, shape } of DECKS) {
      const shown = nodesAt(deck(axis, shape, 4), "4:5", 0).filter((n) => visible("4:5", n));
      const front = shown.find((n) => n.transform.scale === 1)!;
      for (const back of shown.filter((n) => n !== front)) {
        if (axis === "y") expect(back.transform.y).toBeLessThan(front.transform.y);
        else expect(back.transform.x).toBeGreaterThan(front.transform.x);
      }
    }
  });

  it("sizes the cards by the quality bar §4 formulas", () => {
    for (const aspect of ASPECTS) {
      const W = aspectRatioValue(aspect);
      for (let n = 2; n <= 6; n++) {
        const depth = deckDepth(n);
        const desktop = nodesAt(deck("y", "desktop", n), aspect, 0)[0];
        const height = Math.min((0.84 * W) / 1.6, 0.8 / (1 + (depth - 1) * 0.12));
        expect(desktop.height, `${aspect} N=${n}`).toBeCloseTo(height, 9);
        expect(desktop.width, `${aspect} N=${n}`).toBeCloseTo(1.6 * height, 9);

        const mobile = nodesAt(deck("x", "mobile", n), aspect, 0)[0];
        const width = Math.min(0.7 * 0.4615, (0.86 * W) / (1 + (depth - 1) * 0.2));
        expect(mobile.width, `${aspect} N=${n}`).toBeCloseTo(width, 9);
        expect(mobile.screenAspect).toBe(0.4615);
      }
    }
  });

  it("keeps 7% of the shortest frame side clear around the deck at rest", () => {
    for (const { axis, shape } of DECKS) {
      for (const aspect of ASPECTS) {
        const W = aspectRatioValue(aspect);
        const margin = 0.07 * Math.min(W, 1);
        for (let n = 1; n <= 6; n++) {
          const label = `${axis} ${aspect} N=${n}`;
          const b = box(nodesAt(deck(axis, shape, n), aspect, 0).filter((m) => visible(aspect, m)));
          expect(b.right, label).toBeLessThanOrEqual(W / 2 - margin + 1e-9);
          expect(b.left, label).toBeGreaterThanOrEqual(-W / 2 + margin - 1e-9);
          expect(b.top, label).toBeLessThanOrEqual(0.5 - margin + 1e-9);
          expect(b.bottom, label).toBeGreaterThanOrEqual(-0.5 + margin - 1e-9);
        }
      }
    }
  });

  it("sends the front card out of the frame, up on y and left on x, 0.03 past the edge", () => {
    for (const { axis, shape } of DECKS) {
      for (const aspect of ASPECTS) {
        const layout = deck(axis, shape, 4);
        const leaving = nodesAt(layout, aspect, 0).find((n) => n.transform.scale === 1)!;
        const gone = nodesAt(layout, aspect, STEP - 0.01).find((n) => n.id === leaving.id)!;
        const half = axis === "x" ? aspectRatioValue(aspect) / 2 : 0.5;
        const label = `${axis} ${aspect}`;
        expect(along(axis, gone) + halfAlong(axis, gone), label).toBeCloseTo(-half - 0.03, 9);
        // Out of the frame, it is no longer drawn.
        expect(gone.opacity, label).toBe(0);
        expect(nodesAt(layout, aspect, 1).find((n) => n.id === gone.id)!.opacity, label).toBe(1);
        expect(gone.transform.scale, label).toBe(1);
      }
    }
  });

  it("never reverses: every visible card moves only toward the exit and never shrinks", () => {
    const failures: string[] = [];
    for (const { axis, shape } of DECKS) {
      for (const aspect of ASPECTS) {
        for (let n = 2; n <= 6; n++) {
          const layout = deck(axis, shape, n);
          let previous = new Map(nodesAt(layout, aspect, 0).map((node) => [node.id, node]));
          for (const t of times(n * STEP).slice(1)) {
            const current = new Map(nodesAt(layout, aspect, t).map((node) => [node.id, node]));
            for (const [id, node] of current) {
              const before = previous.get(id)!;
              // A card goes back to the end of the deck only while it is out of view.
              if (!visible(aspect, node) || !visible(aspect, before)) continue;
              const moved = along(axis, node) - along(axis, before);
              const grew = node.transform.scale - before.transform.scale;
              if (moved > 1e-12 || grew < -1e-12) {
                failures.push(`${axis} ${aspect} N=${n} ${id} t=${t.toFixed(3)}`);
              }
            }
            previous = current;
          }
        }
      }
    }
    expect(failures.slice(0, 10), `${failures.length} reversals`).toEqual([]);
  });

  it("never shows a screenshot twice in view", () => {
    const failures: string[] = [];
    for (const { axis, shape } of DECKS) {
      for (const aspect of ASPECTS) {
        for (let n = 1; n <= 6; n++) {
          const layout = deck(axis, shape, n);
          for (const t of times(n * STEP)) {
            const seen = nodesAt(layout, aspect, t)
              .filter((node) => visible(aspect, node))
              .map((node) => node.assetId);
            if (new Set(seen).size !== seen.length) {
              failures.push(`${axis} ${aspect} N=${n} t=${t.toFixed(3)}: ${seen.join(",")}`);
            }
          }
        }
      }
    }
    expect(failures.slice(0, 10), `${failures.length} repeats`).toEqual([]);
  });

  it("fades in only the card entering the last slot, paired with its move and scale", () => {
    for (const { axis, shape } of DECKS) {
      for (let n = 2; n <= 6; n++) {
        const layout = deck(axis, shape, n);
        const depth = deckDepth(n);
        const label = `${axis} N=${n}`;
        const start = nodesAt(layout, "4:5", 0);
        const mid = nodesAt(layout, "4:5", 0.9);
        const fading = mid.filter((node) => node.opacity > 0.01 && node.opacity < 0.99);
        expect(fading, label).toHaveLength(1);
        // It is screenshot `depth`, coming forward from the hidden slot behind the deck.
        expect(fading[0].assetId, label).toBe(layout.assetIds[depth % n]);
        const before = start.find((node) => node.id === fading[0].id)!;
        expect(before.opacity, label).toBe(0);
        expect(fading[0].transform.scale, label).toBeGreaterThan(before.transform.scale);
        expect(along(axis, fading[0]), label).toBeLessThan(along(axis, before));
        // Front to back: the front card draws last.
        const order = [...mid].sort((a, b) => a.depthOrder - b.depthOrder);
        expect(order[order.length - 1].assetId, label).toBe(layout.assetIds[0]);
      }
    }
  });

  it("shows one still card for a single screenshot", () => {
    for (const { axis, shape } of DECKS) {
      const layout = deck(axis, shape, 1);
      for (const t of [0, 0.9, 1.9]) {
        const nodes = nodesAt(layout, "4:5", t);
        expect(nodes).toHaveLength(1);
        expect(nodes[0].transform).toMatchObject({ x: 0, y: 0, scale: 1 });
        expect(nodes[0].opacity).toBe(1);
      }
    }
  });

  it("leaves the carousel unchanged: no arrangement and carousel give the same nodes", () => {
    for (const { axis, shape } of DECKS) {
      for (const aspect of ASPECTS) {
        const { arrangement: _deck, ...carousel } = deck(axis, shape, 5);
        for (const t of [0, 0.9, 2.5, 7.3]) {
          const unset = nodesAt(carousel, aspect, t);
          expect(nodesAt({ ...carousel, arrangement: "carousel" }, aspect, t)).toEqual(unset);
          expect(unset[0].id).toMatch(/^slider:/);
        }
      }
    }
  });

  it("is deterministic", () => {
    const layout = deck("y", "desktop", 5);
    expect(nodesAt(layout, "16:9", 3.3)).toEqual(nodesAt(layout, "16:9", 3.3));
  });
});

describe("Deck arrangement validation (stack plan S01)", () => {
  const sanitizedLayout = (layout: Record<string, unknown>) => {
    const doc = createDoc({ assets: ["m1", "m2", "m3"].map((id) => image(id, 390, 844)) });
    (doc.shots[0] as { layout: unknown }).layout = layout;
    return sanitizeDoc(doc).doc.shots[0].layout;
  };
  const base = {
    kind: "slider",
    assetIds: ["m1", "m2", "m3"],
    axis: "x",
    shape: "mobile",
    step: 2,
  };

  it("keeps a valid arrangement and drops an invalid one", () => {
    const layout = { ...deck("x", "mobile", 3) };
    const doc = createDoc({
      assets: ["m1", "m2", "m3"].map((id) => image(id, 390, 844)),
      shots: [{ ...defaultShot(layout), duration: 6 }],
    });
    const { doc: sanitized, warnings } = sanitizeDoc(doc);
    expect(warnings).toEqual([]);
    expect(sanitized.shots[0].layout).toEqual(layout);
    expect(sanitizedLayout({ ...base, arrangement: "carousel" })).toEqual({
      ...base,
      arrangement: "carousel",
    });
    expect(sanitizedLayout({ ...base, arrangement: "fan" })).toEqual(base);
    expect(sanitizedLayout(base)).toEqual(base);
  });
});
