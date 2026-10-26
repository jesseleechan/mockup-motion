import { describe, expect, it } from "vitest";
import { createDoc } from "../src/doc/defaults";
import { migrateV1Project } from "../src/doc/migrate";
import type { CameraMove, ProjectDoc } from "../src/doc/types";
import { sanitizeDoc } from "../src/doc/validate";
import { evaluate } from "../src/motion";
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
    // Its float (cut on 26 October 2026) is dropped too.
    expect(doc.shots[0].camera).toEqual({
      preset: "static",
      intensity: 0.8,
      easing: "gentle",
    });
  });

  it("keeps the static and pushIn cameras", () => {
    for (const preset of ["static", "pushIn"] as const) {
      const saved = createDoc();
      saved.shots[0].camera = { preset, intensity: 0.2, easing: "smooth" };
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

// Float, a sine sway over the shot, was cut on 26 October 2026. A project saved with one loads
// without it and renders as its move alone: Still stays still, Push in pushes in without sway.
describe("removed Float", () => {
  const SHOT_DURATION = 10;
  const CAMERAS: CameraMove[] = [
    { preset: "static", intensity: 0, easing: "smooth" },
    // Scroll Story's camera, which saved Float 0.05.
    { preset: "pushIn", intensity: 0.2, easing: "smooth" },
  ];

  /** A single-shot project with this camera, as JSON. */
  function savedDoc(camera: CameraMove): ProjectDoc {
    const doc = createDoc({ loop: false });
    doc.shots[0].duration = SHOT_DURATION;
    doc.shots[0].camera = camera;
    return JSON.parse(JSON.stringify(doc));
  }

  /** The same project as saved before the cut, with Float at its old maximum. */
  function savedWithFloat(camera: CameraMove): ProjectDoc {
    const saved = savedDoc(camera);
    (saved.shots[0].camera as unknown as Record<string, unknown>).float = 1;
    return saved;
  }

  it.each(CAMERAS)("a saved $preset camera with float loads without it", (camera) => {
    const { doc } = sanitizeDoc(savedWithFloat(camera));
    expect(doc.shots[0].camera).toEqual(camera);
  });

  it.each(CAMERAS)("a saved $preset camera with float renders its move alone", (camera) => {
    // Loaded, and also as saved: the renderer ignores a float that skipped sanitizeDoc.
    const cases: [string, ProjectDoc, ProjectDoc][] = [
      ["loaded", sanitizeDoc(savedWithFloat(camera)).doc, sanitizeDoc(savedDoc(camera)).doc],
      ["raw", savedWithFloat(camera), savedDoc(camera)],
    ];
    for (const [label, doc, reference] of cases) {
      let previousDistance = Infinity;
      for (let i = 0; i <= 40; i++) {
        const t = (i / 40) * SHOT_DURATION;
        const pose = evaluate(doc, t).layers[0].frame.camera;
        const expected = evaluate(reference, t).layers[0].frame.camera;
        expect(pose, `${label} t=${t}`).toEqual(expected);
        // No sway: the camera never turns, and its distance never grows back (quality bar §2.5).
        expect(pose.yaw, `${label} t=${t}`).toBe(0);
        expect(pose.pitch, `${label} t=${t}`).toBe(0);
        expect(pose.distance, `${label} t=${t}`).toBeLessThanOrEqual(previousDistance);
        previousDistance = pose.distance;
      }
    }
  });
});
