import { describe, expect, it } from "vitest";
import { createDoc } from "../src/doc/defaults";
import type { Aspect, AssetRef, Layout, ProjectDoc } from "../src/doc/types";
import { sanitizeDoc } from "../src/doc/validate";
import { fadeBlendFor } from "../src/engine/devices/DeviceFade";
import {
  evaluate,
  fixedShotCamera,
  fixedShotDuration,
  type LayoutNode,
  ORBIT_MAX_SCREENSHOTS,
  orbitGeometry,
  resolveOrbitLayout,
  schedule,
  sliderDuration,
  sliderStep,
} from "../src/motion";
import { aspectRatioValue } from "../src/motion/camera";
import { createEditorStore } from "../src/state/store";
import { convertDocToUserTemplate, fillUserTemplateSlots } from "../src/storage/user-templates";
import {
  BUILTIN_TEMPLATES,
  buildTemplate,
  desktopOrbitTemplate,
  mobileOrbitTemplate,
  pairedTemplateId,
} from "../src/templates";
import { FLAT_TONES, templateTones } from "../src/templates/looks";

type OrbitLayout = Extract<Layout, { kind: "orbit" }>;
type Shape = OrbitLayout["shape"];

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
const SHAPES: Shape[] = ["mobile", "desktop"];

function screenshot(role: Shape, i: number): AssetRef {
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

function screenshots(role: Shape, n: number): AssetRef[] {
  return Array.from({ length: n }, (_, i) => screenshot(role, i));
}

function orbit(shape: Shape, n: number, step = 2): OrbitLayout {
  return { kind: "orbit", assetIds: screenshots(shape, n).map((a) => a.id), shape, step };
}

function nodesAt(layout: OrbitLayout, aspect: Aspect, t: number): LayoutNode[] {
  return resolveOrbitLayout(layout, aspect, screenshots(layout.shape, 8), t);
}

/** A one-shot orbit document, as the template builds it. */
function orbitDoc(shape: Shape, n: number, aspect: Aspect = "4:5"): ProjectDoc {
  const template = shape === "mobile" ? mobileOrbitTemplate : desktopOrbitTemplate;
  const assets = screenshots(shape, n);
  const built = buildTemplate(template, { aspect, assets, name: "Test" });
  return { ...createDoc(), aspect, assets, ...built };
}

const front = (nodes: LayoutNode[]) =>
  nodes.reduce((a, b) => (b.depthOrder > a.depthOrder ? b : a));

describe("Orbit geometry (quality bar §4)", () => {
  it("sizes the mobile ring from the frame height, capped by the frame width", () => {
    for (const aspect of ASPECTS) {
      const W = aspectRatioValue(aspect);
      const g = orbitGeometry("mobile", aspect);
      const h0 = Math.min(0.58, (0.42 * W) / 0.4615);
      expect(g.cardHeight, aspect).toBeCloseTo(h0, 10);
      expect(g.cardWidth, aspect).toBeCloseTo(h0 * 0.4615, 10);
      expect(g.radius, aspect).toBeCloseTo(
        Math.min(1.25 * g.cardWidth, W / 2 - 0.25 * g.cardWidth),
        10,
      );
      expect(g.lift, aspect).toBeCloseTo(0.42 * h0, 10);
    }
    // The width cap only binds at 9:16.
    expect(orbitGeometry("mobile", "4:5").cardHeight).toBeCloseTo(0.58, 10);
    expect(orbitGeometry("mobile", "9:16").cardHeight).toBeLessThan(0.58);
  });

  it("sizes the desktop ring from the frame width, capped at 0.42 tall", () => {
    for (const aspect of ASPECTS) {
      const W = aspectRatioValue(aspect);
      const g = orbitGeometry("desktop", aspect);
      const cw = Math.min(0.62 * W, 0.42 * 1.6);
      expect(g.cardWidth, aspect).toBeCloseTo(cw, 10);
      expect(g.cardHeight, aspect).toBeCloseTo(cw / 1.6, 10);
      expect(g.radius, aspect).toBeCloseTo(Math.min(0.62 * cw, W / 2 - 0.2 * cw), 10);
      expect(g.lift, aspect).toBeCloseTo((0.34 * cw) / 1.6, 10);
    }
  });

  it("centres the ring between the front card's bottom and the back card's top", () => {
    for (const shape of SHAPES) {
      for (const aspect of ASPECTS) {
        const g = orbitGeometry(shape, aspect);
        const frontBottom = g.frontY - g.cardHeight / 2;
        const backTop = g.frontY + g.lift + (0.58 * g.cardHeight) / 2;
        expect(frontBottom + backTop, `${shape} ${aspect}`).toBeCloseTo(0, 10);
      }
    }
  });
});

describe("Orbit motion", () => {
  it("puts screenshot 1 at the front, full size and strength, at rest", () => {
    for (const shape of SHAPES) {
      for (const aspect of ASPECTS) {
        const label = `${shape} ${aspect}`;
        const g = orbitGeometry(shape, aspect);
        const nodes = nodesAt(orbit(shape, 5), aspect, 0);
        const first = front(nodes);
        expect(first.id, label).toBe("orbit:0");
        expect(first.assetId, label).toBe(`${shape}-0`);
        expect(first.transform, label).toMatchObject({ x: 0, y: g.frontY, scale: 1 });
        expect(first.opacity, label).toBe(1);
        // Cards always face the camera: no screenshot is tilted.
        for (const node of nodes) {
          expect([node.transform.rx, node.transform.ry, node.transform.rz], label).toEqual([
            0, 0, 0,
          ]);
          expect(node.device, label).toBe("card");
        }
        // Only the front card is at full strength.
        for (const node of nodes.filter((n) => n !== first)) {
          expect(node.opacity, `${label} ${node.id}`).toBeLessThan(1);
        }
      }
    }
  });

  it("brings the next card in from the right and moves the front card off to the left", () => {
    for (const shape of SHAPES) {
      const layout = orbit(shape, 5);
      const at = (t: number, id: string) => nodesAt(layout, "4:5", t).find((n) => n.id === id)!;
      expect(at(0, "orbit:1").transform.x).toBeGreaterThan(0);
      expect(at(0.9, "orbit:0").transform.x).toBeLessThan(0);
      expect(at(0.9, "orbit:1").transform.x).toBeGreaterThan(0);
      expect(at(0.9, "orbit:1").transform.x).toBeLessThan(at(0, "orbit:1").transform.x);
      // After one step screenshot 2 is at the front.
      expect(front(nodesAt(layout, "4:5", 2)).id).toBe("orbit:1");
      expect(at(2, "orbit:1").transform.x).toBeCloseTo(0, 12);
    }
  });

  it("steps on the slider's timing: a 1.85 s move on `slide`, then a hold", () => {
    const layout = orbit("mobile", 5);
    const frontX = (t: number) => nodesAt(layout, "1:1", t).find((n) => n.id === "orbit:0")!;
    // Holding from 1.85 s to the end of the step.
    expect(frontX(1.9)).toEqual(frontX(1.99));
    expect(frontX(1.85).transform.x).toBeCloseTo(frontX(1.99).transform.x, 12);
    // Mid-move it matches the step progress: angle = -2π p / N.
    const { p } = sliderStep(0.7, 2);
    const g = orbitGeometry("mobile", "1:1");
    expect(frontX(0.7).transform.x).toBeCloseTo(g.radius * Math.sin((-2 * Math.PI * p) / 5), 12);
  });

  it("never reverses: every card turns one way the whole shot", () => {
    for (const shape of SHAPES) {
      for (const n of [4, 5, 6]) {
        const layout = orbit(shape, n);
        const total = sliderDuration(layout);
        // The angle of card 0 decreases monotonically: unwrap atan2(x / R, depth from scale).
        const g = orbitGeometry(shape, "4:5");
        let previous = Infinity;
        for (let t = 0; t <= total; t += 0.05) {
          const node = nodesAt(layout, "4:5", t).find((c) => c.id === "orbit:0")!;
          const depth = 2 * ((node.transform.scale - 0.58) / 0.42) - 1;
          let angle = Math.atan2(node.transform.x / g.radius, depth);
          while (angle > previous + 1e-9) angle -= 2 * Math.PI;
          expect(angle, `${shape} N=${n} t=${t.toFixed(2)}`).toBeLessThanOrEqual(previous + 1e-9);
          previous = angle;
        }
      }
    }
  });

  it("loops natively: frame(N × step) is exactly frame(0)", () => {
    for (const shape of SHAPES) {
      for (const aspect of ASPECTS) {
        for (const n of [1, 2, 3, 4, 5, 6]) {
          for (const step of [1.6, 2, 3.7]) {
            const layout = orbit(shape, n, step);
            const total = sliderDuration(layout);
            expect(nodesAt(layout, aspect, total), `${shape} ${aspect} N=${n} ${step}`).toEqual(
              nodesAt(layout, aspect, 0),
            );
          }
        }
      }
    }
  });

  it("fades with depth: 65% at the side and back, rising as z^4 to the front", () => {
    const nodes = nodesAt(orbit("desktop", 4), "4:5", 0);
    expect(nodes.map((n) => n.opacity)).toEqual([1, 0.65, 0.65, 0.65]);
    // Mid-step two cards share the front half of the ring.
    const mid = nodesAt(orbit("desktop", 6), "4:5", 0.8);
    for (const node of mid) {
      const depth = 2 * ((node.transform.scale - 0.58) / 0.42) - 1;
      expect(node.opacity, node.id).toBeCloseTo(0.65 + 0.35 * Math.max(0, depth) ** 4, 10);
    }
  });

  it("raises and shrinks cards toward the back, and draws nearer cards last", () => {
    const nodes = nodesAt(orbit("mobile", 4), "4:5", 0);
    const g = orbitGeometry("mobile", "4:5");
    const [first, side, back] = [nodes[0], nodes[1], nodes[2]];
    expect(back.transform.y).toBeCloseTo(g.frontY + g.lift, 12);
    expect(back.transform.scale).toBeCloseTo(0.58, 12);
    expect(side.transform.y).toBeCloseTo(g.frontY + g.lift / 2, 12);
    expect(side.transform.scale).toBeCloseTo(0.79, 12);
    expect(first.depthOrder).toBeGreaterThan(side.depthOrder);
    expect(side.depthOrder).toBeGreaterThan(back.depthOrder);
  });

  it("shows each screenshot once, at most the first 6, on cards of the right shape", () => {
    for (const shape of SHAPES) {
      const nodes = nodesAt(orbit(shape, 8), "16:9", 0.5);
      expect(nodes).toHaveLength(ORBIT_MAX_SCREENSHOTS);
      expect(new Set(nodes.map((n) => n.assetId)).size).toBe(ORBIT_MAX_SCREENSHOTS);
      const g = orbitGeometry(shape, "16:9");
      for (const node of nodes) {
        expect(node.width).toBeCloseTo(g.cardWidth, 12);
        expect(node.screenAspect).toBe(shape === "mobile" ? 0.4615 : 1.6);
      }
    }
    // An empty orbit shows one empty card at the front.
    const empty = resolveOrbitLayout({ ...orbit("mobile", 0) }, "4:5", [], 0);
    expect(empty.map((n) => [n.id, n.assetId])).toEqual([["orbit:0", null]]);
  });

  it("mixes faded cards with the background, not with the cards behind", () => {
    expect(fadeBlendFor(orbit("mobile", 4))).toBe("background");
    expect(fadeBlendFor({ ...orbit("mobile", 4), kind: "slider", axis: "x" })).toBe("srgb");
    expect(fadeBlendFor(undefined)).toBe("linear");
  });
});

describe("Orbit shots set their own length and keep a still camera", () => {
  it("lasts one step per shown screenshot", () => {
    expect(sliderDuration(orbit("mobile", 4))).toBe(8);
    expect(sliderDuration(orbit("desktop", 9, 3))).toBe(18);
    expect(fixedShotDuration(orbit("mobile", 5))).toBe(10);
    const camera = { preset: "pushIn", intensity: 1, easing: "smooth", float: 0.5 } as const;
    expect(fixedShotCamera(orbit("mobile", 5), camera)).toMatchObject({
      preset: "static",
      intensity: 0,
      float: 0,
    });
  });

  it("sanitizeDoc keeps an orbit, clamps its step and sets its length", () => {
    const doc = orbitDoc("desktop", 5);
    const layout = doc.shots[0].layout as OrbitLayout;
    layout.step = 9;
    doc.shots[0].duration = 3;
    doc.shots[0].camera = { preset: "pushIn", intensity: 1, easing: "smooth", float: 0 };
    const { doc: clean } = sanitizeDoc(doc);
    expect(clean.shots[0].layout).toEqual({ ...layout, step: 4 });
    expect(clean.shots[0].duration).toBe(20);
    expect(clean.shots[0].camera.preset).toBe("static");
  });
});

describe("Desktop Orbit and Mobile Orbit templates", () => {
  it("are a built-in desktop and mobile pair with 6 slots, the first 4 required", () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id);
    expect(ids.indexOf("desktop-orbit")).toBe(ids.indexOf("mobile-stack") + 1);
    expect(ids.indexOf("mobile-orbit")).toBe(ids.indexOf("desktop-orbit") + 1);
    expect(pairedTemplateId("desktop-orbit")).toBe("mobile-orbit");
    expect(pairedTemplateId("mobile-orbit")).toBe("desktop-orbit");
    for (const [template, role] of [
      [desktopOrbitTemplate, "desktop"],
      [mobileOrbitTemplate, "mobile"],
    ] as const) {
      expect(template.category).toBe(role);
      expect(templateTones(template)).toEqual(FLAT_TONES);
      expect(template.slots.map((s) => [s.key, s.role, s.required])).toEqual(
        [1, 2, 3, 4, 5, 6].map((n) => [`${role}${n}`, role, n <= 4]),
      );
    }
  });

  it("build at every aspect with 4, 5 and 6 screenshots and loop natively with a cut", () => {
    for (const shape of SHAPES) {
      for (const aspect of ASPECTS) {
        for (const n of [4, 5, 6]) {
          const label = `${shape} ${aspect} N=${n}`;
          const doc = orbitDoc(shape, n, aspect);
          expect(doc.shots, label).toHaveLength(1);
          const [shot] = doc.shots;
          expect(shot.layout, label).toEqual({
            kind: "orbit",
            assetIds: doc.assets.map((a) => a.id),
            shape,
            step: 2,
          });
          expect(shot.duration, label).toBe(n * 2);
          expect(shot.transitionIn.kind, label).toBe("cut");
          expect(shot.camera, label).toMatchObject({ preset: "static", intensity: 0, float: 0 });
          expect(doc.loop, label).toBe(true);
          expect(doc.style, label).toMatchObject({
            background: { kind: "solid", color: "#DFE1E3" },
            shadow: "none",
            grain: 0,
            vignette: 0,
          });
          const { total } = schedule(doc);
          expect(total, label).toBe(shot.duration);
          expect(evaluate(doc, total - 1e-3).layers, label).toHaveLength(1);
          expect(evaluate(doc, total), label).toEqual(evaluate(doc, 0));
        }
      }
    }
  });

  it("never repeat a screenshot when fillSlots runs short", () => {
    const assets = screenshots("mobile", 4);
    const built = buildTemplate(mobileOrbitTemplate, { aspect: "16:9", assets, name: "x" });
    expect((built.shots[0].layout as OrbitLayout).assetIds).toEqual(assets.map((a) => a.id));
  });
});

