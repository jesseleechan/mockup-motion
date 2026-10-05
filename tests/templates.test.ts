import { describe, it, expect } from "vitest";
import { BUILTIN_TEMPLATES, buildTemplate, fillSlots } from "../src/templates";
import { createEditorStore } from "../src/state/store";
import { sanitizeDoc } from "../src/doc/validate";
import type { AssetRef } from "../src/doc/types";

describe("WP-12 & WP-11: Template Registry & Slot Filling", () => {
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
      id: "mobile-hero",
      name: "Mobile Hero",
      kind: "image",
      mime: "image/webp",
      bytes: 500,
      role: "mobile",
      width: 780,
      height: 1688,
    },
  ];

  it("all built-in templates have unique IDs, valid categories, and slots", () => {
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    const ids = new Set(BUILTIN_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(BUILTIN_TEMPLATES.length);

    for (const t of BUILTIN_TEMPLATES) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.defaultDuration).toBeGreaterThan(0);
      expect(["single", "responsive", "mobile", "portfolio", "reel"]).toContain(t.category);
    }
  });

  it("fillSlots matches asset roles and tall preference", () => {
    const heroDrift = BUILTIN_TEMPLATES.find((t) => t.id === "hero-drift")!;
    const slots = fillSlots(heroDrift, sampleAssets);
    expect(slots.desktop1).toBeDefined();
    // hero-drift prefers tall desktop if available
    expect(slots.desktop1?.id).toBe("desktop-full");

    const phoneTemplate = BUILTIN_TEMPLATES.find((t) => t.id === "floating-phone")!;
    const phoneSlots = fillSlots(phoneTemplate, sampleAssets);
    expect(phoneSlots.mobile1).toBeDefined();
    expect(phoneSlots.mobile1?.id).toBe("mobile-hero");
  });

  it("building every built-in template generates schema-valid shots and styles", async () => {
    for (const template of BUILTIN_TEMPLATES) {
      const built = buildTemplate(template, {
        aspect: "16:9",
        assets: sampleAssets,
        name: `Project: ${template.name}`,
      });

      expect(built.shots.length).toBeGreaterThanOrEqual(1);
      expect(built.style).toBeDefined();

      const store = createEditorStore();
      await store.getState().addAssets(sampleAssets);
      store.getState().applyTemplateResult(built, template.id);

      const { doc: sanitized, warnings } = sanitizeDoc(store.getState().doc);
      expect(warnings).toEqual([]);
      expect(sanitized.templateId).toBe(template.id);
      expect(sanitized.shots.length).toBe(built.shots.length);
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
