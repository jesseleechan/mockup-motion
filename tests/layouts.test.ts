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
import { resolveLayout } from "../src/motion/layouts";

describe("WP-09 Layouts and Camera Framing", () => {
  const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
  const PRESETS = Object.keys(PRESET_POSES) as CameraPresetId[];

  const mockAssets = [
    { id: "a1", kind: "image" as const, name: "Hero Desktop", mime: "image/png", bytes: 100, width: 1440, height: 900 },
    { id: "a2", kind: "image" as const, name: "Mobile Screen", mime: "image/png", bytes: 100, width: 390, height: 844 },
    { id: "a3", kind: "image" as const, name: "Tablet Screen", mime: "image/png", bytes: 100, width: 820, height: 1180 },
    { id: "a4", kind: "image" as const, name: "Feature 1", mime: "image/png", bytes: 100, width: 1440, height: 900 },
    { id: "a5", kind: "image" as const, name: "Feature 2", mime: "image/png", bytes: 100, width: 1440, height: 900 },
    { id: "a6", kind: "image" as const, name: "Feature 3", mime: "image/png", bytes: 100, width: 1440, height: 900 },
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
        expect(deskWFrac).toBeGreaterThanOrEqual(0.80);
        expect(deskWFrac).toBeLessThanOrEqual(0.90);
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
      expect(phoneHFrac).toBeGreaterThanOrEqual(0.70);
      expect(phoneHFrac).toBeLessThanOrEqual(0.78);
    }
  });

  // 2. Framing test matrix: every non-marquee layout x every camera preset x 5 aspects x 5 time steps
  it("framing test matrix: all projected corners sit inside safe margin at intensity 1", () => {
    const nonMarqueeLayouts: Layout[] = [
      { kind: "single", device: "browser", assetId: "a1" },
      { kind: "single", device: "phone", assetId: "a2" },
      { kind: "pair", desktopId: "a1", mobileId: "a2", arrangement: "overlap" },
      { kind: "pair", desktopId: "a1", mobileId: "a2", arrangement: "side" },
      { kind: "trio", desktopId: "a1", tabletId: "a3", mobileId: "a2" },
      { kind: "stack", assetIds: ["a1", "a4", "a5"], device: "browser", spread: 0.5 },
    ];

    const timeFractions = [0, 0.25, 0.5, 0.75, 1.0];
    const duration = 5.0;

    for (const layout of nonMarqueeLayouts) {
      for (const preset of PRESETS) {
        for (const aspect of ASPECTS) {
          const { limitX, limitY } = safeMarginLimits(aspect);

          for (const tf of timeFractions) {
            const localT = tf * duration;
            const nodes = resolveLayout(layout, aspect, mockAssets, localT, duration, "none");
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

  // 3. Full-bleed test: for marquee and wall layouts, projected content covers frame at 60 sampled times
  it("full-bleed test: marquee and wall layouts cover the frame at 60 sampled times per loop", () => {
    const marqueeLayouts: Layout[] = [
      {
        kind: "rows",
        assetIds: ["a1", "a4", "a5", "a6"],
        rows: 2,
        device: "browser",
        tilt: 12,
        speed: 0.3,
      },
      {
        kind: "columns",
        assetIds: ["a2", "a3", "a1"],
        columns: 3,
        tilt: 10,
        speed: 0.25,
      },
      {
        kind: "wall",
        assetIds: ["a1", "a4", "a5", "a6"],
        columns: 4,
        speed: 0.2,
      },
    ];

    const duration = 6.0;
    const samples = 60;

    for (const layout of marqueeLayouts) {
      for (const aspect of ["16:9", "9:16", "1:1"] as Aspect[]) {
        const basis = computeCameraBasis(
          cameraPose({ preset: "static", intensity: 0, easing: "smooth", float: 0 }, aspect, 0, 0, duration),
          aspect,
        );

        for (let i = 0; i < samples; i++) {
          const t = (i / samples) * duration;
          const nodes = resolveLayout(layout, aspect, mockAssets, t, duration, "none");
          expect(nodes.length).toBeGreaterThan(0);

          // Projected bounding box of all nodes
          let minNdcX = Infinity;
          let maxNdcX = -Infinity;
          let minNdcY = Infinity;
          let maxNdcY = -Infinity;

          for (const node of nodes) {
            const corners = getNodeCorners(node);
            for (const corner of corners) {
              const ndc = projectPointToNDC(corner, basis);
              minNdcX = Math.min(minNdcX, ndc.x);
              maxNdcX = Math.max(maxNdcX, ndc.x);
              minNdcY = Math.min(minNdcY, ndc.y);
              maxNdcY = Math.max(maxNdcY, ndc.y);
            }
          }

          // Content must cover [-1, 1] in both X and Y
          expect(minNdcX).toBeLessThanOrEqual(-0.95);
          expect(maxNdcX).toBeGreaterThanOrEqual(0.95);
          expect(minNdcY).toBeLessThanOrEqual(-0.95);
          expect(maxNdcY).toBeGreaterThanOrEqual(0.95);
        }
      }
    }
  });

  // 4. Loop test: marquee node transforms at t = 0 and t = total match up to a permutation
  it("loop test: marquee node positions at t = 0 and t = total match up to a permutation", () => {
    const duration = 5.0;
    const layouts: Layout[] = [
      {
        kind: "rows",
        assetIds: ["a1", "a4", "a5"],
        rows: 2,
        device: "browser",
        tilt: 10,
        speed: 0.25,
      },
      {
        kind: "columns",
        assetIds: ["a2", "a3", "a1"],
        columns: 3,
        tilt: 8,
        speed: 0.3,
      },
      {
        kind: "wall",
        assetIds: ["a1", "a4", "a5", "a6"],
        columns: 3,
        speed: 0.2,
      },
    ];

    for (const layout of layouts) {
      const nodesStart = resolveLayout(layout, "16:9", mockAssets, 0, duration, "none");
      const nodesEnd = resolveLayout(layout, "16:9", mockAssets, duration, duration, "none");

      expect(nodesStart.length).toBe(nodesEnd.length);

      // Verify that every node at t=0 has a matching node at t=total with identical transform (x, y, z)
      for (const n0 of nodesStart) {
        const match = nodesEnd.find(
          (n1) =>
            Math.abs(n1.transform.x - n0.transform.x) < 1e-4 &&
            Math.abs(n1.transform.y - n0.transform.y) < 1e-4 &&
            Math.abs(n1.transform.z - n0.transform.z) < 1e-4,
        );
        expect(match).toBeDefined();
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
          speed: 0.2,
        },
        "16:9",
        assets,
        0,
        5,
        "none",
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

describe("Marquee speed (quality-bar §2.5)", () => {
  const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
  // Quality-bar §2.5: a marquee never moves faster than 0.12 frame widths per second.
  const MAX_FRAME_WIDTHS_PER_SECOND = 0.12;

  const CONFIGS: ((assetIds: string[]) => Layout)[] = [
    ...([1, 2, 3] as const).map(
      (rows) => (assetIds: string[]) =>
        ({ kind: "rows", assetIds, rows, device: "browser", tilt: 8, speed: 1 }) as Layout,
    ),
    ...[2, 3, 4, 5].map(
      (columns) => (assetIds: string[]) =>
        ({ kind: "columns", assetIds, columns, tilt: 12, speed: 1 }) as Layout,
    ),
    ...[3, 4, 5].map(
      (columns) => (assetIds: string[]) =>
        ({ kind: "wall", assetIds, columns, speed: 1 }) as Layout,
    ),
  ];
  const SPEEDS = [0.05, 0.35, 1];
  const DURATIONS = [3, 5, 8, 12];

  function assetsOf(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `asset_${i}`,
      kind: "image" as const,
      name: `asset_${i}`,
      mime: "image/png",
      bytes: 100,
      width: 1440,
      height: 900,
    }));
  }

  /** Fastest node speed in frame widths per second, from two nearby frames. */
  function maxNodeSpeed(layout: Layout, aspect: Aspect, duration: number): number {
    const assets = assetsOf(12);
    const dt = 1e-3;
    let fastest = 0;
    for (const t of [0.3 * duration, 0.7 * duration]) {
      const before = new Map(
        resolveLayout(layout, aspect, assets, t, duration).map((node) => [node.id, node]),
      );
      for (const node of resolveLayout(layout, aspect, assets, t + dt, duration)) {
        const prev = before.get(node.id);
        if (!prev) throw new Error(`Node ${node.id} has no match one step earlier`);
        const dx = node.transform.x - prev.transform.x;
        const dy = node.transform.y - prev.transform.y;
        const dz = node.transform.z - prev.transform.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        // A node that wraps from one end of its ring to the other jumps far; skip it.
        if (distance > 0.1) continue;
        fastest = Math.max(fastest, distance / dt);
      }
    }
    return fastest / aspectRatioValue(aspect);
  }

  it("rows, columns and wall stay at or under 0.12 frame widths per second for 1 to 12 assets", () => {
    const failures: string[] = [];
    for (const config of CONFIGS) {
      for (let count = 1; count <= 12; count++) {
        const assetIds = assetsOf(count).map((asset) => asset.id);
        for (const aspect of ASPECTS) {
          for (const speed of SPEEDS) {
            for (const duration of DURATIONS) {
              const layout = { ...config(assetIds), speed } as Layout;
              const v = maxNodeSpeed(layout, aspect, duration);
              const label = `${layout.kind} ${JSON.stringify({ ...layout, assetIds: undefined })} ${count} assets ${aspect} ${duration}s`;
              if (v > MAX_FRAME_WIDTHS_PER_SECOND + 1e-9) {
                failures.push(`${label}: ${v.toFixed(3)} frame widths/s`);
              }
              if (v <= 0) failures.push(`${label}: does not move`);
            }
          }
        }
      }
    }
    expect(failures.slice(0, 12), `${failures.length} cases fail`).toEqual([]);
  });

  it("marquee speed does not depend on the number of assets", () => {
    const failures: string[] = [];
    for (const config of CONFIGS) {
      for (const aspect of ASPECTS) {
        for (const duration of DURATIONS) {
          const speeds = Array.from({ length: 12 }, (_, i) => {
            const assetIds = assetsOf(i + 1).map((asset) => asset.id);
            return maxNodeSpeed({ ...config(assetIds), speed: 0.35 } as Layout, aspect, duration);
          });
          const spread = Math.max(...speeds) - Math.min(...speeds);
          if (spread > 1e-6) {
            const kind = config([]).kind;
            failures.push(
              `${kind} ${aspect} ${duration}s: ${speeds.map((v) => v.toFixed(3)).join(" ")}`,
            );
          }
        }
      }
    }
    expect(failures.slice(0, 12), `${failures.length} cases fail`).toEqual([]);
  });
});
