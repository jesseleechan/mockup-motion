import { describe, expect, it, vi } from "vitest";
import { createDoc, defaultShot } from "../src/doc/defaults";
import type {
  Aspect,
  CameraPose,
  CameraPresetId,
  EasingId,
  ScrollSpec,
  TextLayer,
} from "../src/doc/types";
import {
  PRESET_POSES,
  activeLayers,
  aspectRatioValue,
  cameraPose,
  clearLayoutCache,
  ease,
  evaluate,
  hash2,
  minDurationFor,
  mulberry32,
  resolveLayout,
  schedule,
  scrollPosition,
  textFrame,
} from "../src/motion";

function assertDeepCloseTo(a: unknown, b: unknown, epsilon = 1e-5, path = ""): void {
  if (typeof a === "number" && typeof b === "number") {
    if (Math.abs(a - b) > epsilon) {
      throw new Error(
        `Assertion failed at ${path}: expected ${a} to be close to ${b} (diff: ${Math.abs(
          a - b,
        )}, epsilon: ${epsilon})`,
      );
    }
    return;
  }
  if (a === b) return;
  if (a == null || b == null) {
    expect(a).toBe(b);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      assertDeepCloseTo(a[i], b[i], epsilon, `${path}[${i}]`);
    }
    return;
  }
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a as Record<string, unknown>).sort();
    const keysB = Object.keys(b as Record<string, unknown>).sort();
    expect(keysA).toEqual(keysB);
    for (const key of keysA) {
      assertDeepCloseTo(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        epsilon,
        `${path}.${key}`,
      );
    }
    return;
  }
  expect(a).toBe(b);
}

describe("Easing (src/motion/easing.ts)", () => {
  const ALL_EASINGS: EasingId[] = [
    "linear",
    "gentle",
    "smooth",
    "expoOut",
    "quintInOut",
    "backOut",
    "spring",
  ];

  it("satisfies ease(0) = 0 and ease(1) = 1 for all curves", () => {
    for (const id of ALL_EASINGS) {
      expect(ease(id, 0)).toBe(0);
      expect(ease(id, 1)).toBe(1);
      expect(ease(id, -0.2)).toBe(0);
      expect(ease(id, 1.2)).toBe(1);
    }
  });

  it("is monotonic on [0, 1] for all curves except backOut and spring", () => {
    const monotonicCurves: EasingId[] = ["linear", "gentle", "smooth", "expoOut", "quintInOut"];

    for (const id of monotonicCurves) {
      let prev = 0;
      for (let i = 1; i <= 100; i++) {
        const p = i / 100;
        const val = ease(id, p);
        expect(val).toBeGreaterThanOrEqual(prev);
        prev = val;
      }
    }
  });

  it("overshoot of backOut and spring is at most 3%", () => {
    for (const id of ["backOut", "spring"] as const) {
      let maxVal = 0;
      for (let i = 0; i <= 200; i++) {
        const p = i / 200;
        const val = ease(id, p);
        if (val > maxVal) {
          maxVal = val;
        }
      }
      expect(maxVal).toBeGreaterThan(1.0);
      const overshoot = maxVal - 1.0;
      expect(overshoot).toBeLessThanOrEqual(0.0305);
    }
  });
});

