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
import type { ShotFrame } from "../src/motion/evaluate";
import { computeCameraBasis, projectPointToNDC } from "../src/motion/framing";
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

  it("exports all 5 built-in templates with unique IDs, categories, and slots", () => {
    expect(BUILTIN_TEMPLATES.length).toBe(5);
    const ids = new Set(BUILTIN_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(5);

    // Gallery order: the presets lead (presets plan D1), Mobile Frames after Desktop Frames
    // (Frames plan PF03; PF04 settles the final order, D12).
    expect(BUILTIN_TEMPLATES.map((t) => t.id)).toEqual([
      "desktop-slider",
      "mobile-slider",
      "frames",
      "mobile-frames",
      "scroll-story",
    ]);

    for (const t of BUILTIN_TEMPLATES) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.defaultDuration).toBeGreaterThan(0);
      expect(["desktop", "mobile"]).toContain(t.category);
      expect(t.slots.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("sorts each template under the tab of the screenshots it presents (Frames plan §8)", () => {
    expect(Object.fromEntries(BUILTIN_TEMPLATES.map((t) => [t.id, t.category]))).toEqual({
      "desktop-slider": "desktop",
      "mobile-slider": "mobile",
      frames: "desktop",
      "mobile-frames": "mobile",
      "scroll-story": "desktop",
    });
    for (const t of BUILTIN_TEMPLATES) {
      for (const slot of t.slots) expect(slot.role).toBe(t.category);
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

    it("applyTemplate preserves user's brand styling", () => {
      const template = BUILTIN_TEMPLATES.find((t) => t.id === "scroll-story")!;
      const doc = createDoc();
      doc.assets = sampleAssets;
      doc.style.textColor = "#123456";
      doc.style.accent = "#FF5500";

      const applied = applyTemplate(template, doc);
      expect(applied.style.textColor).toBe("#123456");
      expect(applied.style.accent).toBe("#FF5500");
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
  const SLIDER_TEMPLATES = ["mobile-slider", "desktop-slider"];
  // Both Frames presets loop natively with a cut: every lane travels one whole asset period
  // (contracts §5).
  const NATIVE_MARQUEE_TEMPLATES = ["frames", "mobile-frames"];
  const LOOPING_SINGLE_SHOT = BUILTIN_TEMPLATES.filter((template) => {
    const doc = buildTemplatePreviewDoc(template);
    return doc.loop && doc.shots.length === 1;
  }).map((template) => template.id);
  // Camera-move loops (pushIn, orbits): no built-in template builds one, but saved projects can.
  const CAMERA_LOOP_FIXTURES = ["single-browser", "pair"];
  // Tilted marquees and the wall loop with a wrap crossfade. No built-in template builds one
  // since Portfolio Rows, Phone Parade and Isometric Wall were removed, but saved projects can.
  const MARQUEE_FIXTURES = ["rows-browser-tilted", "columns-phone-tilted", "wall-isometric"];

  function loopDoc(id: string, aspect: Aspect): ProjectDoc {
    const template = BUILTIN_TEMPLATES.find((t) => t.id === id);
    return template ? buildTemplatePreviewDoc(template, aspect) : layoutFixture(id, aspect);
  }

  it("covers every looping single-shot template", () => {
    expect([...LOOPING_SINGLE_SHOT].sort()).toEqual(
      [...NATIVE_MARQUEE_TEMPLATES, ...SLIDER_TEMPLATES].sort(),
    );
  });

  // A single shot whose camera or strip moves one way cannot end where it starts, so a
  // cut back to t = 0 would pop. The frame just before the loop point must already be
  // the first frame: the wrap crossfade has finished (contracts.md §5).
  it("the frame just before the loop point is the first frame", () => {
    for (const id of [...LOOPING_SINGLE_SHOT, ...CAMERA_LOOP_FIXTURES, ...MARQUEE_FIXTURES]) {
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

        if (MARQUEE_FIXTURES.includes(id) || NATIVE_MARQUEE_TEMPLATES.includes(id)) {
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

  // Where a whole card step fits under the speed limit in one loop, the strip travels
  // whole steps, so halfway through the wrap crossfade both layers show cards in the same
  // places on screen and only the screens dissolve. The exceptions: tilted browser rows at 9:16
  // and tilted phone columns at 9:16 and 4:5 would need more than 0.12 frame widths per second
  // to move one card per loop, and the wall's isoDrift camera ends away from its start pose,
  // so its cards line up on the plane but not on screen.
  const UNREGISTERED = new Set([
    "rows-browser-tilted 9:16",
    "columns-phone-tilted 9:16",
    "columns-phone-tilted 4:5",
    ...ASPECTS.map((aspect) => `wall-isometric ${aspect}`),
  ]);

  it("cards stay in place during the wrap crossfade wherever a whole card step fits", () => {
    for (const id of MARQUEE_FIXTURES) {
      for (const aspect of ASPECTS) {
        const doc = layoutFixture(id, aspect);
        const label = `${id} ${aspect}`;
        const { total } = schedule(doc);
        const fade = doc.shots[0].transitionIn.duration;
        expect(fade, `${label}: wrap crossfade`).toBeGreaterThan(0);
        const [outgoing, incoming] = evaluate(doc, total - fade / 2).layers;
        expect(incoming, `${label}: two layers halfway through the wrap`).toBeDefined();
        // Card centres on screen, through each layer's own camera.
        const onScreen = (frame: ShotFrame, node: LayoutNode) =>
          projectPointToNDC(node.transform, computeCameraBasis(frame.camera, aspect));
        const placedOnScreen = (a: LayoutNode, b: LayoutNode) => {
          const pa = onScreen(outgoing.frame, a);
          const pb = onScreen(incoming.frame, b);
          return Math.abs(pa.x - pb.x) < 1e-4 && Math.abs(pa.y - pb.y) < 1e-4;
        };
        const placed = (a: LayoutNode, b: LayoutNode) =>
          Math.abs(a.transform.x - b.transform.x) < 1e-6 &&
          Math.abs(a.transform.y - b.transform.y) < 1e-6 &&
          Math.abs(a.transform.z - b.transform.z) < 1e-6;
        const visible = outgoing.frame.nodes.filter((node) => {
          const p = onScreen(outgoing.frame, node);
          return Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
        });
        expect(visible.length, `${label}: cards on screen`).toBeGreaterThan(1);
        const registered = visible.every((node) =>
          incoming.frame.nodes.some((other) => placedOnScreen(node, other)),
        );
        expect(registered, label).toBe(!UNREGISTERED.has(label));
        // The screens do change: a cut here would swap them.
        const sameScreens = outgoing.frame.nodes.every((node) =>
          incoming.frame.nodes.some(
            (other) => placed(node, other) && other.assetId === node.assetId,
          ),
        );
        expect(sameScreens, label).toBe(false);
      }
    }
  });
});
