import type { CameraPose, ProjectDoc } from "../doc/types";
import { cameraPose } from "./camera";
import type { ShotFrame } from "./evaluate";
import { type LayoutNode, resolveLayout } from "./layouts";

// How far either side of a frame the camera and devices are compared: well under a frame at
// 60 fps, so a move is caught from its first frame to its last.
const REST_PROBE_S = 1 / 240;

const POSE_KEYS: (keyof CameraPose)[] = ["yaw", "pitch", "roll", "distance", "panX", "panY", "fov"];
const TRANSFORM_KEYS: (keyof LayoutNode["transform"])[] = [
  "x",
  "y",
  "z",
  "rx",
  "ry",
  "rz",
  "scale",
];

/**
 * Whether the camera and every device hold still at this frame: the shot's camera pose and each
 * node's transform are exactly the same REST_PROBE_S before and after it (within the shot). The
 * engine snaps a browser's URL text to whole output pixels only then (quality bar §3.2): text
 * that moves is never snapped, so it never steps against its pill.
 */
export function holdsStill(doc: ProjectDoc, frame: ShotFrame): boolean {
  const shot = doc.shots.find((s) => s.id === frame.shotId);
  if (!shot) return false;
  const duration = shot.duration;
  const progress = (localT: number) =>
    duration > 0 ? Math.max(0, Math.min(1, localT / duration)) : 0;
  const layout = (localT: number) =>
    resolveLayout(shot.layout, doc.aspect, doc.assets, localT, duration);

  const pose = cameraPose(shot.camera, doc.aspect, progress(frame.localT));
  const nodes = layout(frame.localT);
  const neighbours = [
    Math.max(0, frame.localT - REST_PROBE_S),
    Math.min(duration, frame.localT + REST_PROBE_S),
  ];
  for (const localT of neighbours) {
    const other = cameraPose(shot.camera, doc.aspect, progress(localT));
    if (POSE_KEYS.some((key) => other[key] !== pose[key])) return false;
    const around = new Map(layout(localT).map((node) => [node.id, node.transform]));
    for (const node of nodes) {
      const transform = around.get(node.id);
      if (!transform || TRANSFORM_KEYS.some((key) => transform[key] !== node.transform[key])) {
        return false;
      }
    }
  }
  return true;
}