describe("RNG (src/motion/rng.ts)", () => {
  it("mulberry32 is deterministic with the same seed", () => {
    const rng1 = mulberry32(12345);
    const rng2 = mulberry32(12345);

    for (let i = 0; i < 50; i++) {
      const v1 = rng1();
      const v2 = rng2();
      expect(v1).toBe(v2);
      expect(v1).toBeGreaterThanOrEqual(0);
      expect(v1).toBeLessThan(1);
    }
  });

  it("hash2 produces consistent 32-bit unsigned hashes", () => {
    const h1 = hash2(42, 99);
    const h2 = hash2(42, 99);
    expect(h1).toBe(h2);
    expect(h1).toBeGreaterThanOrEqual(0);
    expect(h1).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("Camera (src/motion/camera.ts)", () => {
  const ALL_PRESETS: CameraPresetId[] = [
    "static",
    "pushIn",
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

  it("PRESET_POSES exports all 12 camera presets", () => {
    for (const preset of ALL_PRESETS) {
      expect(PRESET_POSES[preset]).toBeDefined();
      expect(PRESET_POSES[preset].from).toBeDefined();
      expect(PRESET_POSES[preset].to).toBeDefined();
      expect(PRESET_POSES[preset].from.fov).toBe(22);
      expect(PRESET_POSES[preset].to.fov).toBe(22);
    }
  });

  it("aspectRatioValue returns exact ratios", () => {
    expect(aspectRatioValue("16:9")).toBeCloseTo(16 / 9);
    expect(aspectRatioValue("9:16")).toBeCloseTo(9 / 16);
    expect(aspectRatioValue("1:1")).toBe(1.0);
    expect(aspectRatioValue("4:5")).toBe(0.8);
    expect(aspectRatioValue("4:3")).toBeCloseTo(4 / 3);
  });

  it("no yo-yo property test: every camera preset is monotonic at intensity 1, float 0", () => {
    const numericKeys: (keyof CameraPose)[] = ["yaw", "pitch", "distance", "panX", "panY", "roll"];

    for (const preset of ALL_PRESETS) {
      for (const key of numericKeys) {
        let prevDelta: number | null = null;
        let isMonotonic = true;

        for (let i = 0; i <= 20; i++) {
          const p = i / 20;
          const pose = cameraPose(
            { preset, intensity: 1.0, easing: "smooth", float: 0 },
            "16:9",
            p,
            p * 5,
            5,
          );

          if (i > 0) {
            const prevPose = cameraPose(
              { preset, intensity: 1.0, easing: "smooth", float: 0 },
              "16:9",
              (i - 1) / 20,
              ((i - 1) / 20) * 5,
              5,
            );
            const delta = pose[key] - prevPose[key];
            if (Math.abs(delta) > 1e-9) {
              if (prevDelta !== null) {
                if ((delta > 0 && prevDelta < 0) || (delta < 0 && prevDelta > 0)) {
                  isMonotonic = false;
                }
              }
              prevDelta = delta;
            }
          }
        }

        expect(isMonotonic, `Preset ${preset} key ${key} should be monotonic`).toBe(true);
      }
    }
  });

  it("intensity scales delta around midpoint pose", () => {
    const moveFull = {
      preset: "pushIn" as const,
      intensity: 1.0,
      easing: "linear" as const,
      float: 0,
    };
    const moveHalf = {
      preset: "pushIn" as const,
      intensity: 0.5,
      easing: "linear" as const,
      float: 0,
    };
    const moveZero = {
      preset: "pushIn" as const,
      intensity: 0,
      easing: "linear" as const,
      float: 0,
    };

    const pose0 = cameraPose(moveFull, "16:9", 0, 0, 5);
    const pose1 = cameraPose(moveFull, "16:9", 1, 5, 5);
    const midDistance = (pose0.distance + pose1.distance) / 2;

    const poseMidZero = cameraPose(moveZero, "16:9", 0, 0, 5);
    expect(poseMidZero.distance).toBeCloseTo(midDistance);

    const poseHalf0 = cameraPose(moveHalf, "16:9", 0, 0, 5);
    expect(Math.abs(poseHalf0.distance - midDistance)).toBeCloseTo(
      Math.abs(pose0.distance - midDistance) * 0.5,
    );
  });

  it("float adds ambient sway and returns to 0 at shot ends", () => {
    const moveFloat = {
      preset: "static" as const,
      intensity: 0,
      easing: "smooth" as const,
      float: 1.0,
    };
    const poseStart = cameraPose(moveFloat, "16:9", 0, 0, 5);
    const poseEnd = cameraPose(moveFloat, "16:9", 1, 5, 5);
    const poseMid = cameraPose(moveFloat, "16:9", 0.25, 1.25, 5);

    expect(poseStart.yaw).toBeCloseTo(0);
    expect(poseEnd.yaw).toBeCloseTo(0);
    expect(poseMid.yaw).toBeGreaterThan(0);
  });
});

describe("Timeline (src/motion/timeline.ts)", () => {
  it("schedule matches contracts.md §5 for cut, fade, and mixed sequences with/without loop", () => {
    const doc = createDoc();
    doc.loop = false;
    doc.shots = [
      {
        ...defaultShot(),
        id: "s0",
        duration: 4,
        transitionIn: { kind: "cut", duration: 0, easing: "quintInOut" },
      },
      {
        ...defaultShot(),
        id: "s1",
        duration: 5,
        transitionIn: { kind: "cut", duration: 0, easing: "quintInOut" },
      },
    ];

    // Cut sequence without loop
    const sched1 = schedule(doc);
    expect(sched1.shots[0].start).toBe(0);
    expect(sched1.shots[0].end).toBe(4);
    expect(sched1.shots[1].start).toBe(4);
    expect(sched1.shots[1].end).toBe(9);
    expect(sched1.total).toBe(9);

    // Fade sequence without loop
    doc.shots[1].transitionIn = { kind: "fade", duration: 0.8, easing: "quintInOut" };
    const sched2 = schedule(doc);
    expect(sched2.shots[1].start).toBe(3.2);
    expect(sched2.shots[1].end).toBe(8.2);
    expect(sched2.total).toBe(8.2);

    // With loop: d0 wraps
    doc.loop = true;
    doc.shots[0].transitionIn = { kind: "fade", duration: 0.8, easing: "quintInOut" };
    const sched3 = schedule(doc);
    expect(sched3.total).toBeCloseTo(8.2 - 0.8);
  });

  it("activeLayers handles empty doc, negative t, single shot, transition blends, and wrap", () => {
    const emptyDoc = { ...createDoc(), shots: [] };
    expect(activeLayers(emptyDoc, 0).layers).toEqual([]);

    const doc = createDoc();
    doc.shots = [
      {
        ...defaultShot(),
        id: "s0",
        duration: 4,
        transitionIn: { kind: "fade", duration: 0.8, easing: "quintInOut" },
      },
      {
        ...defaultShot(),
        id: "s1",
        duration: 4,
        transitionIn: { kind: "fade", duration: 0.8, easing: "quintInOut" },
      },
    ];
    doc.loop = true;
    const { total } = schedule(doc);

    // t = 0
    const a0 = activeLayers(doc, 0);
    expect(a0.layers.length).toBe(1);
    expect(a0.layers[0].index).toBe(0);
    expect(a0.layers[0].localT).toBe(0);
    expect(a0.layers[0].weight).toBe(1.0);

    // during transition between s0 and s1 (s1 starts at 4 - 0.8 = 3.2)
    const aTrans = activeLayers(doc, 3.6);
    expect(aTrans.layers.length).toBe(2);
    expect(aTrans.layers[0].index).toBe(0);
    expect(aTrans.layers[1].index).toBe(1);
    expect(aTrans.transition?.kind).toBe("fade");

    // during loop wrap (total = 4 + 4 - 0.8 - 0.8 = 6.4, wrap is [6.4 - 0.8, 6.4) = [5.6, 6.4))
    const aWrap = activeLayers(doc, 6.0);
    expect(aWrap.layers.length).toBe(2);
    expect(aWrap.layers[0].index).toBe(1);
    expect(aWrap.layers[1].index).toBe(0);
    expect(aWrap.layers[1].localT).toBe(0); // clamped to 0
    expect(aWrap.transition?.kind).toBe("fade");

    // schedule on empty doc
    expect(schedule({ ...createDoc(), shots: [] }).shots).toEqual([]);

    // activeLayers when total <= 0
    const zeroDoc = createDoc();
    zeroDoc.shots[0].duration = 0;
    const aZero = activeLayers(zeroDoc, 0);
    expect(aZero.layers[0].localT).toBe(0);

    // activeLayers when t == total in loop
    const aTotal = activeLayers(doc, total);
    expect(aTotal.layers[0].localT).toBe(0);
  });
});

describe("Scroll (src/motion/scroll.ts)", () => {
  it("handles empty or disabled specs", () => {
    expect(
      scrollPosition({ enabled: false, stops: [0, 1], hold: 0.8, easing: "smooth" }, 1, 5, 2),
    ).toBe(0);
    expect(minDurationFor({ enabled: false, stops: [0, 1], hold: 0.8, easing: "smooth" }, 2)).toBe(
      0,
    );
    expect(scrollPosition({ enabled: true, stops: [], hold: 0.8, easing: "smooth" }, 1, 5, 2)).toBe(
      0,
    );
    expect(minDurationFor({ enabled: true, stops: [], hold: 0.8, easing: "smooth" }, 2)).toBe(0);
    expect(
      scrollPosition({ enabled: true, stops: [0.5], hold: 0.8, easing: "smooth" }, 1, 5, 2),
    ).toBe(0.5);
    expect(minDurationFor({ enabled: true, stops: [0.5], hold: 0.8, easing: "smooth" }, 2)).toBe(
      0.8,
    );
    expect(
      scrollPosition({ enabled: true, stops: [0, 0], hold: 0.8, easing: "smooth" }, 1, 5, 2),
    ).toBe(0);
  });

  it("stays within 0..1 and holds at stops", () => {
    const spec: ScrollSpec = {
      enabled: true,
      stops: [0, 0.5, 1],
      hold: 0.8,
      easing: "smooth",
    };
    const frames = 2.0;
    const dur = 6.0;

    // Hold at stop 0: [0, 0.8]
    expect(scrollPosition(spec, 0, dur, frames)).toBe(0);
    expect(scrollPosition(spec, 0.4, dur, frames)).toBe(0);
    expect(scrollPosition(spec, 0.79, dur, frames)).toBe(0);

    // After movement 1: reaches 0.5 and holds
    const minDur = minDurationFor(spec, frames);
    expect(minDur).toBeGreaterThan(0);

    // At shot end
    expect(scrollPosition(spec, dur, dur, frames)).toBe(1);
    expect(scrollPosition(spec, dur + 2, dur, frames)).toBe(1);
  });

  it("never exceeds the speed limit (0.9 viewport heights per sec) and minDurationFor is consistent", () => {
    const spec: ScrollSpec = {
      enabled: true,
      stops: [0, 1],
      hold: 1.0,
      easing: "linear",
    };
    const frames = 1.8;
    const minDur = minDurationFor(spec, frames);
    // minDur = 2 * 1.0 + (1.8 / 0.9) = 2.0 + 2.0 = 4.0 s
    expect(minDur).toBeCloseTo(4.0);

    // With shotDuration = minDur, speed across the move segment must be exactly 0.9
    const posAtMoveStart = scrollPosition(spec, 1.0, minDur, frames);
    const posAtMoveEnd = scrollPosition(spec, 3.0, minDur, frames);
    expect(posAtMoveStart).toBe(0);
    expect(posAtMoveEnd).toBe(1);

    const speed = ((posAtMoveEnd - posAtMoveStart) * frames) / 2.0;
    expect(speed).toBeCloseTo(0.9);
  });
});

describe("Text Animation (src/motion/text-anim.ts)", () => {
  it("handles empty words, delays, and all animations", () => {
    const baseLayer: TextLayer = {
      id: "txt-1",
      text: "Design in motion",
      role: "title",
      font: "display",
      size: 6,
      anchor: "center",
      align: "center",
      color: "",
      animation: "none",
      delay: 0.5,
    };

    // Before delay
    const fBefore = textFrame(baseLayer, 3, 0.2);
    expect(fBefore.opacity).toBe(0);

    // Empty wordCount
    const fEmpty = textFrame(baseLayer, 0, 1.0);
    expect(fEmpty.words.length).toBe(0);
    expect(fEmpty.opacity).toBe(1);

    // fadeUp
    const fFade = textFrame({ ...baseLayer, animation: "fadeUp" }, 3, 1.0);
    expect(fFade.opacity).toBeGreaterThan(0);
    expect(fFade.words.length).toBe(3);

    // maskReveal
    const fMask = textFrame({ ...baseLayer, animation: "maskReveal" }, 3, 1.0);
    expect(fMask.words[0].clip).toBeLessThan(1);

    // blurIn
    const fBlur = textFrame({ ...baseLayer, animation: "blurIn" }, 3, 1.0);
    expect(fBlur.words[0].blur).toBeLessThan(12);

    // wordStagger
    const fStagger = textFrame({ ...baseLayer, animation: "wordStagger" }, 3, 1.0);
    expect(fStagger.words.length).toBe(3);

    // typewriter
    const fType = textFrame({ ...baseLayer, animation: "typewriter" }, 3, 0.8);
    expect(fType.words.length).toBe(3);
  });
});

describe("Layouts (src/motion/layouts.ts)", () => {
  it("resolves single layout with screen aspect and entrance handling", () => {
    const doc = createDoc();
    const nodes = resolveLayout(doc.shots[0].layout, "16:9", doc.assets, 0.4, 5, "rise");
    expect(nodes.length).toBe(1);
    expect(nodes[0].device).toBe("browser");
    expect(nodes[0].opacity).toBeGreaterThan(0);
    expect(nodes[0].transform.y).toBeLessThan(0); // rising

    // Phone aspect
    const phoneNodes = resolveLayout(
      { kind: "single", device: "phone", assetId: "" },
      "9:16",
      [],
      0,
      5,
      "none",
    );
    expect(phoneNodes[0].screenAspect).toBeCloseTo(0.4615);
  });

  it('supports layout.kind === "title" and resolves pair layout', () => {
    expect(resolveLayout({ kind: "title" }, "16:9", [], 0, 5)).toEqual([]);
    const pairNodes = resolveLayout(
      { kind: "pair", desktopId: "d1", mobileId: "m1", arrangement: "overlap" },
      "16:9",
      [{ id: "d1", kind: "image", name: "d1", mime: "image/png", bytes: 100 }],
      0,
      5,
    );
    expect(pairNodes).toHaveLength(2);
    expect(pairNodes[0].device).toBe("browser");
    expect(pairNodes[1].device).toBe("phone");
  });
});

describe("Evaluate & Loop Seams (src/motion/evaluate.ts)", () => {
  it("loop seams: evaluate(doc, 0) deep-equals evaluate(doc, total) within 1e-5 for all 4 required scenarios", () => {
    // 1. Single static
    const docStatic = createDoc();
    docStatic.loop = true;
    docStatic.shots[0].camera = { preset: "static", intensity: 0, easing: "smooth", float: 0 };
    const schedStatic = schedule(docStatic);
    assertDeepCloseTo(evaluate(docStatic, 0), evaluate(docStatic, schedStatic.total));

    // 2. Single pushIn + loop (uses wrap crossfade)
    const docPushIn = createDoc();
    docPushIn.loop = true;
    docPushIn.shots[0].camera = { preset: "pushIn", intensity: 1, easing: "smooth", float: 0 };
    docPushIn.shots[0].transitionIn = { kind: "fade", duration: 0.8, easing: "quintInOut" };
    const schedPush = schedule(docPushIn);
    assertDeepCloseTo(evaluate(docPushIn, 0), evaluate(docPushIn, schedPush.total));

    // 3. Single orbitLeft + loop + float
    const docOrbit = createDoc();
    docOrbit.loop = true;
    docOrbit.shots[0].camera = { preset: "orbitLeft", intensity: 1, easing: "smooth", float: 0.5 };
    docOrbit.shots[0].transitionIn = { kind: "fade", duration: 0.8, easing: "quintInOut" };
    const schedOrbit = schedule(docOrbit);
    assertDeepCloseTo(evaluate(docOrbit, 0), evaluate(docOrbit, schedOrbit.total));

    // 4. 3-shot loop with fade/push transitions
    const doc3Shot = createDoc();
    doc3Shot.loop = true;
    doc3Shot.shots = [
      {
        ...defaultShot(),
        id: "shot-0",
        duration: 4,
        transitionIn: { kind: "fade", duration: 0.8, easing: "quintInOut" },
        camera: { preset: "pushIn", intensity: 1, easing: "smooth", float: 0 },
      },
      {
        ...defaultShot(),
        id: "shot-1",
        duration: 4,
        transitionIn: { kind: "push", duration: 0.7, easing: "quintInOut", direction: "left" },
        camera: { preset: "orbitRight", intensity: 0.8, easing: "smooth", float: 0 },
      },
      {
        ...defaultShot(),
        id: "shot-2",
        duration: 4,
        transitionIn: { kind: "fade", duration: 0.8, easing: "quintInOut" },
        camera: { preset: "tiltUp", intensity: 0.6, easing: "smooth", float: 0 },
      },
    ];
    const sched3Shot = schedule(doc3Shot);
    assertDeepCloseTo(evaluate(doc3Shot, 0), evaluate(doc3Shot, sched3Shot.total));
  });

  it("entrances: shot 0 enters from opacity 0 unless the doc loops", () => {
    const doc = createDoc();
    doc.loop = false;
    doc.shots[0].entrance = "rise";
    const start = evaluate(doc, 0).layers[0].frame.nodes[0];
    const settled = evaluate(doc, 1).layers[0].frame.nodes[0];
    expect(start.opacity).toBe(0);
    expect(start.transform.y).toBeCloseTo(-0.03, 6); // quality-bar §2.5: a 3% rise
    expect(settled.opacity).toBe(1);
    expect(settled.transform.y).toBeCloseTo(0, 9);

    // frame(0) is also the frame a loop wraps into, so a looping shot 0 starts settled.
    for (const transitionIn of [
      { kind: "cut" as const, duration: 0, easing: "smooth" as const },
      { kind: "fade" as const, duration: 0.8, easing: "quintInOut" as const },
    ]) {
      const looping = structuredClone(doc);
      looping.loop = true;
      looping.shots[0].transitionIn = transitionIn;
      const { total } = schedule(looping);
      expect(evaluate(looping, 0).layers[0].frame.nodes[0].opacity).toBe(1);
      for (const layer of evaluate(looping, total - 0.1).layers) {
        expect(layer.frame.nodes[0].opacity, transitionIn.kind).toBe(1);
      }
    }

    // Later shots of a loop keep their entrance.
    const reel = structuredClone(doc);
    reel.loop = true;
    reel.shots.push({ ...defaultShot(), id: "shot-1", entrance: "rise" });
    const shot1Start = schedule(reel).shots[1].start;
    const shot1 = evaluate(reel, shot1Start).layers.at(-1)!.frame;
    expect(shot1.shotId).toBe("shot-1");
    expect(shot1.nodes[0].opacity).toBe(0);
  });

  it("determinism: 1,000 random docs (seeded) evaluate identically twice", () => {
    const rng = mulberry32(987654);

    const aspects: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
    const presets: CameraPresetId[] = ["static", "pushIn", "pullBack", "orbitLeft", "tiltUp"];
    const easings: EasingId[] = ["smooth", "gentle", "expoOut", "quintInOut"];

    for (let i = 0; i < 1000; i++) {
      const doc = createDoc();
      doc.aspect = aspects[Math.floor(rng() * aspects.length)];
      doc.loop = rng() > 0.5;
      const duration = 2 + rng() * 5;
      doc.shots[0].duration = duration;
      doc.shots[0].camera = {
        preset: presets[Math.floor(rng() * presets.length)],
        intensity: rng(),
        easing: easings[Math.floor(rng() * easings.length)],
        float: rng() * 0.5,
      };

      const t = rng() * duration;
      const frameA = evaluate(doc, t);
      const frameB = evaluate(doc, t);

      expect(frameA).toEqual(frameB);
    }
  });

  it("performance: evaluate on a 3-shot doc with 30 nodes takes under 0.3 ms on average", async () => {
    clearLayoutCache();
    const doc = createDoc();
    doc.shots = [
      { ...defaultShot(), id: "perf-s0", duration: 4 },
      { ...defaultShot(), id: "perf-s1", duration: 4 },
      { ...defaultShot(), id: "perf-s2", duration: 4 },
    ];

    // Simulate 10 nodes per shot (30 nodes total)
    const mockNodes = Array.from({ length: 10 }, (_, i) => ({
      id: `perf-node-${i}`,
      device: "browser" as const,
      assetId: null,
      width: 0.8,
      height: 0.5,
      screenAspect: 1.6,
      transform: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
      opacity: 1,
      scroll: 0,
      depthOrder: i,
    }));

    const spy = vi
      .spyOn(await import("../src/motion/layouts"), "resolveLayout")
      .mockReturnValue(mockNodes);

    // Warm-up
    for (let i = 0; i < 50; i++) {
      evaluate(doc, (i / 50) * 10);
    }

    const iterations = 5000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      evaluate(doc, (i / iterations) * 10);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    spy.mockRestore();
    clearLayoutCache();

    console.log(`Average evaluate time for 30 nodes: ${avgMs.toFixed(4)} ms`);
    expect(avgMs).toBeLessThan(0.3);
  });
});
