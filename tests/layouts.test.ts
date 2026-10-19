import { describe, expect, it } from "vitest";
import type { Aspect, CameraPresetId, Layout } from "../src/doc/types";
import { PRESET_POSES, aspectRatioValue, cameraPose } from "../src/motion/camera";
import {
  computeCameraBasis,
  frameDistance,
  getNodeCorners,
  projectPointToNDC,
  safeMarginLimits,
} from "../src/motion/framing";
import { type LayoutNode, resolveLayout, sliderDuration } from "../src/motion/layouts";

describe("WP-09 Layouts and Camera Framing", () => {
  const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
  const PRESETS = Object.keys(PRESET_POSES) as CameraPresetId[];

  const mockAssets = [
    {
      id: "a1",
      kind: "image" as const,
      name: "Hero Desktop",
      mime: "image/png",
      bytes: 100,
      width: 1440,
      height: 900,
    },
    {
      id: "a2",
      kind: "image" as const,
      name: "Mobile Screen",
      mime: "image/png",
      bytes: 100,
      width: 390,
      height: 844,
    },
    {
      id: "a3",
      kind: "image" as const,
      name: "Tablet Screen",
      mime: "image/png",
      bytes: 100,
      width: 820,
      height: 1180,
    },
    {
      id: "a4",
      kind: "image" as const,
      name: "Feature 1",
      mime: "image/png",
      bytes: 100,
      width: 1440,
      height: 900,
    },
    {
      id: "a5",
      kind: "image" as const,
      name: "Feature 2",
      mime: "image/png",
      bytes: 100,
      width: 1440,
      height: 900,
    },
    {
      id: "a6",
      kind: "image" as const,
      name: "Feature 3",
      mime: "image/png",
      bytes: 100,
      width: 1440,
      height: 900,
    },
  ];

  // 1. Size test: single device and phone size ranges hold at all aspects (Quality-bar §4)
  it("size test: single desktop and phone size ranges hold at all 5 aspects", () => {
    for (const aspect of ASPECTS) {
      const W = aspectRatioValue(aspect);

      // Desktop browser
      const deskNodes = resolveLayout(
        { kind: "single", device: "browser", assetId: "a1" },
        aspect,
        mockAssets,
        0,
        5,
      );
      expect(deskNodes).toHaveLength(1);
      const deskWFrac = deskNodes[0].width / W;

      if (aspect === "16:9" || aspect === "4:3") {
        // 62-74% of frame width
        expect(deskWFrac).toBeGreaterThanOrEqual(0.62);
        expect(deskWFrac).toBeLessThanOrEqual(0.74);
      } else {
        // 84-90% at 9:16, 4:5, 1:1
        expect(deskWFrac).toBeGreaterThanOrEqual(0.8);
        expect(deskWFrac).toBeLessThanOrEqual(0.9);
      }

      // Single phone: 70-78% of frame height
      const phoneNodes = resolveLayout(
        { kind: "single", device: "phone", assetId: "a2" },
        aspect,
        mockAssets,
        0,
        5,
      );
      expect(phoneNodes).toHaveLength(1);
      const phoneHFrac = phoneNodes[0].height; // Stage height is 1.0
      expect(phoneHFrac).toBeGreaterThanOrEqual(0.7);
      expect(phoneHFrac).toBeLessThanOrEqual(0.78);
    }
  });

  // 2. Framing test matrix: every bounded layout x every camera preset x 5 aspects x 5 time steps
  it("framing test matrix: all projected corners sit inside safe margin at intensity 1", () => {
    const boundedLayouts: Layout[] = [
      { kind: "single", device: "browser", assetId: "a1" },
      { kind: "single", device: "phone", assetId: "a2" },
    ];

    const timeFractions = [0, 0.25, 0.5, 0.75, 1.0];
    const duration = 5.0;

    for (const layout of boundedLayouts) {
      for (const preset of PRESETS) {
        for (const aspect of ASPECTS) {
          const { limitX, limitY } = safeMarginLimits(aspect);

          for (const tf of timeFractions) {
            const localT = tf * duration;
            const nodes = resolveLayout(layout, aspect, mockAssets, localT, duration);
            const p = tf;
            const basePose = cameraPose(
              { preset, intensity: 1.0, easing: "smooth", float: 0 },
              aspect,
              p,
              localT,
              duration,
            );

            const mult = frameDistance(nodes, aspect, basePose);
            const framedPose = {
              ...basePose,
              distance: basePose.distance * mult,
            };

            const basis = computeCameraBasis(framedPose, aspect);

            for (const node of nodes) {
              const corners = getNodeCorners(node);
              for (const corner of corners) {
                const ndc = projectPointToNDC(corner, basis);
                // Allow a tiny numerical tolerance (1e-3)
                expect(Math.abs(ndc.x)).toBeLessThanOrEqual(limitX + 1e-3);
                expect(Math.abs(ndc.y)).toBeLessThanOrEqual(limitY + 1e-3);
              }
            }
          }
        }
      }
    }
  });

  // 5. Repetition test: no asset id repeats within visible window for 3-12 assets
  it("repetition test: no asset id repeats within visible window for 3 to 12 assets", () => {
    const W = aspectRatioValue("16:9");

    for (let numAssets = 3; numAssets <= 12; numAssets++) {
      const assetIds = Array.from({ length: numAssets }, (_, i) => `asset_${i}`);
      const assets = assetIds.map((id) => ({
        id,
        kind: "image" as const,
        name: id,
        mime: "image/png",
        bytes: 100,
        width: 1440,
        height: 900,
      }));

      const nodes = resolveLayout(
        {
          kind: "rows",
          assetIds,
          rows: 2,
          device: "browser",
          tilt: 0,
          travel: "period",
        },
        "16:9",
        assets,
        0,
        5,
      );

      // In each row, collect visible items (|x| <= W/2 + itemWidth)
      for (let r = 0; r < 2; r++) {
        const rowNodes = nodes
          .filter((n) => n.id.startsWith(`row${r}:`))
          .sort((a, b) => a.transform.x - b.transform.x);

        const visibleRowNodes = rowNodes.filter(
          (n) => Math.abs(n.transform.x) <= W / 2 + n.width / 2,
        );

        const visibleAssetIds = visibleRowNodes.map((n) => n.assetId);

        // Check if any asset repeats within visible window
        const seen = new Set<string>();
        for (const id of visibleAssetIds) {
          if (id) {
            expect(seen.has(id)).toBe(false);
            seen.add(id);
          }
        }
      }
    }
  });
});

