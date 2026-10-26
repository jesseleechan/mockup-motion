import { describe, it, expect } from "vitest";
import {
  BUILTIN_TEMPLATES,
  buildTemplate,
  fillSlots,
  validateTemplateRequirements,
  applyTemplate,
  buildTemplatePreviewDoc,
} from "../src/templates";
import { createEditorStore } from "../src/state/store";
import { sanitizeDoc } from "../src/doc/validate";
import type { Aspect, AssetRef, ProjectDoc } from "../src/doc/types";
import { evaluate } from "../src/motion/evaluate";
import { schedule } from "../src/motion/timeline";
import { createDoc } from "../src/doc/defaults";
import { aspectRatioValue } from "../src/motion/camera";
import type { LayoutNode } from "../src/motion/layouts";
import { layoutFixture } from "../src/lab/layout-fixtures";

describe("WP-11 & WP-12: Templates, Slot Filling, and Quality Bar", () => {
  const sampleAssets: AssetRef[] = [
    {
      id: "desktop-hero",
      name: "Desktop Hero",
      kind: "image",
      mime: "image/webp",
      bytes: 1000,
      role: "desktop",
      width: 2880,
      height: 1800,
      meta: { tall: false },
    },
    {
      id: "desktop-full",
      name: "Desktop Full",
      kind: "image",
      mime: "image/webp",
      bytes: 2000,
      role: "desktop",
      width: 1440,
      height: 4000,
      meta: { tall: true },
    },
    {
      id: "desktop-feature-1",
      name: "Desktop Feature 1",
      kind: "image",
      mime: "image/webp",
      bytes: 1500,
      role: "desktop",
      width: 1440,
      height: 2500,
      meta: { tall: false },
    },
    {
      id: "desktop-feature-2",
      name: "Desktop Feature 2",
      kind: "image",
      mime: "image/webp",
      bytes: 1600,
      role: "desktop",
      width: 1440,
      height: 2500,
      meta: { tall: false },
    },
    {
      id: "mobile-hero",
      name: "Mobile Hero",
      kind: "image",
      mime: "image/webp",
      bytes: 500,
      role: "mobile",
      width: 780,
      height: 1688,
      meta: { tall: false },
    },
    {
      id: "mobile-full",
      name: "Mobile Full",
      kind: "image",
      mime: "image/webp",
      bytes: 800,
      role: "mobile",
      width: 780,
      height: 5000,
      meta: { tall: true },
    },
    {
      id: "mobile-settings",
      name: "Mobile Settings",
      kind: "image",
      mime: "image/webp",
      bytes: 600,
      role: "mobile",
      width: 780,
      height: 1688,
      meta: { tall: false },
    },
  ];

  it("exports the built-in templates with unique IDs, categories, and slots", () => {
    // No literal count (CLAUDE.md, Tests): the gallery order below pins the set.
    const ids = new Set(BUILTIN_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(BUILTIN_TEMPLATES.length);

    // Gallery order (Frames plan D12, stack plan D5, orbit plan, presets round two D15): the
    // Slider, Frames, Stack, Orbit, Site Tour and Scroll Story pairs, then Responsive Scroll and
    // Responsive Tour. The first entry is the first-run default (presets plan D1).
    expect(BUILTIN_TEMPLATES.map((t) => t.id)).toEqual([
      "desktop-slider",
      "mobile-slider",
      "frames",
      "mobile-frames",
      "desktop-stack",
      "mobile-stack",
      "desktop-orbit",
      "mobile-orbit",
      "desktop-site-tour",
      "mobile-site-tour",
      "scroll-story",
      "mobile-scroll-story",
      "responsive-scroll",
      "responsive-tour",
    ]);

    for (const t of BUILTIN_TEMPLATES) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.defaultDuration).toBeGreaterThan(0);
      expect(["desktop", "mobile", "both"]).toContain(t.category);
      expect(t.slots.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("sorts each template under the tab of the screenshots it presents (Frames plan §8)", () => {
    expect(Object.fromEntries(BUILTIN_TEMPLATES.map((t) => [t.id, t.category]))).toEqual({
      "desktop-slider": "desktop",
      "mobile-slider": "mobile",
      frames: "desktop",
      "mobile-frames": "mobile",
      "desktop-stack": "desktop",
      "mobile-stack": "mobile",
      "desktop-orbit": "desktop",
      "mobile-orbit": "mobile",
      "desktop-site-tour": "desktop",
      "mobile-site-tour": "mobile",
      "scroll-story": "desktop",
      "mobile-scroll-story": "mobile",
      "responsive-scroll": "both",
      "responsive-tour": "both",
    });
    for (const t of BUILTIN_TEMPLATES) {
      // A desktop + mobile template (Responsive Scroll, Responsive Tour) has a slot of each size.
      const roles = t.category === "both" ? ["desktop", "mobile"] : [t.category];
      for (const slot of t.slots) expect(roles).toContain(slot.role);
      expect(new Set(t.slots.map((slot) => slot.role)).size).toBe(roles.length);
    }
  });

  describe("fillSlots & validateTemplateRequirements", () => {
    it("fillSlots enforces role correctness with no cross-role assignment", () => {
      const onlyDesktop = sampleAssets.filter((a) => a.role === "desktop");
      const mobileSlider = BUILTIN_TEMPLATES.find((t) => t.id === "mobile-slider")!;

      // Mobile Slider needs mobile assets; desktop assets must not fill it
      const slots = fillSlots(mobileSlider, onlyDesktop);
      expect(slots.mobile1).toBeUndefined();
      expect(mobileSlider.slots.map((slot) => slots[slot.key])).toEqual(
        mobileSlider.slots.map(() => undefined),
      );

      // Desktop template should not be filled by mobile assets
      const onlyMobile = sampleAssets.filter((a) => a.role === "mobile");
      const scrollStory = BUILTIN_TEMPLATES.find((t) => t.id === "scroll-story")!;
      const storySlots = fillSlots(scrollStory, onlyMobile);
      expect(storySlots.desktop1).toBeUndefined();
    });

    it("fillSlots respects prefer: 'tall' when available", () => {
      const scrollStory = BUILTIN_TEMPLATES.find((t) => t.id === "scroll-story")!;
      const slots = fillSlots(scrollStory, sampleAssets);
      expect(slots.desktop1).toBeDefined();
      expect(slots.desktop1?.meta?.tall).toBe(true);
      expect(slots.desktop1?.id).toBe("desktop-full");
    });

    it("fillSlots preserves previous assignments when still valid", () => {
      const scrollStory = BUILTIN_TEMPLATES.find((t) => t.id === "scroll-story")!;
      // Explicitly assigned desktop-hero previously
      const previous = { desktop1: "desktop-hero" };
      const slots = fillSlots(scrollStory, sampleAssets, previous);
      expect(slots.desktop1?.id).toBe("desktop-hero");
    });

    it("validateTemplateRequirements enforces the minimum distinct screenshots for multi-screen layouts", () => {
      const framesTemplate = BUILTIN_TEMPLATES.find((t) => t.id === "frames")!;
      const desktop = sampleAssets.filter((a) => a.role === "desktop");

      // 3 desktop assets: not enough for Frames (quality bar §4)
      const tooFewDesktop = desktop.slice(0, 3);
      const framesValidation = validateTemplateRequirements(framesTemplate, tooFewDesktop);
      expect(framesValidation.valid).toBe(false);
      expect(framesValidation.reason).toBe("Needs 4+ desktop screenshots");

      // Mobile screenshots don't count towards a desktop minimum
      const mixed = [...tooFewDesktop, ...sampleAssets.filter((a) => a.role === "mobile")];
      expect(validateTemplateRequirements(framesTemplate, mixed).reason).toBe(
        "Needs 4+ desktop screenshots",
      );

      // 4 desktop assets: satisfies Frames
      expect(desktop).toHaveLength(4);
      expect(validateTemplateRequirements(framesTemplate, desktop).valid).toBe(true);
    });

    it("validateTemplateRequirements takes the role from the template's required slots", () => {
      const mobileFrames = BUILTIN_TEMPLATES.find((t) => t.id === "mobile-frames")!;
      const mobile = sampleAssets.filter((a) => a.role === "mobile");
      expect(mobile).toHaveLength(3);
      const validation = validateTemplateRequirements(mobileFrames, sampleAssets);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe("Needs 4+ mobile screenshots");
      const fourth: AssetRef = { ...mobile[0], id: "mobile-fourth" };
      expect(validateTemplateRequirements(mobileFrames, [...mobile, fourth]).valid).toBe(true);
    });

    it("applyTemplate preserves the user's browser chrome", () => {
      // Scroll Story sets its own chrome; the slider keeps the document's.
      const template = BUILTIN_TEMPLATES.find((t) => t.id === "desktop-slider")!;
      const doc = createDoc();
      doc.assets = sampleAssets;
      doc.style.browserChrome = "none";

      const applied = applyTemplate(template, doc);
      expect(applied.style.browserChrome).toBe("none");
    });
  });

  describe("Every template across all 5 aspects", () => {
    const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];

    for (const template of BUILTIN_TEMPLATES) {
      for (const aspect of ASPECTS) {
        it(`${template.id} builds valid schema shots and evaluates without error at ${aspect}`, () => {
          const built = buildTemplate(template, {
            aspect,
            assets: sampleAssets,
            name: `Test: ${template.name}`,
          });

          expect(built.shots.length).toBeGreaterThanOrEqual(1);
          expect(built.style).toBeDefined();

          const doc = {
            ...createDoc(),
            name: template.name,
            aspect,
            templateId: template.id,
            assets: sampleAssets,
            style: built.style,
            shots: built.shots,
            loop: built.loop,
          };

          const { warnings } = sanitizeDoc(doc);
          expect(warnings).toEqual([]);

          // Evaluate at start, middle, and end
          const sched = schedule(doc);
          expect(sched.total).toBeGreaterThan(0);

          const frameStart = evaluate(doc, 0);
          expect(frameStart.layers.length).toBeGreaterThanOrEqual(1);

          const frameMid = evaluate(doc, sched.total * 0.5);
          expect(frameMid.layers.length).toBeGreaterThanOrEqual(1);

          const frameEnd = evaluate(doc, sched.total);
          expect(frameEnd.layers.length).toBeGreaterThanOrEqual(1);

          // For single-shot loopable templates, verify loop seam property
          if (built.loop && built.shots.length === 1 && !built.shots[0].scroll?.enabled) {
            // Camera position at t=0 and t=total must seamlessly match for static camera or loop
            if (built.shots[0].camera.preset === "static") {
              const cam0 = frameStart.layers[0].frame.camera;
              const camEnd = frameEnd.layers[0].frame.camera;
              expect(cam0.panX).toBeCloseTo(camEnd.panX, 3);
              expect(cam0.panY).toBeCloseTo(camEnd.panY, 3);
            }
          }
        });
      }
    }
  });

  it("applying a template records exactly one undo step in the store", () => {
    const store = createEditorStore();
    expect(store.getState().past.length).toBe(0);

    const template = BUILTIN_TEMPLATES[0];
    const built = buildTemplate(template, {
      aspect: "16:9",
      assets: sampleAssets,
      name: "New Presentation",
    });

    store.getState().applyTemplateResult(built, template.id);
    expect(store.getState().past.length).toBe(1);

    store.getState().undo();
    expect(store.getState().past.length).toBe(0);
    expect(store.getState().doc.templateId).toBeUndefined();
  });
});

describe("Template loop seam", () => {
  const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
  // The Stack presets are slider decks (stack plan D4): the same seam check applies.
  const SLIDER_TEMPLATES = ["mobile-slider", "desktop-slider", "desktop-stack", "mobile-stack"];
  // An orbit loops natively with a cut: after N steps the ring is back where it started.
  const ORBIT_TEMPLATES = ["desktop-orbit", "mobile-orbit"];
  // A Site Tour loops natively with a cut: after N steps its first page is back on the screen.
  // So does a Responsive Tour, on both of its cards.
  const TOUR_TEMPLATES = ["desktop-site-tour", "mobile-site-tour", "responsive-tour"];
  // Both Frames presets loop natively with a cut: every lane travels one whole asset period
  // (contracts §5).
  const NATIVE_MARQUEE_TEMPLATES = ["frames", "mobile-frames"];
  // Responsive Scroll can't reverse its scroll, so it loops by the wrap crossfade (contracts §5).
  const WRAP_SCROLL_TEMPLATES = ["responsive-scroll"];
  const LOOPING_SINGLE_SHOT = BUILTIN_TEMPLATES.filter((template) => {
    const doc = buildTemplatePreviewDoc(template);
    return doc.loop && doc.shots.length === 1;
  }).map((template) => template.id);
  // Camera-move loops (pushIn, orbits): no built-in template builds one, but saved projects can.
  const CAMERA_LOOP_FIXTURES = ["single-browser"];

  function loopDoc(id: string, aspect: Aspect): ProjectDoc {
    const template = BUILTIN_TEMPLATES.find((t) => t.id === id);
    return template ? buildTemplatePreviewDoc(template, aspect) : layoutFixture(id, aspect);
  }

  it("covers every looping single-shot template", () => {
    expect([...LOOPING_SINGLE_SHOT].sort()).toEqual(
      [
        ...NATIVE_MARQUEE_TEMPLATES,
        ...SLIDER_TEMPLATES,
        ...ORBIT_TEMPLATES,
        ...TOUR_TEMPLATES,
        ...WRAP_SCROLL_TEMPLATES,
      ].sort(),
    );
  });

  // A single shot whose camera or strip moves one way cannot end where it starts, so a
  // cut back to t = 0 would pop. The frame just before the loop point must already be
  // the first frame: the wrap crossfade has finished (contracts.md §5).
  it("the frame just before the loop point is the first frame", () => {
    for (const id of [...LOOPING_SINGLE_SHOT, ...CAMERA_LOOP_FIXTURES]) {
      for (const aspect of ASPECTS) {
        const doc = loopDoc(id, aspect);
        const label = `${id} ${aspect}`;
        const { total } = schedule(doc);
        const start = evaluate(doc, 0).layers;
        expect(start, label).toHaveLength(1);
        const first = start[0].frame;

        const end = evaluate(doc, total - 1e-4).layers;
        const shown = end.reduce((a, b) => (b.weight > a.weight ? b : a));
        expect(shown.weight, `${label}: weight of the dominant layer`).toBeGreaterThan(0.999);

        for (const key of ["yaw", "pitch", "roll", "distance", "panX", "panY", "fov"] as const) {
          expect(shown.frame.camera[key], `${label}: camera ${key}`).toBeCloseTo(
            first.camera[key],
            3,
          );
        }

        if (NATIVE_MARQUEE_TEMPLATES.includes(id)) {
          expectSameMarqueeCards(first.nodes, shown.frame.nodes, aspect, label);
        } else if (SLIDER_TEMPLATES.includes(id)) {
          expectSameSliderCards(first.nodes, shown.frame.nodes, label);
        } else {
          expectSameNodes(first.nodes, shown.frame.nodes, label);
        }
      }
    }
  });

  function expectSameNodes(first: LayoutNode[], last: LayoutNode[], label: string): void {
    expect(
      last.map((node) => node.id),
      `${label}: node ids`,
    ).toEqual(first.map((node) => node.id));
    first.forEach((node, i) => {
      const other = last[i];
      const where = `${label}: ${node.id}`;
      expect(other.assetId, `${where} asset`).toBe(node.assetId);
      expect(other.device, `${where} device`).toBe(node.device);
      for (const key of ["width", "height", "opacity", "scroll"] as const) {
        expect(other[key], `${where} ${key}`).toBeCloseTo(node[key], 4);
      }
      for (const key of ["x", "y", "z", "rx", "ry", "rz", "scale"] as const) {
        expect(other.transform[key], `${where} ${key}`).toBeCloseTo(node.transform[key], 4);
      }
      // A screen of several panes (Site Tour) shows the same screenshots in the same places.
      expect(other.panes?.length, `${where} panes`).toBe(node.panes?.length);
      node.panes?.forEach((pane, j) => {
        const twin = other.panes?.[j];
        expect(twin?.assetId, `${where} pane ${j} asset`).toBe(pane.assetId);
        expect(twin?.offset, `${where} pane ${j} offset`).toBeCloseTo(pane.offset, 4);
        expect(twin?.clip, `${where} pane ${j} clip`).toEqual(pane.clip);
        expect(twin?.scroll, `${where} pane ${j} scroll`).toBeCloseTo(pane.scroll, 4);
      });
    });
  }

  /**
   * A slider's ring holds more cards than screenshots, so after one loop a different ring card
   * with the same screenshot sits in each slot. Every drawn card must have a twin in the other
   * frame: same screenshot, size, place, scale and opacity.
   */
  function expectSameSliderCards(first: LayoutNode[], last: LayoutNode[], label: string): void {
    const drawn = (nodes: LayoutNode[]) => nodes.filter((node) => node.opacity > 1e-3);
    const same = (a: LayoutNode, b: LayoutNode) =>
      a.assetId === b.assetId &&
      a.device === b.device &&
      Math.abs(a.width - b.width) < 1e-4 &&
      Math.abs(a.height - b.height) < 1e-4 &&
      Math.abs(a.opacity - b.opacity) < 1e-4 &&
      (["x", "y", "z", "scale"] as const).every(
        (key) => Math.abs(a.transform[key] - b.transform[key]) < 1e-4,
      );
    expect(drawn(last).length, `${label}: cards drawn at the loop point`).toBe(drawn(first).length);
    expect(drawn(first).length, `${label}: cards drawn at the start`).toBeGreaterThanOrEqual(3);
    for (const [from, to, where] of [
      [first, last, "at the loop point"],
      [last, first, "at the start"],
    ] as const) {
      for (const node of drawn(from)) {
        const match = drawn(to).find((other) => same(node, other));
        expect(match, `${label}: ${node.id} (${node.assetId}) ${where}`).toBeDefined();
      }
    }
  }

  function expectSameMarqueeCards(
    first: LayoutNode[],
    last: LayoutNode[],
    aspect: Aspect,
    label: string,
  ): void {
    // Cards near the frame: within half the frame diagonal plus one card of the
    // centre. Each ring wraps much farther out, where a card may sit on either end.
    const halfDiagonal = Math.sqrt(aspectRatioValue(aspect) ** 2 + 1) / 2;
    const near = (node: LayoutNode) =>
      Math.hypot(node.transform.x, node.transform.y, node.transform.z) <
      halfDiagonal + Math.max(node.width, node.height);
    const same = (a: LayoutNode, b: LayoutNode) =>
      a.assetId === b.assetId &&
      Math.abs(a.transform.x - b.transform.x) < 1e-3 &&
      Math.abs(a.transform.y - b.transform.y) < 1e-3 &&
      Math.abs(a.transform.z - b.transform.z) < 1e-3;
    const checks: [LayoutNode[], LayoutNode[], string][] = [
      [first, last, "at the start"],
      [last, first, "at the loop point"],
    ];
    for (const [from, to, where] of checks) {
      const nearby = from.filter(near);
      expect(nearby.length, `${label}: cards near the frame`).toBeGreaterThan(3);
      for (const node of nearby) {
        const match = to.find((other) => same(node, other));
        expect(match, `${label}: ${node.id} (${node.assetId}) ${where}`).toBeDefined();
      }
    }
  }

  // A Frames shot given a wrap crossfade loops after `total`, so its lanes travel one period
  // per `total`; during the crossfade the incoming lanes run on t − total (evaluate.ts). Both
  // layers then show the same cards in the same places, so the crossfade cannot be seen.
  it("Frames lanes line up in both layers of a wrap crossfade", () => {
    for (const id of NATIVE_MARQUEE_TEMPLATES) {
      for (const aspect of ASPECTS) {
        const doc = loopDoc(id, aspect);
        doc.shots[0].transitionIn = { kind: "fade", duration: 0.8, easing: "quintInOut" };
        const label = `${id} ${aspect}`;
        const { total } = schedule(doc);
        const [outgoing, incoming] = evaluate(doc, total - 0.4).layers;
        expect(incoming, `${label}: two layers halfway through the wrap`).toBeDefined();
        expectSameMarqueeCards(outgoing.frame.nodes, incoming.frame.nodes, aspect, label);
      }
    }
  });
});
