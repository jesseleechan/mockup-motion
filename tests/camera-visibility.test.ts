import { describe, expect, it } from "vitest";
import { showsCameraControls } from "../src/editor/inspector/shot/camera-visibility";
import { BUILTIN_TEMPLATES, buildTemplatePreviewDoc, getTemplateById } from "../src/templates";

function presetShot(id: string) {
  const template = getTemplateById(id);
  if (!template) throw new Error(`Unknown template: ${id}`);
  return buildTemplatePreviewDoc(template).shots[0];
}

describe("the Shot inspector offers camera controls only where a camera can move", () => {
  it("a preset with a still camera shows none; Scroll Story's Push in keeps them", () => {
    for (const template of BUILTIN_TEMPLATES) {
      const shot = buildTemplatePreviewDoc(template).shots[0];
      const still = shot.camera.preset === "static" && shot.camera.intensity === 0;
      // Every looping preset builds a still camera, so none of them shows the controls.
      expect(showsCameraControls(shot), template.id).toBe(!still);
    }
    expect(showsCameraControls(presetShot("scroll-story"))).toBe(true);
  });

  it("Frames shows them only while a saved camera still moves, so it can be turned off", () => {
    const frames = presetShot("frames");
    expect(showsCameraControls(frames)).toBe(false);
    frames.camera = { preset: "pushIn", intensity: 0.2, easing: "smooth", float: 0 };
    expect(showsCameraControls(frames)).toBe(true);
    frames.camera = { preset: "static", intensity: 0, easing: "smooth", float: 0.05 };
    expect(showsCameraControls(frames)).toBe(true);
  });

  it("a slider, orbit or Responsive Scroll never shows them", () => {
    for (const id of ["desktop-slider", "desktop-orbit", "responsive-scroll"]) {
      const shot = presetShot(id);
      shot.camera = { preset: "pushIn", intensity: 0.2, easing: "smooth", float: 0 };
      expect(showsCameraControls(shot), id).toBe(false);
    }
  });
});
