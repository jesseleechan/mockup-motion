import type { Aspect, CameraMove, CameraPose, CameraPresetId } from "../doc/types";
import { ease } from "./easing";

export function aspectRatioValue(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 16 / 9;
    case "9:16":
      return 9 / 16;
    case "1:1":
      return 1.0;
    case "4:5":
      return 4 / 5;
    case "4:3":
      return 4 / 3;
  }
}

export const PRESET_POSES: Record<CameraPresetId, { from: CameraPose; to: CameraPose }> = {
  static: {
    from: { yaw: 0, pitch: 0, roll: 0, distance: 1.0, panX: 0, panY: 0, fov: 22 },
    to: { yaw: 0, pitch: 0, roll: 0, distance: 1.0, panX: 0, panY: 0, fov: 22 },
  },
  pushIn: {
    from: { yaw: 0, pitch: 0, roll: 0, distance: 1.1, panX: 0, panY: 0, fov: 22 },
    to: { yaw: 0, pitch: 0, roll: 0, distance: 0.98, panX: 0, panY: 0, fov: 22 },
  },
};

type NumericPoseKey = "yaw" | "pitch" | "roll" | "distance" | "panX" | "panY";
const POSE_KEYS: NumericPoseKey[] = ["yaw", "pitch", "roll", "distance", "panX", "panY"];

export function cameraPose(
  move: CameraMove,
  aspect: Aspect,
  p: number,
  shotT: number,
  shotDuration: number,
): CameraPose {
  const base = PRESET_POSES[move.preset] ?? PRESET_POSES.static;
  const [pStart, pEnd] = move.progressRange ?? [0, 1];
  const clampedP = Math.max(0, Math.min(1, p));
  const effectiveP = pStart + clampedP * (pEnd - pStart);
  const easedP = ease(move.easing, effectiveP);
  const intensity = Math.max(0, Math.min(1, move.intensity));

  const result: CameraPose = {
    yaw: 0,
    pitch: 0,
    roll: 0,
    distance: 1.0,
    panX: 0,
    panY: 0,
    fov: 22,
  };

  for (const key of POSE_KEYS) {
    const fromVal = base.from[key];
    const toVal = base.to[key];
    const mid = (fromVal + toVal) * 0.5;
    const delta = toVal - fromVal;
    // intensity scales delta around midpoint pose
    result[key] = mid + delta * intensity * (easedP - 0.5);
  }

  // Float: ambient sway layered on top (at most 1.2 deg yaw, 0.8 deg pitch, 0.4% distance)
  const floatVal = Math.max(0, Math.min(1, move.float ?? 0));
  if (floatVal > 0 && shotDuration > 0) {
    const phase = (shotT / shotDuration) * 2 * Math.PI;
    const sway = Math.sin(phase) * floatVal;
    result.yaw += sway * 1.2;
    result.pitch += sway * 0.8;
    result.distance += sway * 0.004;
  }

  return result;
}
