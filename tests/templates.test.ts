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
import type { Aspect, AssetRef } from "../src/doc/types";
import { evaluate } from "../src/motion/evaluate";
import { schedule } from "../src/motion/timeline";
import { createDoc } from "../src/doc/defaults";
import { aspectRatioValue } from "../src/motion/camera";
import type { ShotFrame } from "../src/motion/evaluate";
import { computeCameraBasis, projectPointToNDC } from "../src/motion/framing";
import type { LayoutNode } from "../src/motion/layouts";

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

  it("exports all 12 built-in templates with unique IDs, categories, and slots", () => {
    expect(BUILTIN_TEMPLATES.length).toBe(12);
    const ids = new Set(BUILTIN_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(12);

    const expectedIds = [
      "quiet-hero",
      "tilted-showcase",
      "responsive-pair",
      "responsive-trio",
      "phone-spotlight",
      "phone-parade",
      "portfolio-rows",
      "isometric-wall",
      "cascade-stack",
      "scroll-story",
      "launch-reel",
      "case-study-reel",
    ];

    for (const expectedId of expectedIds) {
      expect(ids.has(expectedId)).toBe(true);
    }

    for (const t of BUILTIN_TEMPLATES) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.defaultDuration).toBeGreaterThan(0);
      expect(["single", "responsive", "mobile", "portfolio", "reel"]).toContain(t.category);
      expect(t.slots.length).toBeGreaterThanOrEqual(1);
    }
  });

  describe("fillSlots & validateTemplateRequirements", () => {
    it("fillSlots enforces role correctness with no cross-role assignment", () => {
      const onlyDesktop = sampleAssets.filter((a) => a.role === "desktop");
      const phoneSpotlight = BUILTIN_TEMPLATES.find((t) => t.id === "phone-spotlight")!;

      // Phone spotlight needs a mobile asset; desktop assets must not fill it
      const slots = fillSlots(phoneSpotlight, onlyDesktop);
      expect(slots.mobile1).toBeUndefined();

      // Desktop template should not be filled by mobile assets
      const onlyMobile = sampleAssets.filter((a) => a.role === "mobile");
      const quietHero = BUILTIN_TEMPLATES.find((t) => t.id === "quiet-hero")!;
      const heroSlots = fillSlots(quietHero, onlyMobile);
      expect(heroSlots.desktop1).toBeUndefined();
    });

    it("fillSlots respects prefer: 'tall' when available", () => {
      const quietHero = BUILTIN_TEMPLATES.find((t) => t.id === "quiet-hero")!;
      const slots = fillSlots(quietHero, sampleAssets);
      expect(slots.desktop1).toBeDefined();
      expect(slots.desktop1?.meta?.tall).toBe(true);
      expect(slots.desktop1?.id).toBe("desktop-full");
    });

    it("fillSlots preserves previous assignments when still valid", () => {
      const quietHero = BUILTIN_TEMPLATES.find((t) => t.id === "quiet-hero")!;
      // Explicitly assigned desktop-hero previously
      const previous = { desktop1: "desktop-hero" };
      const slots = fillSlots(quietHero, sampleAssets, previous);
      expect(slots.desktop1?.id).toBe("desktop-hero");
    });

    it("validateTemplateRequirements enforces at least 3 distinct assets for marquee/wall layouts", () => {
      const wallTemplate = BUILTIN_TEMPLATES.find((t) => t.id === "isometric-wall")!;
      const paradeTemplate = BUILTIN_TEMPLATES.find((t) => t.id === "phone-parade")!;

      // 1 desktop asset: not enough for wall
      const tooFewDesktop = [sampleAssets[0]];
      const wallValidation = validateTemplateRequirements(wallTemplate, tooFewDesktop);
      expect(wallValidation.valid).toBe(false);
      expect(wallValidation.reason).toBe("Needs 3+ desktop screenshots");

      // 4 desktop assets: satisfies wall
      const enoughDesktop = sampleAssets.filter((a) => a.role === "desktop");
      expect(validateTemplateRequirements(wallTemplate, enoughDesktop).valid).toBe(true);

      // 1 mobile asset: not enough for phone-parade
      const tooFewMobile = [sampleAssets[4]];
      const paradeValidation = validateTemplateRequirements(paradeTemplate, tooFewMobile);
      expect(paradeValidation.valid).toBe(false);
      expect(paradeValidation.reason).toBe("Needs 3+ mobile screenshots");

      // 3 mobile assets: satisfies phone-parade
      const enoughMobile = sampleAssets.filter((a) => a.role === "mobile");
      expect(validateTemplateRequirements(paradeTemplate, enoughMobile).valid).toBe(true);
    });

    it("applyTemplate preserves user's brand styling", () => {
      const template = BUILTIN_TEMPLATES.find((t) => t.id === "quiet-hero")!;
      const doc = createDoc();
      doc.assets = sampleAssets;
      doc.style.textColor = "#123456";
      doc.style.accent = "#FF5500";

      const applied = applyTemplate(template, doc);
      expect(applied.style.textColor).toBe("#123456");
      expect(applied.style.accent).toBe("#FF5500");
    });
  });

  describe("All 12 templates across all 5 aspects", () => {
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
  const MARQUEE_TEMPLATES = ["portfolio-rows", "phone-parade", "isometric-wall"];
  const LOOPING_SINGLE_SHOT = BUILTIN_TEMPLATES.filter((template) => {
    const doc = buildTemplatePreviewDoc(template);
    return doc.loop && doc.shots.length === 1;
  }).map((template) => template.id);

  it("covers every looping single-shot template", () => {
    expect([...LOOPING_SINGLE_SHOT].sort()).toEqual(
      [
        "quiet-hero",
        "tilted-showcase",
        "responsive-pair",
        "responsive-trio",
        "phone-spotlight",
        "cascade-stack",
        ...MARQUEE_TEMPLATES,
      ].sort(),
    );
  });

  // A single shot whose camera or strip moves one way cannot end where it starts, so a
  // cut back to t = 0 would pop. The frame just before the loop point must already be
  // the first frame: the wrap crossfade has finished (contracts.md §5).
  it("the frame just before the loop point is the first frame", () => {
    for (const id of LOOPING_SINGLE_SHOT) {
      const template = BUILTIN_TEMPLATES.find((t) => t.id === id)!;
      for (const aspect of ASPECTS) {
        const doc = buildTemplatePreviewDoc(template, aspect);
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

        if (MARQUEE_TEMPLATES.includes(id)) {
          expectSameMarqueeCards(first.nodes, shown.frame.nodes, aspect, label);
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
  // places on screen and only the screens dissolve. The exceptions: portfolio-rows 9:16
  // and phone-parade 9:16 and 4:5 would need more than 0.12 frame widths per second to
  // move one card per loop, and isometric-wall's isoDrift camera ends away from its start
  // pose, so its cards line up on the plane but not on screen.
  const UNREGISTERED = new Set([
    "portfolio-rows 9:16",
    "phone-parade 9:16",
    "phone-parade 4:5",
    ...ASPECTS.map((aspect) => `isometric-wall ${aspect}`),
  ]);

  it("cards stay in place during the wrap crossfade wherever a whole card step fits", () => {
    for (const id of MARQUEE_TEMPLATES) {
      const template = BUILTIN_TEMPLATES.find((t) => t.id === id)!;
      for (const aspect of ASPECTS) {
        const doc = buildTemplatePreviewDoc(template, aspect);
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
