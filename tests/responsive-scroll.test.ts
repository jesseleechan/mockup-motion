import { describe, expect, it } from "vitest";
import { createDoc, defaultShot } from "../src/doc/defaults";
import { sanitizeDoc } from "../src/doc/validate";
import type { Aspect, AssetRef, ProjectDoc, ScrollSpec } from "../src/doc/types";
import { aspectRatioValue } from "../src/motion/camera";
import { evaluate } from "../src/motion/evaluate";
import { fixedShotCamera, fixedShotDuration, responsiveGeometry } from "../src/motion/layouts";
import {
  defaultSectionKeys,
  resolveResponsiveStops,
  responsiveScreens,
  responsiveScrollAt,
  responsiveScrollDuration,
  type ScrollScreen,
} from "../src/motion/responsive-scroll";
import { demoAssetId, demoAssetRef } from "../src/lab/demo-assets";

const DESKTOP = demoAssetRef(demoAssetId("aurelia", "desktop", "full"));
const MOBILE = demoAssetRef(demoAssetId("aurelia", "mobile", "full"));
const LAYOUT = { kind: "responsive" as const, desktopId: DESKTOP.id, mobileId: MOBILE.id };
const SPEC: ScrollSpec = {
  enabled: true,
  stops: [0, 1 / 3, 2 / 3, 1],
  hold: 1,
  easing: "smooth",
};

function screens(assets: AssetRef[] = [DESKTOP, MOBILE]): ScrollScreen[] {
  const result = responsiveScreens(LAYOUT, assets);
  if (!result) throw new Error("both screenshots are needed");
  return result;
}

const screenHeight = (s: ScrollScreen) => s.width / s.aspect;
const scrollable = (s: ScrollScreen) => s.height - screenHeight(s);
const withoutSections = (a: AssetRef): AssetRef => ({ ...a, meta: { tall: true } });

/** Scroll position in image px of each screen at time t. */
function pxAt(spec: ScrollSpec, all: ScrollScreen[], t: number): number[] {
  return responsiveScrollAt(spec, all, t).map((f, i) => f * scrollable(all[i]));
}

/** Start and end of each hold. */
function holds(spec: ScrollSpec, all: ScrollScreen[]): [number, number][] {
  const { px } = resolveResponsiveStops(spec, all);
  const result: [number, number][] = [];
  let t = 0;
  for (let i = 0; i < px.length; i++) {
    result.push([t, t + spec.hold]);
    t += spec.hold;
    if (i < px.length - 1) {
      const travel = Math.max(...all.map((s, k) => (px[i + 1][k] - px[i][k]) / screenHeight(s)));
      t += travel / 0.9;
    }
  }
  return result;
}

function responsiveDoc(aspect: Aspect = "16:9"): ProjectDoc {
  const shot = defaultShot(LAYOUT);
  shot.scroll = { ...SPEC };
  shot.transitionIn = { kind: "fade", duration: 0.8, easing: "quintInOut" };
  const doc = createDoc({ aspect, loop: true, assets: [DESKTOP, MOBILE], shots: [shot] });
  return sanitizeDoc(doc).doc;
}

describe("Responsive Scroll layout (quality bar §4)", () => {
  // The plan's table (docs/responsive-scroll-plan §1): desktop w × h, mobile w × h.
  const TABLE: Record<Aspect, [number, number, number, number]> = {
    "16:9": [1.056, 0.66, 0.305, 0.66],
    "4:3": [0.851, 0.532, 0.246, 0.532],
    "1:1": [0.629, 0.393, 0.181, 0.393],
    "4:5": [0.688, 0.43, 0.18, 0.39],
    "9:16": [0.484, 0.302, 0.239, 0.518],
  };

  for (const aspect of Object.keys(TABLE) as Aspect[]) {
    it(`${aspect}: card sizes, centred pair inside the safe margin`, () => {
      const { desktop, mobile } = responsiveGeometry(aspect);
      const [dw, dh, mw, mh] = TABLE[aspect];
      expect(desktop.width).toBeCloseTo(dw, 3);
      expect(desktop.height).toBeCloseTo(dh, 3);
      expect(mobile.width).toBeCloseTo(mw, 3);
      expect(mobile.height).toBeCloseTo(mh, 3);
      expect(desktop.width / desktop.height).toBeCloseTo(1.6, 6);
      expect(mobile.width / mobile.height).toBeCloseTo(0.4615, 6);

      const left = Math.min(desktop.x - desktop.width / 2, mobile.x - mobile.width / 2);
      const right = Math.max(desktop.x + desktop.width / 2, mobile.x + mobile.width / 2);
      const top = Math.max(desktop.y + desktop.height / 2, mobile.y + mobile.height / 2);
      const bottom = Math.min(desktop.y - desktop.height / 2, mobile.y - mobile.height / 2);
      expect(left + right).toBeCloseTo(0, 9);
      expect(top + bottom).toBeCloseTo(0, 9);
      expect(right - left).toBeLessThanOrEqual(0.86 * aspectRatioValue(aspect) + 1e-9);
      expect(top - bottom).toBeLessThanOrEqual(0.86 + 1e-9);
      const stacked = aspect === "4:5" || aspect === "9:16";
      if (stacked) expect(desktop.y).toBeGreaterThan(mobile.y);
      else expect(desktop.x).toBeLessThan(mobile.x);
    });
  }

  it("emits two cards at the desktop and phone screen aspects", () => {
    const nodes = evaluate(responsiveDoc(), 0).layers[0].frame.nodes;
    expect(nodes.map((n) => [n.id, n.device, n.screenAspect, n.assetId])).toEqual([
      ["responsive:desktop", "card", 1.6, DESKTOP.id],
      ["responsive:mobile", "card", 0.4615, MOBILE.id],
    ]);
  });
});

