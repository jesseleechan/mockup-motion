import { describe, expect, it } from "vitest";
import type { Aspect, CameraMove, Layout } from "../src/doc/types";
import { cameraPose } from "../src/motion/camera";
import {
  computeCameraBasis,
  getNodeCorners,
  projectPointToNDC,
  type Point3D,
} from "../src/motion/framing";
import { resolveLayout, type LayoutNode } from "../src/motion/layouts";
import { WALL_GAP_FRACTION } from "../src/motion/layouts/wall";

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
const WALL: Extract<Layout, { kind: "wall" }> = {
  kind: "wall",
  assetIds: ["a1", "a2", "a3", "a4"],
  columns: 4,
  speed: 0.3,
};
const DURATION = 8;
// The isometric-wall template's camera.
const ISO_DRIFT: CameraMove = { preset: "isoDrift", intensity: 0.5, easing: "smooth", float: 0 };
const STATIC: CameraMove = { preset: "static", intensity: 0, easing: "smooth", float: 0 };

function sub(a: Point3D, b: Point3D): Point3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function dot(a: Point3D, b: Point3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function cross(a: Point3D, b: Point3D): Point3D {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function unit(a: Point3D): Point3D {
  const length = Math.sqrt(dot(a, a));
  return { x: a.x / length, y: a.y / length, z: a.z / length };
}
function center(node: LayoutNode): Point3D {
  return { x: node.transform.x, y: node.transform.y, z: node.transform.z };
}

describe("F11 isometric wall", () => {
  it("every card corner lies on one plane tipped well away from the frame plane", () => {
    for (const aspect of ASPECTS) {
      for (const t of [0, 2.5, 5.5]) {
        const nodes = resolveLayout(WALL, aspect, [], t, DURATION);
        const [c0, c1, , c3] = getNodeCorners(nodes[0]);
        const normal = unit(cross(sub(c1, c0), sub(c3, c0)));
        let worst = 0;
        for (const node of nodes) {
          for (const corner of getNodeCorners(node)) {
            worst = Math.max(worst, Math.abs(dot(sub(corner, c0), normal)));
          }
        }
        expect(worst, `${aspect} t=${t}: distance of the farthest corner from the plane`).toBeLessThan(
          1e-9,
        );
        // A plane facing the camera would be a flat grid, not a wall seen from above.
        const tiltDeg = (Math.acos(Math.abs(normal.z)) * 180) / Math.PI;
        expect(tiltDeg, `${aspect}: plane tilt`).toBeGreaterThan(30);
      }
    }
  });

  it("neighbouring cards are 4-6% of the card width apart along the plane", () => {
    for (const aspect of ASPECTS) {
      const nodes = resolveLayout(WALL, aspect, [], 1.3, DURATION);
      const byId = new Map(nodes.map((node) => [node.id, node]));
      const [c0, c1, , c3] = getNodeCorners(nodes[0]);
      const across = unit(sub(c1, c0)); // card width direction, along the plane's x
      const along = unit(sub(c3, c0)); // card height direction, along a column
      const width = nodes[0].width;
      const height = nodes[0].height;
      let checked = 0;
      for (const node of nodes) {
        const match = /^wall:c(-?\d+):item(\d+)$/.exec(node.id);
        if (!match) throw new Error(`Unexpected wall node id ${node.id}`);
        const col = Number(match[1]);
        const item = Number(match[2]);
        const next = byId.get(`wall:c${col}:item${item + 1}`);
        if (next) {
          const step = Math.abs(dot(sub(center(next), center(node)), along));
          // Skip the one pair per column that straddles the ring wrap.
          if (step < height * 2) {
            const gap = (step - height) / width;
            expect(gap).toBeGreaterThanOrEqual(0.04);
            expect(gap).toBeLessThanOrEqual(0.06);
            checked++;
          }
        }
        const right = byId.get(`wall:c${col + 1}:item${item}`);
        if (right) {
          const gap = (Math.abs(dot(sub(center(right), center(node)), across)) - width) / width;
          expect(gap).toBeCloseTo(WALL_GAP_FRACTION, 9);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(50);
    }
  });

  it("cards (with their gaps) cover every point of the frame under static and isoDrift", () => {
    const samples = 9;
    for (const aspect of ASPECTS) {
      for (const move of [STATIC, ISO_DRIFT]) {
        for (let i = 0; i < 12; i++) {
          const p = i / 11;
          const t = p * DURATION;
          const basis = computeCameraBasis(cameraPose(move, aspect, p, t, DURATION), aspect);
          const quads = resolveLayout(WALL, aspect, [], t, DURATION).map((node) => {
            const gap = node.width * WALL_GAP_FRACTION;
            const cell = { ...node, width: node.width + gap, height: node.height + gap };
            return getNodeCorners(cell).map((corner) => projectPointToNDC(corner, basis));
          });
          for (let sy = 0; sy < samples; sy++) {
            for (let sx = 0; sx < samples; sx++) {
              const x = -0.99 + (1.98 * sx) / (samples - 1);
              const y = -0.99 + (1.98 * sy) / (samples - 1);
              const covered = quads.some((quad) => {
                let sign = 0;
                for (let k = 0; k < 4; k++) {
                  const a = quad[k];
                  const b = quad[(k + 1) % 4];
                  const side = Math.sign((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x));
                  if (side === 0) continue;
                  if (sign === 0) sign = side;
                  else if (side !== sign) return false;
                }
                return true;
              });
              expect(covered, `${aspect} ${move.preset} t=${t.toFixed(2)} (${x}, ${y})`).toBe(true);
            }
          }
        }
      }
    }
  });
});

describe("F11 isometric wall asset spacing", () => {
  it("cards side by side in neighbouring columns never show the same screenshot", () => {
    for (const assetIds of [
      ["a1", "a2", "a3"],
      ["a1", "a2", "a3", "a4"],
      ["a1", "a2", "a3", "a4", "a5"],
    ]) {
      const layout: Layout = { ...WALL, assetIds };
      const nodes = resolveLayout(layout, "16:9", [], 2.1, DURATION);
      const [c0, , , c3] = getNodeCorners(nodes[0]);
      const along = unit(sub(c3, c0));
      const height = nodes[0].height;
      const column = (node: LayoutNode) => Number(/^wall:c(-?\d+):/.exec(node.id)?.[1]);
      let pairs = 0;
      for (const a of nodes) {
        for (const b of nodes) {
          if (column(b) !== column(a) + 1) continue;
          // Overlapping rows: closer than one card along the column direction.
          if (Math.abs(dot(sub(center(b), center(a)), along)) >= height) continue;
          expect(b.assetId, `${a.id} beside ${b.id} (${assetIds.length} assets)`).not.toBe(
            a.assetId,
          );
          pairs++;
        }
      }
      expect(pairs).toBeGreaterThan(20);
    }
  });
});
