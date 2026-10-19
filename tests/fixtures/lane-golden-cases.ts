import type { Aspect, AssetRef, Layout, Shot } from "../../src/doc/types";
import { framesDuration, type LayoutNode, resolveLayout } from "../../src/motion/layouts";
import { framesLayout } from "../../src/templates/frames";

// The cases of the lane goldens (PF02). `record-lane-goldens.ts` writes their nodes to
// `lane-goldens.json` before the period mode moves into `src/motion/layouts/lanes.ts`, and
// `tests/lane-goldens.test.ts` compares today's nodes with that file exactly.

export const GOLDEN_ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];

const desktop = (n: number): AssetRef => ({
  id: `d${n}`,
  kind: "image",
  name: `Desktop ${n}`,
  mime: "image/png",
  bytes: 100,
  width: 1440,
  height: 900,
  role: "desktop",
});

export interface GoldenCase {
  name: string;
  aspect: Aspect;
  layout: Layout;
  assets: AssetRef[];
  duration: number;
  entrance: Shot["entrance"];
  times: number[];
}

// The template's Frames loop: at least 15 s (src/templates/frames.ts).
const FRAMES_MIN_LOOP = 15;

/** Desktop Frames (the `frames` template's rows layout) for N = 4, 5, 6 at every aspect. */
function framesCases(): GoldenCase[] {
  const cases: GoldenCase[] = [];
  for (const aspect of GOLDEN_ASPECTS) {
    for (const count of [4, 5, 6]) {
      const assets = Array.from({ length: count }, (_, i) => desktop(i + 1));
      const layout = framesLayout(
        aspect,
        assets.map((a) => a.id),
      );
      const duration = Math.max(FRAMES_MIN_LOOP, framesDuration(layout, aspect));
      cases.push({
        name: `frames ${aspect} N=${count}`,
        aspect,
        layout,
        assets,
        duration,
        entrance: "none",
        times: [0, 0.8, 2.4, duration / 2, duration - 0.1, duration],
      });
    }
  }
  return cases;
}

export function goldenCases(): Record<"frames", GoldenCase[]> {
  return {
    frames: framesCases(),
  };
}

export function goldenNodes(c: GoldenCase, t: number): LayoutNode[] {
  return resolveLayout(c.layout, c.aspect, c.assets, t, c.duration, c.entrance);
}

// A frame's nodes in a compact form that keeps every value exact. Fields with one value for every
// node are stored once (`shared`); the others as one row per node (`keys`, `rows`). JSON writes
// -0 as 0, so a negative zero is kept as the string "-0": the comparison includes the sign of zero.
type Cell = string | number | null;

const FIELDS = [
  "id",
  "device",
  "assetId",
  "width",
  "height",
  "screenAspect",
  "x",
  "y",
  "z",
  "rx",
  "ry",
  "rz",
  "scale",
  "opacity",
  "scroll",
  "depthOrder",
] as const;
type Field = (typeof FIELDS)[number];

export interface GoldenFrame {
  t: number;
  shared: Partial<Record<Field, Cell>>;
  keys: Field[];
  rows: Cell[][];
}

const toCell = (v: string | number | null): Cell => (Object.is(v, -0) ? "-0" : v);
const fromCell = (field: Field, v: Cell): string | number | null =>
  v === "-0" && field !== "id" && field !== "assetId" ? -0 : v;

function flatten(n: LayoutNode): Record<Field, Cell> {
  const flat = { ...n, ...n.transform } as Record<Field, string | number | null>;
  return Object.fromEntries(FIELDS.map((f) => [f, toCell(flat[f])])) as Record<Field, Cell>;
}

export function encodeFrame(t: number, nodes: LayoutNode[]): GoldenFrame {
  const flat = nodes.map(flatten);
  const isShared = (f: Field) => flat.length > 0 && flat.every((r) => r[f] === flat[0][f]);
  const keys = FIELDS.filter((f) => !isShared(f));
  const shared = Object.fromEntries(FIELDS.filter(isShared).map((f) => [f, flat[0][f]]));
  return { t, shared, keys, rows: flat.map((r) => keys.map((k) => r[k])) };
}

export function decodeFrame(frame: GoldenFrame): LayoutNode[] {
  return frame.rows.map((row) => {
    const v: Record<string, string | number | null> = {};
    for (const [f, c] of Object.entries(frame.shared)) v[f] = fromCell(f as Field, c);
    frame.keys.forEach((f, i) => (v[f] = fromCell(f, row[i])));
    return {
      id: v.id as string,
      device: v.device as LayoutNode["device"],
      assetId: v.assetId as string | null,
      width: v.width as number,
      height: v.height as number,
      screenAspect: v.screenAspect as number,
      transform: {
        x: v.x as number,
        y: v.y as number,
        z: v.z as number,
        rx: v.rx as number,
        ry: v.ry as number,
        rz: v.rz as number,
        scale: v.scale as number,
      },
      opacity: v.opacity as number,
      scroll: v.scroll as number,
      depthOrder: v.depthOrder as number,
    };
  });
}

export type GoldenGroup = keyof ReturnType<typeof goldenCases>;

export type GoldenFile = Record<
  GoldenGroup,
  { name: string; duration: number; frames: GoldenFrame[] }[]
>;