describe("Responsive Scroll motion (contracts.md §5)", () => {
  it("defaults to the top and three spread-out shared sections: Aurelia's preview stops", () => {
    expect(defaultSectionKeys(screens())).toEqual(["works", "materials", "monograph"]);
    expect(resolveResponsiveStops(SPEC, screens()).sections).toEqual([
      "works",
      "materials",
      "monograph",
    ]);
  });

  it("loops in 9.4 s for Aurelia: four 1 s holds and moves at 0.9 screen heights per second", () => {
    // top → works 2.11 s, works → materials 1.88 s, materials → monograph 1.39 s (plan §1). The
    // shot runs 0.8 s longer: the wrap crossfade overlaps it, so the loop is 9.4 s.
    expect(responsiveScrollDuration(SPEC, screens())).toBeCloseTo(9.377 + 0.8, 2);
    expect(fixedShotDuration(LAYOUT, SPEC, [DESKTOP, MOBILE])).toBeCloseTo(9.377 + 0.8, 2);
  });

  it("holds both screens with the same section at the top of the screen at the same time", () => {
    const all = screens();
    const expected = [
      [0, 0],
      [1664, 3204],
      [2409, 6066],
      [3088, 8178],
    ];
    holds(SPEC, all).forEach(([start, end], i) => {
      for (const t of [start + 0.01, (start + end) / 2, end - 0.01]) {
        const px = pxAt(SPEC, all, t);
        expect(px[0]).toBeCloseTo(expected[i][0], 6);
        expect(px[1]).toBeCloseTo(expected[i][1], 6);
      }
    });
  });

  it("never beats 0.9 screen heights per second on average, and one screen sets each move", () => {
    // Measured from the motion itself: sample every millisecond and time each move.
    const all = screens();
    const duration = responsiveScrollDuration(SPEC, all);
    const moves: { start: number; end: number; from: number[]; to: number[] }[] = [];
    let prev = pxAt(SPEC, all, 0);
    for (let ms = 1; ms <= duration * 1000; ms++) {
      const t = ms / 1000;
      const px = pxAt(SPEC, all, t);
      const moving = px.some((p, i) => Math.abs(p - prev[i]) > 1e-9);
      const last = moves[moves.length - 1];
      if (moving && (!last || last.end < t - 0.0015)) {
        moves.push({ start: t - 0.001, end: t, from: prev, to: px });
      } else if (moving) {
        last.end = t;
        last.to = px;
      }
      prev = px;
    }
    expect(moves).toHaveLength(3);
    for (const move of moves) {
      const rates = all.map(
        (s, k) => (move.to[k] - move.from[k]) / screenHeight(s) / (move.end - move.start),
      );
      expect(Math.max(...rates)).toBeCloseTo(0.9, 2);
      for (const rate of rates) expect(rate).toBeLessThanOrEqual(0.9 + 0.002);
    }
  });

  it("never scrolls back within the shot", () => {
    const all = screens();
    const duration = responsiveScrollDuration(SPEC, all);
    let prev = pxAt(SPEC, all, 0);
    for (let t = 0.01; t <= duration; t += 0.01) {
      const px = pxAt(SPEC, all, t);
      px.forEach((p, i) => expect(p).toBeGreaterThanOrEqual(prev[i] - 1e-9));
      prev = px;
    }
  });

  it("falls back to the same fractions of each page without section data", () => {
    const all = screens([withoutSections(DESKTOP), withoutSections(MOBILE)]);
    const stops = resolveResponsiveStops(SPEC, all);
    expect(stops.sections).toBeNull();
    expect(stops.px).toHaveLength(4);
    stops.px.forEach((stop, i) => {
      all.forEach((s, k) => expect(stop[k]).toBeCloseTo((i / 3) * scrollable(s), 6));
    });
    // Section data on one screen only is no better than none: the stops wouldn't match.
    const one = screens([DESKTOP, withoutSections(MOBILE)]);
    expect(resolveResponsiveStops(SPEC, one).sections).toBeNull();
  });

  it("stops on the sections the spec names, ignoring keys a page doesn't have", () => {
    const named = resolveResponsiveStops({ ...SPEC, sections: ["materials", "nope"] }, screens());
    expect(named.sections).toEqual(["materials"]);
    expect(named.px).toEqual([
      [0, 0],
      [2409, 6066],
    ]);
    const none = resolveResponsiveStops({ ...SPEC, sections: ["nope"] }, screens());
    expect(none.sections).toBeNull();
    // Out of page order: going back to works would reverse the scroll (quality bar §2.5).
    const reversed = resolveResponsiveStops(
      { ...SPEC, sections: ["monograph", "works"] },
      screens(),
    );
    expect(reversed.sections).toEqual(["monograph"]);
    expect(reversed.px).toEqual([
      [0, 0],
      [3088, 8178],
    ]);
  });

  it("stops at the bottom of a page that can't scroll a section to its top", () => {
    const short: AssetRef = {
      ...DESKTOP,
      height: 3500,
      meta: { ...DESKTOP.meta, sections: DESKTOP.meta?.sections },
    };
    const all = screens([short, MOBILE]);
    const { px } = resolveResponsiveStops({ ...SPEC, sections: ["works", "monograph"] }, all);
    // 3500 − 900 = 2600 px of scroll: monograph (3088) can't reach the top, so the page ends.
    expect(px[2][0]).toBe(2600);
    expect(px[2][1]).toBe(8178);
  });

  it("fits in 30 s by leaving out the last stops", () => {
    const tall = (base: AssetRef, height: number): AssetRef => ({
      ...base,
      height,
      meta: {
        sections: Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, top: i * (height / 12) })),
      },
    });
    const all = screens([tall(DESKTOP, 40000), tall(MOBILE, 80000)]);
    const spec = { ...SPEC, sections: Array.from({ length: 11 }, (_, i) => `s${i + 1}`) };
    const duration = responsiveScrollDuration(spec, all);
    expect(duration).toBeLessThanOrEqual(30);
    expect(duration).toBeGreaterThan(25);
  });
});