describe("Editing an orbit keeps its loop seamless", () => {
  it("a step change sets the duration to N × step, and undo restores both", () => {
    const store = createEditorStore(orbitDoc("mobile", 5));
    const shot = () => store.getState().doc.shots[0];
    store.getState().apply((draft) => {
      (draft.shots[0].layout as OrbitLayout).step = 3;
    });
    expect(shot().duration).toBe(15);
    store.getState().undo();
    expect(shot().duration).toBe(10);
  });

  it("a camera move is undone, and adding a screenshot adds a step after the card", () => {
    const doc = orbitDoc("desktop", 4);
    doc.assets.push(screenshot("desktop", 9));
    const store = createEditorStore(doc);
    const shot = () => store.getState().doc.shots[0];
    store.getState().apply((draft) => {
      draft.shots[0].camera.preset = "pushIn";
      draft.shots[0].camera.intensity = 1;
    });
    expect(shot().camera.preset).toBe("static");
    store.getState().assignAssetToSlot(0, "orbit:1", "desktop-9");
    expect((shot().layout as OrbitLayout).assetIds).toEqual([
      "desktop-0",
      "desktop-1",
      "desktop-9",
      "desktop-2",
      "desktop-3",
    ]);
    expect(shot().duration).toBe(10);
  });

  it("user templates keep the orbit and its length", () => {
    const doc = orbitDoc("mobile", 5);
    const template = convertDocToUserTemplate(doc, "Mine");
    const filled = fillUserTemplateSlots(template, doc.assets.slice(0, 4));
    expect(filled.shots[0].layout).toMatchObject({ kind: "orbit", shape: "mobile", step: 2 });
    expect((filled.shots[0].layout as OrbitLayout).assetIds).toHaveLength(4);
    expect(filled.shots[0].duration).toBe(8);
  });
});
