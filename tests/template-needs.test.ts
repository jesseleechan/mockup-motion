import { describe, expect, it } from "vitest";
import type { AssetRef, AssetRole } from "../src/doc/types";
import {
  BUILTIN_TEMPLATES,
  applyTemplate,
  demoAssetsToFill,
  emptyRequiredSlots,
  fillSlots,
  fullPageReplacements,
  getTemplateById,
  missingRequiredSlots,
  templateNeeds,
  validateTemplateRequirements,
  type Template,
} from "../src/templates";
import { demoAssetRef } from "../src/lab/demo-assets";
import { createEditorStore } from "../src/state/store";
import { createDoc } from "../src/doc/defaults";
import { templateToFill } from "../src/editor/template-actions";

function template(id: string): Template {
  const found = getTemplateById(id);
  if (!found) throw new Error(`No template ${id}`);
  return found;
}

function screenshots(role: AssetRole, count: number): AssetRef[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${role}-${i}`,
    kind: "image",
    name: `${role}-${i}.png`,
    mime: "image/png",
    bytes: 1000,
    role,
  }));
}

describe("Template cards say what a template needs (polish item 4)", () => {
  it("says it in screenshots, from the template's required slots", () => {
    expect(templateNeeds(template("desktop-slider"))).toBe("Needs 3+ desktop screenshots");
    expect(templateNeeds(template("mobile-stack"))).toBe("Needs 3+ mobile screenshots");
    expect(templateNeeds(template("frames"))).toBe("Needs 4+ desktop screenshots");
    expect(templateNeeds(template("mobile-orbit"))).toBe("Needs 4+ mobile screenshots");
    expect(templateNeeds(template("scroll-story"))).toBe("Needs a full-page desktop screenshot");
    expect(templateNeeds(template("mobile-scroll-story"))).toBe(
      "Needs a full-page mobile screenshot",
    );
    expect(templateNeeds(template("responsive-scroll"))).toBe(
      "Needs a desktop and a mobile full-page screenshot",
    );
  });

  it("gives every built-in template a needs line, never a slot count", () => {
    for (const t of BUILTIN_TEMPLATES) {
      expect(templateNeeds(t), t.id).toMatch(/^Needs (a |\d\+ )/);
      expect(templateNeeds(t), t.id).not.toMatch(/slot/);
    }
  });

  it("counts distinct screenshots of the role against the number needed", () => {
    const slider = template("desktop-slider");
    expect(validateTemplateRequirements(slider, screenshots("desktop", 2))).toEqual({
      valid: false,
      reason: "Needs 3+ desktop screenshots",
    });
    // Mobile screenshots don't count towards a desktop need.
    expect(
      validateTemplateRequirements(slider, [
        ...screenshots("desktop", 2),
        ...screenshots("mobile", 3),
      ]).valid,
    ).toBe(false);
    expect(validateTemplateRequirements(slider, screenshots("desktop", 3))).toEqual({
      valid: true,
    });
  });
});

describe("Scroll presets need a full-page screenshot (polish item 5)", () => {
  const hero = demoAssetRef("demo-northwind-desktop-hero");
  const full = demoAssetRef("demo-studio-kova-desktop-full");

  it("counts a short screenshot in a full-page slot as missing, so demo content adds a full page", () => {
    // After Desktop Slider's demo content the library holds only heroes, which can't scroll.
    const story = template("scroll-story");
    expect(missingRequiredSlots(story, [hero]).map((s) => s.key)).toEqual(["desktop1"]);
    const demo = demoAssetsToFill(story, [hero]);
    expect(demo.map((a) => a.meta?.tall)).toEqual([true]);
    expect(missingRequiredSlots(story, [hero, ...demo])).toEqual([]);
    expect(fillSlots(story, [hero, ...demo]).desktop1?.meta?.tall).toBe(true);
  });

  it("says so on the card until the library has a full-page screenshot of the role", () => {
    const story = template("scroll-story");
    expect(validateTemplateRequirements(story, [hero])).toEqual({
      valid: false,
      reason: "Needs a full-page desktop screenshot",
    });
    expect(validateTemplateRequirements(story, [hero, full])).toEqual({ valid: true });
    expect(
      validateTemplateRequirements(template("mobile-scroll-story"), [
        demoAssetRef("demo-aurelia-mobile-hero"),
      ]).valid,
    ).toBe(false);
  });
});

describe("A full-page screenshot fills Scroll Story without rebuilding it (polish item 5)", () => {
  const hero = demoAssetRef("demo-northwind-desktop-hero");
  const full = demoAssetRef("demo-studio-kova-desktop-full");

  it("counts only empty slots as unfilled, so a later upload never rebuilds the template", () => {
    const story = template("scroll-story");
    expect(emptyRequiredSlots(story, [hero])).toEqual([]);
    expect(emptyRequiredSlots(story, []).map((s) => s.key)).toEqual(["desktop1"]);
  });

  it("swaps the short screenshot for the first new full-page one of its role", () => {
    const story = template("scroll-story");
    expect(fullPageReplacements(story, [hero], [hero])).toEqual({});
    expect(fullPageReplacements(story, [hero], [demoAssetRef("demo-aurelia-mobile-full")])).toEqual(
      {},
    );
    expect(fullPageReplacements(story, [hero], [full])).toEqual({ [hero.id]: full.id });
    // Already full-page: nothing to swap.
    expect(
      fullPageReplacements(story, [full], [demoAssetRef("demo-aurelia-desktop-full")]),
    ).toEqual({});
  });

  it("keeps the user's shot edits when the full-page screenshot takes the slot", async () => {
    const story = template("scroll-story");
    const store = createEditorStore();
    await store
      .getState()
      .addAssetsAndApplyTemplate([hero], story.id, (doc) => applyTemplate(story, doc));
    store.getState().apply((d) => {
      d.shots[0].duration = 7.5;
    });
    const before = store.getState().doc.shots[0];

    const replace = fullPageReplacements(story, store.getState().doc.assets, [full]);
    await store.getState().addAssets([full], undefined, replace);

    const after = store.getState().doc.shots[0];
    expect(after.id).toBe(before.id);
    expect(after.duration).toBe(7.5);
    expect(after.layout).toMatchObject({ kind: "single", assetId: full.id });
    expect(missingRequiredSlots(story, store.getState().doc.assets)).toEqual([]);
  });
});

describe("Adding screenshots to a filled Scroll Story never rebuilds it", () => {
  it("has no template to fill once the slot holds any desktop screenshot", () => {
    const hero = demoAssetRef("demo-northwind-desktop-hero");
    const doc = createDoc({ templateId: "scroll-story", assets: [hero] });
    expect(templateToFill(doc)).toBeUndefined();
    expect(templateToFill(createDoc({ templateId: "scroll-story" }))?.id).toBe("scroll-story");
  });
});
