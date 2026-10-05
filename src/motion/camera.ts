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
  pullBack: {
    from: { yaw: 0, pitch: 0, roll: 0, distance: 0.92, panX: 0, panY: 0, fov: 22 },
    to: { yaw: 0, pitch: 0, roll: 0, distance: 1.06, panX: 0, panY: 0, fov: 22 },
  },
  orbitLeft: {
    from: { yaw: 14, pitch: 6, roll: 0, distance: 1.05, panX: 0, panY: 0, fov: 22 },
    to: { yaw: -4, pitch: 6, roll: 0, distance: 1.05, panX: 0, panY: 0, fov: 22 },
  },
  orbitRight: {
    from: { yaw: -14, pitch: 6, roll: 0, distance: 1.05, panX: 0, panY: 0, fov: 22 },
    to: { yaw: 4, pitch: 6, roll: 0, distance: 1.05, panX: 0, panY: 0, fov: 22 },
  },
  tiltUp: {
    from: { yaw: 0, pitch: 14, roll: 0, distance: 1.04, panX: 0, panY: 0, fov: 22 },
    to: { yaw: 0, pitch: 4, roll: 0, distance: 1.04, panX: 0, panY: 0, fov: 22 },
  },
  tiltDown: {
    from: { yaw: 0, pitch: 4, roll: 0, distance: 1.04, panX: 0, panY: 0, fov: 22 },
    to: { yaw: 0, pitch: 14, roll: 0, distance: 1.04, panX: 0, panY: 0, fov: 22 },
  },
  riseUp: {
    from: { yaw: 0, pitch: 8, roll: 0, distance: 1.0, panX: 0, panY: -0.06, fov: 22 },
    to: { yaw: 0, pitch: 3, roll: 0, distance: 1.0, panX: 0, panY: 0.02, fov: 22 },
  },
  dollyLeft: {
    from: { yaw: 6, pitch: 0, roll: 0, distance: 1.0, panX: 0.08, panY: 0, fov: 22 },
    to: { yaw: 6, pitch: 0, roll: 0, distance: 1.0, panX: -0.08, panY: 0, fov: 22 },
  },
  dollyRight: {
    from: { yaw: -6, pitch: 0, roll: 0, distance: 1.0, panX: -0.08, panY: 0, fov: 22 },
    to: { yaw: -6, pitch: 0, roll: 0, distance: 1.0, panX: 0.08, panY: 0, fov: 22 },
  },
  isoDrift: {
    from: { yaw: 34, pitch: 28, roll: 0, distance: 1.0, panX: -0.025, panY: -0.025, fov: 22 },
    to: { yaw: 34, pitch: 28, roll: 0, distance: 1.0, panX: 0.025, panY: 0.025, fov: 22 },
  },
  heroTilt: {
    from: { yaw: -20, pitch: 10, roll: -2, distance: 1.08, panX: 0, panY: 0, fov: 22 },
    to: { yaw: -10, pitch: 6, roll: 0, distance: 1.0, panX: 0, panY: 0, fov: 22 },
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
  const clampedP = Math.max(0, Math.min(1, p));
  const easedP = ease(move.easing, clampedP);
  const intensity = Math.max(0, Math.min(1, move.intensity));

  // Base aspect scaling for dolly
  const isDolly = move.preset === "dollyLeft" || move.preset === "dollyRight";
  const aspectScale = isDolly ? aspectRatioValue(aspect) / (16 / 9) : 1.0;

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
    let fromVal = base.from[key];
    let toVal = base.to[key];
    if (key === "panX" && isDolly) {
      fromVal *= aspectScale;
      toVal *= aspectScale;
    }
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
