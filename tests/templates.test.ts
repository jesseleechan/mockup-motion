import { describe, it, expect } from "vitest";
import {
  BUILTIN_TEMPLATES,
  buildTemplate,
  fillSlots,
  validateTemplateRequirements,
  applyTemplate,
} from "../src/templates";
import { createEditorStore } from "../src/state/store";
import { sanitizeDoc } from "../src/doc/validate";
import type { Aspect, AssetRef } from "../src/doc/types";
import { evaluate } from "../src/motion/evaluate";
import { schedule } from "../src/motion/timeline";
import { createDoc } from "../src/doc/defaults";

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
