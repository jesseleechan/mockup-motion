import { describe, expect, it } from "vitest";
import { createDoc } from "../src/doc/defaults";
import { migrateV1Project } from "../src/doc/migrate";
import { sanitizeDoc } from "../src/doc/validate";
import { createV1Project } from "./fixtures/v1-presets";

// The ten camera moves removed on 19 October 2026. A saved project that uses one still loads,
// with a still camera.
const REMOVED_PRESETS = [
  "pullBack",
  "orbitLeft",
  "orbitRight",
  "tiltUp",
  "tiltDown",
  "riseUp",
  "dollyLeft",
  "dollyRight",
  "isoDrift",
  "heroTilt",
];

describe("removed camera moves", () => {
  it.each(REMOVED_PRESETS)("a saved %s camera loads as static", (preset) => {
    const saved = JSON.parse(JSON.stringify(createDoc()));
    saved.shots[0].camera = { preset, intensity: 0.8, easing: "gentle", float: 0.3 };
    const { doc } = sanitizeDoc(saved);
    expect(doc.shots[0].camera).toEqual({
      preset: "static",
      intensity: 0.8,
      easing: "gentle",
      float: 0.3,
    });
  });

  it("keeps the static and pushIn cameras", () => {
    for (const preset of ["static", "pushIn"] as const) {
      const saved = createDoc();
      saved.shots[0].camera = { preset, intensity: 0.2, easing: "smooth", float: 0 };
      expect(sanitizeDoc(saved).doc.shots[0].camera.preset).toBe(preset);
    }
  });

  it("migrates v1 drift and glide, which became Rise and Dolly right, to static", () => {
    const expected = { drift: "static", glide: "static", still: "static", zoom: "pushIn" };
    for (const [type, preset] of Object.entries(expected)) {
      const v1 = createV1Project();
      v1.composition.motion.type = type as typeof v1.composition.motion.type;
      expect(migrateV1Project(v1).shots[0].camera.preset, type).toBe(preset);
    }
  });
});
