import { describe, expect, it } from "vitest";
import { createDoc, defaultShot } from "../src/doc/defaults";
import { schedule, evaluate } from "../src/motion";
import { createEditorStore } from "../src/state/store";
import type { Transition } from "../src/doc/types";

describe("WP-14: Storyboard Timeline & Transitions", () => {
  it("displayed total duration always equals schedule(doc).total across various shot durations and transitions", () => {
    const doc = createDoc();
    doc.shots = [
      defaultShot({ kind: "single", device: "browser", assetId: "" }),
      defaultShot({ kind: "pair", desktopId: "d1", mobileId: "m1", arrangement: "overlap" }),
      defaultShot({ kind: "title" }),
    ];
    doc.shots[0].duration = 3.5;
    doc.shots[1].duration = 4.2;
    doc.shots[2].duration = 2.8;

    // Shot 1 -> Shot 2: fade transition of 0.7s
    doc.shots[1].transitionIn = {
      kind: "fade",
      duration: 0.7,
      easing: "quintInOut",
    };
    // Shot 2 -> Shot 3: wipe transition of 0.5s
    doc.shots[2].transitionIn = {
      kind: "wipe",
      duration: 0.5,
      easing: "quintInOut",
    };

    const sched = schedule(doc);
    // Overlaps:
    // Shot 0: [0, 3.5]
    // Shot 1: [3.5 - 0.7 = 2.8, 2.8 + 4.2 = 7.0]
    // Shot 2: [7.0 - 0.5 = 6.5, 6.5 + 2.8 = 9.3]
    // Total = 9.3
    expect(sched.total).toBeCloseTo(9.3, 4);
    expect(sched.shots.length).toBe(3);
    expect(sched.shots[0].start).toBeCloseTo(0, 4);
    expect(sched.shots[0].end).toBeCloseTo(3.5, 4);
    expect(sched.shots[1].start).toBeCloseTo(2.8, 4);
    expect(sched.shots[1].end).toBeCloseTo(7.0, 4);
    expect(sched.shots[2].start).toBeCloseTo(6.5, 4);
    expect(sched.shots[2].end).toBeCloseTo(9.3, 4);
  });

  it("splitShot preserves duration sum and maintains camera continuity at the split point", () => {
    const store = createEditorStore();
    const doc = createDoc();
    const shot = defaultShot({ kind: "single", device: "browser", assetId: "" });
    shot.duration = 6.0;
    shot.camera = {
      preset: "pushIn",
      intensity: 0.8,
      easing: "linear",
      float: 0,
    };
    doc.shots = [shot];
    store.getState().loadDoc(doc);

    // Evaluate camera pose before split at splitLocalT = 2.4s
    const preDoc = store.getState().doc;
    const splitT = 2.4;
    const preFrame = evaluate(preDoc, splitT);
    const preCamera = preFrame.layers[0].frame.camera;

    // Split shot at 2.4s
    store.getState().splitShot(0, splitT);

    const postDoc = store.getState().doc;
    expect(postDoc.shots.length).toBe(2);

    const shotA = postDoc.shots[0];
    const shotB = postDoc.shots[1];

    // 1. Duration sum check
    expect(shotA.duration + shotB.duration).toBeCloseTo(6.0, 4);
    expect(shotA.duration).toBeCloseTo(2.4, 4);
    expect(shotB.duration).toBeCloseTo(3.6, 4);

    // 2. Camera continuity check:
    // Evaluate the document after split at the exact split time t=2.4
    const postFrame = evaluate(postDoc, splitT);
    const postCamera = postFrame.layers[0].frame.camera;

    expect(postCamera.distance).toBeCloseTo(preCamera.distance, 3);
    expect(postCamera.yaw).toBeCloseTo(preCamera.yaw, 3);
    expect(postCamera.pitch).toBeCloseTo(preCamera.pitch, 3);
  });

  it("multi-shot loop seam test passes for every transition kind (fade, blur, push, zoom, wipe)", () => {
    const transitionKinds: Transition["kind"][] = ["fade", "blur", "push", "zoom", "wipe"];

    for (const kind of transitionKinds) {
      const doc = createDoc();
      doc.loop = true;
      doc.shots = [
        defaultShot({ kind: "single", device: "browser", assetId: "" }),
        defaultShot({ kind: "single", device: "phone", assetId: "" }),
      ];
      doc.shots[0].duration = 4.0;
      doc.shots[1].duration = 4.0;

      // Transition between Shot 0 and Shot 1
      doc.shots[1].transitionIn = {
        kind,
        duration: 0.8,
        easing: "quintInOut",
      };

      // Loop wrap transition into Shot 0
      doc.shots[0].transitionIn = {
        kind,
        duration: 0.8,
        easing: "quintInOut",
      };

      const sched = schedule(doc);
      expect(sched.total).toBeGreaterThan(0);

      // Evaluate at t = 0 and t = total
      const frameStart = evaluate(doc, 0);
      const frameEnd = evaluate(doc, sched.total);

      // Both should have active layers
      expect(frameStart.layers.length).toBeGreaterThan(0);
      expect(frameEnd.layers.length).toBeGreaterThan(0);

      // In a looped document, t = total wraps to t = 0, so backgroundPhase and layers match
      expect(frameEnd.backgroundPhase).toBeCloseTo(frameStart.backgroundPhase, 4);

      // Camera pose continuity across seam
      const startCam = frameStart.layers[0].frame.camera;
      const endCam = frameEnd.layers[0].frame.camera;
      expect(startCam.fov).toBeCloseTo(endCam.fov, 1);
      expect(startCam.distance).toBeCloseTo(endCam.distance, 3);
      expect(startCam.yaw).toBeCloseTo(endCam.yaw, 3);
      expect(startCam.pitch).toBeCloseTo(endCam.pitch, 3);
    }
  });
});
