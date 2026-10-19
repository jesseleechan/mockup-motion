import { describe, expect, it } from "vitest";
import type { Layout } from "../src/doc/types";
import { timeToX, timelineMarks, xToTime } from "../src/editor/timeline/marks";
import { sliderDuration, steppedAssetIds } from "../src/motion/layouts/duration";
import { BUILTIN_TEMPLATES, buildTemplatePreviewDoc } from "../src/templates";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `a${i}`);

describe("slim timeline marks", () => {
  it("ticks once per screenshot for Slider, Stack and Orbit, a step apart from 0", () => {
    const layouts: Layout[] = [
      { kind: "slider", assetIds: ids(4), axis: "x", shape: "mobile", step: 2.5 },
      {
        kind: "slider",
        assetIds: ids(5),
        axis: "y",
        shape: "desktop",
        step: 2,
        arrangement: "deck",
      },
      { kind: "orbit", assetIds: ids(3), shape: "mobile", step: 3 },
    ];
    for (const layout of layouts) {
      if (layout.kind !== "slider" && layout.kind !== "orbit") throw new Error("not stepped");
      const marks = timelineMarks(layout, sliderDuration(layout));
      expect(marks.steps).toHaveLength(steppedAssetIds(layout).length);
      expect(marks.steps.map((t, k) => t - k * layout.step)).toEqual(marks.steps.map(() => 0));
      expect(marks.loopPoint).toBe(false);
    }
  });

  it("ticks only the screenshots a stepped layout shows", () => {
    // An orbit shows at most 6 screenshots; later ones are left out of the loop.
    const orbit: Layout = { kind: "orbit", assetIds: ids(9), shape: "desktop", step: 3 };
    expect(timelineMarks(orbit, sliderDuration(orbit)).steps).toHaveLength(
      steppedAssetIds(orbit).length,
    );
  });

  it("drops steps that a shorter loop never reaches", () => {
    const slider: Layout = {
      kind: "slider",
      assetIds: ids(4),
      axis: "x",
      shape: "mobile",
      step: 2,
    };
    expect(timelineMarks(slider, 5).steps).toEqual([0, 2, 4]);
  });

  it("marks the loop point for Frames and nothing for a single device", () => {
    const rows: Layout = {
      kind: "rows",
      assetIds: ids(6),
      rows: 2,
      device: "card",
      tilt: 0,
      travel: "period",
    };
    expect(timelineMarks(rows, 20)).toEqual({ steps: [], loopPoint: true });
    const single: Layout = { kind: "single", device: "browser", assetId: "a0" };
    expect(timelineMarks(single, 10)).toEqual({ steps: [], loopPoint: false });
  });

  it("gives every built-in stepped template one tick per screenshot over its loop", () => {
    const stepped = BUILTIN_TEMPLATES.flatMap((template) =>
      buildTemplatePreviewDoc(template).shots.filter(
        (shot) => shot.layout.kind === "slider" || shot.layout.kind === "orbit",
      ),
    );
    expect(stepped.length).toBeGreaterThan(0);
    for (const shot of stepped) {
      if (shot.layout.kind !== "slider" && shot.layout.kind !== "orbit") continue;
      const marks = timelineMarks(shot.layout, shot.duration);
      expect(marks.steps).toHaveLength(steppedAssetIds(shot.layout).length);
      expect(marks.steps.length).toBeGreaterThan(1);
    }
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
