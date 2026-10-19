import { describe, expect, it } from "vitest";
import type { AssetRef, AssetRole } from "../src/doc/types";
import {
  BUILTIN_TEMPLATES,
  demoAssetsToFill,
  fillSlots,
  getTemplateById,
  missingRequiredSlots,
  templateNeeds,
  validateTemplateRequirements,
  type Template,
} from "../src/templates";
import { demoAssetRef } from "../src/lab/demo-assets";

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
