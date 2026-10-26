import { describe, expect, it } from "vitest";
import type { Layout } from "../src/doc/types";
import { scrubberKeyTime, timeToX, timelineMarks, xToTime } from "../src/editor/timeline/marks";
import { schedule } from "../src/motion";
import { isSteppedLayout, steppedCount } from "../src/motion/layouts/duration";
import { sliderStep } from "../src/motion/layouts/slider";
import { BUILTIN_TEMPLATES, buildTemplatePreviewDoc } from "../src/templates";

// Every built-in template as the gallery builds it, with the loop the editor shows (F06).
const TEMPLATE_LOOPS = BUILTIN_TEMPLATES.map((template) => {
  const doc = buildTemplatePreviewDoc(template);
  return { id: template.id, layout: doc.shots[0].layout, loop: schedule(doc).total };
});

describe("slim timeline marks on the built-in templates", () => {
  it("covers stepped, Frames and single-device templates", () => {
    const kinds = new Set(TEMPLATE_LOOPS.map(({ layout }) => layout.kind));
    expect(kinds).toContain("slider");
    expect(kinds).toContain("orbit");
    expect([...kinds].some((kind) => kind === "rows" || kind === "columns")).toBe(true);
    expect(kinds).toContain("single");
  });

  it("ticks where the motion module starts each step, one per screenshot in the loop", () => {
    for (const { id, layout, loop } of TEMPLATE_LOOPS) {
      if (!isSteppedLayout(layout)) continue;
      const { steps } = timelineMarks(layout, loop);
      // Slider, Stack (the deck arrangement) and Orbit all step on sliderStep's timing.
      const stepsInLoop = new Set<number>();
      for (let t = 0; t < loop; t += 0.01) stepsInLoop.add(sliderStep(t, layout.step).k);
      expect(steps, id).toHaveLength(stepsInLoop.size);
      expect(steps, id).toHaveLength(steppedCount(layout));
      steps.forEach((time, k) => {
        expect(sliderStep(time, layout.step).k, `${id} step ${k} starts`).toBe(k);
        if (k > 0) expect(sliderStep(time - 0.01, layout.step).k, `${id} step ${k}`).toBe(k - 1);
      });
    }
  });

  it("marks the loop point for Frames and nothing for a single device", () => {
    for (const { id, layout, loop } of TEMPLATE_LOOPS) {
      if (isSteppedLayout(layout)) continue;
      const frames = layout.kind === "rows" || layout.kind === "columns";
      expect(timelineMarks(layout, loop), id).toEqual({ steps: [], loopPoint: frames });
    }
  });

  it("drops steps that a loop shorter than the steps never reaches", () => {
    const slider = TEMPLATE_LOOPS.find(({ layout }) => layout.kind === "slider")?.layout as Layout;
    if (!isSteppedLayout(slider)) throw new Error("no slider template");
    const loop = slider.step * 2.5;
    expect(timelineMarks(slider, loop).steps).toEqual([0, slider.step, slider.step * 2]);
  });
});

describe("scrubber positions", () => {
  it("maps time to the track and back", () => {
    expect(timeToX(5, 10, 400)).toBe(200);
    expect(timeToX(12, 10, 400)).toBe(400);
    expect(xToTime(100, 10, 400, [])).toBe(2.5);
    expect(xToTime(-20, 10, 400, [])).toBe(0);
  });

  it("snaps to a step within the snap distance only", () => {
    expect(xToTime(203, 10, 400, [5], 6)).toBe(5);
    expect(xToTime(210, 10, 400, [5], 6)).toBe(5.25);
  });
});

describe("scrubber keys", () => {
  const steps = [0, 2, 4, 6];

  it("moves to the next and previous step where the preset has steps", () => {
    expect(scrubberKeyTime("ArrowRight", false, 0, 8, steps)).toBe(2);
    expect(scrubberKeyTime("ArrowRight", false, 3, 8, steps)).toBe(4);
    expect(scrubberKeyTime("ArrowRight", false, 6, 8, steps)).toBe(8);
    expect(scrubberKeyTime("ArrowLeft", false, 4, 8, steps)).toBe(2);
    expect(scrubberKeyTime("ArrowLeft", false, 0, 8, steps)).toBe(0);
  });

  it("moves one frame without steps, one second with Shift, and Home/End to the ends", () => {
    expect(scrubberKeyTime("ArrowRight", false, 1, 10, [])).toBeCloseTo(1 + 1 / 30);
    expect(scrubberKeyTime("ArrowLeft", false, 0, 10, [])).toBe(0);
    expect(scrubberKeyTime("ArrowRight", true, 3, 8, steps)).toBe(4);
    expect(scrubberKeyTime("ArrowRight", true, 9.5, 10, [])).toBe(10);
    expect(scrubberKeyTime("Home", false, 5, 10, [])).toBe(0);
    expect(scrubberKeyTime("End", false, 5, 10, [])).toBe(10);
    expect(scrubberKeyTime("Enter", false, 5, 10, [])).toBeNull();
  });
});
