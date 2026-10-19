import { describe, expect, it } from "vitest";
import type { AssetRef, AssetRole } from "../src/doc/types";
import {
  BUILTIN_TEMPLATES,
  getTemplateById,
  templateNeeds,
  validateTemplateRequirements,
  type Template,
} from "../src/templates";

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