describe("Responsive Scroll in a document", () => {
  it("evaluates both screens to the scroll motion, still at the top at t = 0", () => {
    const doc = responsiveDoc();
    const at = (t: number) => evaluate(doc, t).layers[0].frame.nodes.map((n) => n.scroll);
    expect(at(0)).toEqual([0, 0]);
    const all = screens();
    const t = holds(SPEC, all)[1][0] + 0.5;
    expect(at(t)).toEqual(responsiveScrollAt(SPEC, all, t));
    expect(at(t)[0]).toBeGreaterThan(0);
  });

  it("loops by the wrap crossfade, inside the last hold: frame(total) ≡ frame(0)", () => {
    const doc = responsiveDoc("4:5");
    const shotDuration = doc.shots[0].duration;
    const total = shotDuration - 0.8;
    const scrolls = (t: number) =>
      evaluate(doc, t).layers.map((l) => ({ w: l.weight, s: l.frame.nodes.map((n) => n.scroll) }));
    expect(scrolls(total)).toEqual(scrolls(0));
    // Through the crossfade the outgoing screens hold the last stop and the incoming the top.
    const lastHoldStart = shotDuration - 0.8 - SPEC.hold;
    expect(total - 0.8).toBeGreaterThan(lastHoldStart);
    const end = responsiveScrollAt(SPEC, screens(), shotDuration);
    for (const t of [total - 0.75, total - 0.4, total - 0.05]) {
      const layers = scrolls(t);
      expect(layers).toHaveLength(2);
      const outgoing = layers.find((l) => l.s[0] > 0);
      const incoming = layers.find((l) => l.s[0] === 0);
      expect(outgoing?.s).toEqual(end);
      expect(incoming?.s).toEqual([0, 0]);
    }
  });

  it("sets the shot length from the stops and keeps the camera still", () => {
    const doc = responsiveDoc();
    expect(doc.shots[0].duration).toBeCloseTo(9.377 + 0.8, 2);
    const moving = {
      preset: "pushIn" as const,
      intensity: 0.5,
      easing: "smooth" as const,
      float: 0.1,
    };
    expect(fixedShotCamera(LAYOUT, moving)).toMatchObject({
      preset: "static",
      intensity: 0,
      float: 0,
    });
    // Without scroll the user sets the length, as on any other layout.
    expect(fixedShotDuration(LAYOUT, { ...SPEC, enabled: false }, [DESKTOP, MOBILE])).toBeNull();
  });

  it("keeps the layout and section stops through validation", () => {
    const doc = responsiveDoc();
    const raw = structuredClone(doc) as unknown as { shots: { scroll: Record<string, unknown> }[] };
    raw.shots[0].scroll.sections = ["works", 3, "", "monograph"];
    const { doc: clean } = sanitizeDoc(raw);
    expect(clean.shots[0].layout).toEqual(LAYOUT);
    expect(clean.shots[0].scroll?.sections).toEqual(["works", "monograph"]);
    expect(clean.shots[0].duration).toBeCloseTo(
      responsiveScrollDuration({ ...SPEC, sections: ["works", "monograph"] }, screens()),
      9,
    );
  });
});