describe("Slider layout (presets P01, quality bar §2.2 and §4)", () => {
  const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
  const AXES = [
    { axis: "x", shape: "mobile" },
    { axis: "y", shape: "desktop" },
  ] as const;
  const STEP = 2;

  const asset = (id: string, width: number, height: number) => ({
    id,
    kind: "image" as const,
    name: id,
    mime: "image/png",
    bytes: 100,
    width,
    height,
  });
  const assets = [1, 2, 3, 4, 5, 6].flatMap((i) => [
    asset(`m${i}`, 390, 844),
    asset(`d${i}`, 1440, 900),
  ]);
  type SliderLayout = Extract<Layout, { kind: "slider" }>;
  const slider = (
    axis: "x" | "y",
    shape: "mobile" | "desktop",
    n: number,
    step = STEP,
  ): SliderLayout => ({
    kind: "slider",
    assetIds: Array.from({ length: n }, (_, i) => `${shape === "mobile" ? "m" : "d"}${i + 1}`),
    axis,
    shape,
    step,
  });
  const nodesAt = (layout: SliderLayout, aspect: Aspect, t: number) =>
    resolveLayout(layout, aspect, assets, t, sliderDuration(layout));
  // Position along the direction of travel: cards move towards negative values.
  const along = (axis: "x" | "y", n: LayoutNode) => (axis === "x" ? n.transform.x : -n.transform.y);
  const inFrame = (aspect: Aspect, n: LayoutNode) => {
    const halfW = aspectRatioValue(aspect) / 2;
    const w = (n.width * n.transform.scale) / 2;
    const h = (n.height * n.transform.scale) / 2;
    return Math.abs(n.transform.x) - w < halfW && Math.abs(n.transform.y) - h < 0.5;
  };
  const times = (total: number, rate = 120) =>
    Array.from({ length: Math.round(total * rate) + 1 }, (_, i) => i / rate);
  const spacingOf = (axis: "x" | "y", nodes: LayoutNode[]) =>
    Math.min(...nodes.map((node) => Math.abs(along(axis, node))).filter((d) => d > 1e-9));

  it("rests with the active card centred at full size and its neighbours at 0.75 and 0.65", () => {
    for (const { axis, shape } of AXES) {
      for (const aspect of ASPECTS) {
        for (const n of [3, 4, 6]) {
          const layout = slider(axis, shape, n);
          for (let k = 0; k <= n; k++) {
            const label = `${axis} ${aspect} N=${n} k=${k}`;
            const nodes = nodesAt(layout, aspect, k * STEP);
            const active = nodes.filter((node) => Math.abs(along(axis, node)) < 1e-9);
            expect(active, label).toHaveLength(1);
            expect(active[0].assetId, label).toBe(layout.assetIds[k % n]);
            expect(active[0].transform, label).toMatchObject({ x: 0, y: 0, scale: 1 });
            expect(active[0].opacity, label).toBe(1);
            const spacing = spacingOf(axis, nodes);
            for (const side of [-1, 1]) {
              const neighbour = nodes.find(
                (node) => Math.abs(along(axis, node) - side * spacing) < 1e-9,
              );
              expect(neighbour, `${label} side ${side}`).toBeDefined();
              expect(neighbour!.transform.scale, label).toBeCloseTo(0.75, 9);
              expect(neighbour!.opacity, label).toBeCloseTo(0.65, 9);
            }
          }
        }
      }
    }
  });

  it("matches the reference card size and spacing at 4:5 within 3%", () => {
    // docs/presets-plan/reference.md, in stage units
    const reference = {
      x: { width: 0.288, height: 0.629, spacing: 0.38 },
      y: { width: 0.67, height: 0.415, spacing: 0.478 },
    };
    for (const { axis, shape } of AXES) {
      const nodes = nodesAt(slider(axis, shape, 4), "4:5", 0);
      const active = nodes.find((node) => node.transform.scale === 1)!;
      const ref = reference[axis];
      expect(Math.abs(active.width / ref.width - 1), `${axis} width`).toBeLessThan(0.03);
      expect(Math.abs(active.height / ref.height - 1), `${axis} height`).toBeLessThan(0.03);
      expect(Math.abs(spacingOf(axis, nodes) / ref.spacing - 1), `${axis} spacing`).toBeLessThan(
        0.03,
      );
    }
  });

  it("loops natively: t = 0 and t = N × step give the same cards", () => {
    const signature = (nodes: LayoutNode[]) =>
      nodes
        .map((n) =>
          [
            n.assetId,
            ...Object.values(n.transform).map((v) => v.toFixed(9)),
            n.opacity.toFixed(9),
          ].join("|"),
        )
        .sort();
    for (const { axis, shape } of AXES) {
      for (const aspect of ASPECTS) {
        for (let n = 1; n <= 6; n++) {
          for (const step of [1.6, 2, 3.3]) {
            const layout = slider(axis, shape, n, step);
            expect(
              signature(nodesAt(layout, aspect, n * step)),
              `${axis} ${aspect} N=${n} step=${step}`,
            ).toEqual(signature(nodesAt(layout, aspect, 0)));
          }
        }
      }
    }
  });

  it("keeps node ids, devices and sizes fixed over time (device pool keys)", () => {
    for (const { axis, shape } of AXES) {
      for (const aspect of ASPECTS) {
        for (const n of [1, 3, 6]) {
          const layout = slider(axis, shape, n);
          const keys = (t: number) =>
            nodesAt(layout, aspect, t)
              .map((node) => `${node.id}|${node.device}|${node.width}|${node.height}`)
              .sort();
          const atStart = keys(0);
          for (const t of [0.3, 0.9, 1.7, STEP + 0.5, n * STEP - 0.1]) {
            expect(keys(t), `${axis} ${aspect} N=${n} t=${t}`).toEqual(atStart);
          }
        }
      }
    }
  });

  it("never reverses: every visible card moves only left (x) or up (y) over a loop", () => {
    const failures: string[] = [];
    for (const { axis, shape } of AXES) {
      for (const aspect of ASPECTS) {
        for (const n of [3, 4, 6]) {
          const layout = slider(axis, shape, n);
          let previous = new Map(nodesAt(layout, aspect, 0).map((node) => [node.id, node]));
          for (const t of times(n * STEP).slice(1)) {
            const current = new Map(nodesAt(layout, aspect, t).map((node) => [node.id, node]));
            for (const [id, node] of current) {
              const before = previous.get(id)!;
              const moved = along(axis, node) - along(axis, before);
              // A card wraps to the far end of the ring only while it is outside the frame.
              const wrapped = !inFrame(aspect, node) && !inFrame(aspect, before);
              if (moved > 1e-12 && !wrapped) {
                failures.push(`${axis} ${aspect} N=${n} ${id} t=${t.toFixed(3)}`);
              }
            }
            previous = current;
          }
        }
      }
    }
    expect(failures.slice(0, 10), `${failures.length} reversals`).toEqual([]);
  });

  it("never shows a screenshot twice in view, for 3 to 6 screenshots", () => {
    const failures: string[] = [];
    for (const { axis, shape } of AXES) {
      for (const aspect of ASPECTS) {
        for (let n = 3; n <= 6; n++) {
          const layout = slider(axis, shape, n);
          for (const t of times(n * STEP)) {
            const seen = nodesAt(layout, aspect, t)
              .filter((node) => node.opacity > 0.01 && inFrame(aspect, node))
              .map((node) => node.assetId);
            if (new Set(seen).size !== seen.length) {
              failures.push(`${axis} ${aspect} N=${n} t=${t.toFixed(3)}: ${seen.join(",")}`);
            }
          }
        }
      }
    }
    expect(failures.slice(0, 10), `${failures.length} repeats`).toEqual([]);
  });

  it("is balanced at rest: as many cards in view before the active card as after it", () => {
    // Presets P05 follow-up: with 4 screenshots at 16:9 and 4:3 the far slot on one side used
    // to stay lit, so the frame was right-heavy (x) or bottom-heavy (y).
    const failures: string[] = [];
    for (const { axis, shape } of AXES) {
      for (const aspect of ASPECTS) {
        for (let n = 3; n <= 6; n++) {
          const layout = slider(axis, shape, n);
          // The start of every step and the end of its hold.
          for (let k = 0; k < n; k++) {
            for (const t of [k * STEP, (k + 1) * STEP - 0.05]) {
              const shown = nodesAt(layout, aspect, t).filter(
                (node) => node.opacity > 0.01 && inFrame(aspect, node),
              );
              const before = shown.filter((node) => along(axis, node) < -1e-9).length;
              const after = shown.filter((node) => along(axis, node) > 1e-9).length;
              if (before !== after) {
                failures.push(`${axis} ${aspect} N=${n} t=${t.toFixed(2)}: ${before} | ${after}`);
              }
            }
          }
        }
      }
    }
    expect(failures.slice(0, 10), `${failures.length} unbalanced frames`).toEqual([]);
  });

  it("keeps 7% of the shortest frame side clear around the active card", () => {
    for (const axis of ["x", "y"] as const) {
      for (const shape of ["mobile", "desktop"] as const) {
        for (const aspect of ASPECTS) {
          const W = aspectRatioValue(aspect);
          const margin = 0.07 * Math.min(W, 1);
          const active = nodesAt(slider(axis, shape, 4), aspect, 0).find(
            (node) => node.transform.scale === 1,
          )!;
          const label = `${axis} ${shape} ${aspect}`;
          expect(active.width / 2, label).toBeLessThanOrEqual(W / 2 - margin);
          expect(active.height / 2, label).toBeLessThanOrEqual(0.5 - margin);
        }
      }
    }
  });

  it("shows one still card for a single screenshot", () => {
    for (const { axis, shape } of AXES) {
      const layout = slider(axis, shape, 1);
      for (const t of [0, 0.7, 1.4, 1.99]) {
        const nodes = nodesAt(layout, "4:5", t);
        expect(nodes).toHaveLength(1);
        expect(nodes[0].transform).toMatchObject({ x: 0, y: 0, scale: 1 });
        expect(nodes[0].opacity).toBe(1);
      }
    }
  });

  it("uses portrait cards at the phone aspect for mobile and the desktop rule otherwise", () => {
    const mobile = nodesAt(slider("x", "mobile", 3), "4:5", 0);
    const desktop = nodesAt(slider("y", "desktop", 3), "4:5", 0);
    expect(mobile.every((node) => node.device === "card" && node.screenAspect === 0.4615)).toBe(
      true,
    );
    expect(desktop.every((node) => node.device === "card" && node.screenAspect === 1.6)).toBe(true);
    for (const node of [...mobile, ...desktop]) {
      expect(node.width / node.height).toBeCloseTo(node.screenAspect, 9);
    }
  });

  it("draws the card nearest the active slot last", () => {
    for (const { axis, shape } of AXES) {
      const nodes = nodesAt(slider(axis, shape, 4), "4:5", 0.8);
      const distances = [...nodes]
        .sort((a, b) => a.depthOrder - b.depthOrder)
        .map((node) => Math.abs(along(axis, node)));
      for (let i = 1; i < distances.length; i++) {
        expect(distances[i]).toBeLessThanOrEqual(distances[i - 1]);
      }
    }
  });

  it("sliderDuration is one step per screenshot, at least one step", () => {
    expect(sliderDuration(slider("x", "mobile", 4))).toBe(8);
    expect(sliderDuration(slider("y", "desktop", 6, 3))).toBe(18);
    expect(sliderDuration({ ...slider("x", "mobile", 1), assetIds: [] })).toBe(2);
  });
});
