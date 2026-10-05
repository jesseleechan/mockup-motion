import type { Aspect, CameraPose } from "../doc/types";
import { aspectRatioValue } from "./camera";
import type { LayoutNode } from "./layouts/types";

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export function computeFitDistance(fovDegrees: number): number {
  const halfFovRad = (fovDegrees * 0.5 * Math.PI) / 180;
  return 0.5 / Math.tan(halfFovRad);
}

/**
 * Transforms a local point on a node into world/stage space.
 * Rotation order: Euler XYZ (rx, then ry, then rz).
 */
export function transformNodePoint(local: Point3D, node: LayoutNode): Point3D {
  const { scale = 1, rx = 0, ry = 0, rz = 0, x = 0, y = 0, z = 0 } = node.transform;

  // 1. Scale
  const sx = local.x * scale;
  const sy = local.y * scale;
  const sz = local.z * scale;

  // 2. Rotate rx (around X)
  const cosRx = Math.cos(rx);
  const sinRx = Math.sin(rx);
  const x1 = sx;
  const y1 = sy * cosRx - sz * sinRx;
  const z1 = sy * sinRx + sz * cosRx;

  // 3. Rotate ry (around Y)
  const cosRy = Math.cos(ry);
  const sinRy = Math.sin(ry);
  const x2 = x1 * cosRy + z1 * sinRy;
  const y2 = y1;
  const z2 = -x1 * sinRy + z1 * cosRy;

  // 4. Rotate rz (around Z)
  const cosRz = Math.cos(rz);
  const sinRz = Math.sin(rz);
  const x3 = x2 * cosRz - y2 * sinRz;
  const y3 = x2 * sinRz + y2 * cosRz;
  const z3 = z2;

  // 5. Translate
  return {
    x: x3 + x,
    y: y3 + y,
    z: z3 + z,
  };
}

/**
 * Returns the 4 corner points in world coordinates for a layout node.
 */
export function getNodeCorners(node: LayoutNode): Point3D[] {
  const halfW = node.width / 2;
  const halfH = node.height / 2;

  const localCorners: Point3D[] = [
    { x: -halfW, y: -halfH, z: 0 },
    { x: halfW, y: -halfH, z: 0 },
    { x: halfW, y: halfH, z: 0 },
    { x: -halfW, y: halfH, z: 0 },
  ];

  return localCorners.map((pt) => transformNodePoint(pt, node));
}

export interface CameraBasis {
  target: Point3D;
  position: Point3D;
  forward: Point3D;
  right: Point3D;
  up: Point3D;
  halfFovRad: number;
  stageAspect: number;
  radius: number;
}

export function computeCameraBasis(pose: CameraPose, aspect: Aspect): CameraBasis {
  const fov = pose.fov || 22;
  const halfFovRad = (fov * 0.5 * Math.PI) / 180;
  const dFit = 0.5 / Math.tan(halfFovRad);
  const radius = (pose.distance || 1.0) * dFit;
  const stageAspect = aspectRatioValue(aspect);

  const yawRad = (pose.yaw * Math.PI) / 180;
  const pitchRad = (pose.pitch * Math.PI) / 180;
  const rollRad = (pose.roll * Math.PI) / 180;

  const target: Point3D = {
    x: pose.panX || 0,
    y: pose.panY || 0,
    z: 0,
  };

  const horiz = radius * Math.cos(pitchRad);
  const camX = target.x + horiz * Math.sin(yawRad);
  const camY = target.y + radius * Math.sin(pitchRad);
  const camZ = target.z + horiz * Math.cos(yawRad);

  const position: Point3D = { x: camX, y: camY, z: camZ };

  // Forward unit vector pointing from camera to target
  const forward: Point3D = {
    x: -Math.sin(yawRad) * Math.cos(pitchRad),
    y: -Math.sin(pitchRad),
    z: -Math.cos(yawRad) * Math.cos(pitchRad),
  };

  // Base camera right vector (before roll)
  let right: Point3D = {
    x: Math.cos(yawRad),
    y: 0,
    z: -Math.sin(yawRad),
  };

  // Base camera up vector (orthogonal to forward and right)
  let up: Point3D = {
    x: -Math.sin(yawRad) * Math.sin(pitchRad),
    y: Math.cos(pitchRad),
    z: -Math.cos(yawRad) * Math.sin(pitchRad),
  };

  // Apply roll if present (rotation around forward axis by -rollRad)
  if (Math.abs(rollRad) > 1e-6) {
    const cosRoll = Math.cos(-rollRad);
    const sinRoll = Math.sin(-rollRad);

    const rolledRight: Point3D = {
      x: right.x * cosRoll + up.x * sinRoll,
      y: right.y * cosRoll + up.y * sinRoll,
      z: right.z * cosRoll + up.z * sinRoll,
    };
    const rolledUp: Point3D = {
      x: -right.x * sinRoll + up.x * cosRoll,
      y: -right.y * sinRoll + up.y * cosRoll,
      z: -right.z * sinRoll + up.z * cosRoll,
    };
    right = rolledRight;
    up = rolledUp;
  }

  return {
    target,
    position,
    forward,
    right,
    up,
    halfFovRad,
    stageAspect,
    radius,
  };
}

/**
 * Projects a 3D stage point into Normalized Device Coordinates (NDC) in [-1, 1].
 */
export function projectPointToNDC(pt: Point3D, basis: CameraBasis): { x: number; y: number } {
  // Vector from camera position to point
  const vx = pt.x - basis.position.x;
  const vy = pt.y - basis.position.y;
  const vz = pt.z - basis.position.z;

  // Dot products with camera axes
  const x_c = vx * basis.right.x + vy * basis.right.y + vz * basis.right.z;
  const y_c = vx * basis.up.x + vy * basis.up.y + vz * basis.up.z;
  const depth = vx * basis.forward.x + vy * basis.forward.y + vz * basis.forward.z;

  const halfHeight = depth * Math.tan(basis.halfFovRad);
  const halfWidth = halfHeight * basis.stageAspect;

  return {
    x: halfWidth > 0 ? x_c / halfWidth : 0,
    y: halfHeight > 0 ? y_c / halfHeight : 0,
  };
}

/**
 * Calculates safe margin limits in NDC for a given aspect ratio.
 * Quality-bar §4: Safe margin is at least 7% of shortest frame side.
 */
export function safeMarginLimits(aspect: Aspect): { limitX: number; limitY: number } {
  const W = aspectRatioValue(aspect);
  const shortest = Math.min(W, 1.0);
  const marginStage = 0.07 * shortest;

  // Margin in NDC
  const limitX = 1.0 - (2 * marginStage) / W;
  const limitY = 1.0 - (2 * marginStage) / 1.0;

  return {
    limitX: Math.max(0.5, limitX),
    limitY: Math.max(0.5, limitY),
  };
}

/**
 * Computes the distanceMultiplier required to keep all node corners
 * inside the frame minus the 7% safe margin under the camera pose.
 */
export function frameDistance(nodes: LayoutNode[], aspect: Aspect, pose: CameraPose): number {
  if (nodes.length === 0) {
    return 1.0;
  }

  const basis = computeCameraBasis(pose, aspect);
  const { limitX, limitY } = safeMarginLimits(aspect);
  const tanHalfFov = Math.tan(basis.halfFovRad);

  let maxMultiplier = 1.0;

  for (const node of nodes) {
    const corners = getNodeCorners(node);
    for (const pt of corners) {
      // Relative vector to target
      const rx = pt.x - basis.target.x;
      const ry = pt.y - basis.target.y;
      const rz = pt.z - basis.target.z;

      // In camera frame relative to target
      const x_rel = rx * basis.right.x + ry * basis.right.y + rz * basis.right.z;
      const y_rel = rx * basis.up.x + ry * basis.up.y + rz * basis.up.z;
      const z_rel = rx * basis.forward.x + ry * basis.forward.y + rz * basis.forward.z;

      // Required multiplier along X:
      // |x_rel| / ((m * baseRadius + z_rel) * tanHalfFov * stageAspect) <= limitX
      const reqDepthX = Math.abs(x_rel) / (limitX * tanHalfFov * basis.stageAspect);
      const multX = (reqDepthX - z_rel) / basis.radius;

      // Required multiplier along Y:
      // |y_rel| / ((m * baseRadius + z_rel) * tanHalfFov) <= limitY
      const reqDepthY = Math.abs(y_rel) / (limitY * tanHalfFov);
      const multY = (reqDepthY - z_rel) / basis.radius;

      maxMultiplier = Math.max(maxMultiplier, multX, multY);
    }
  }

  return maxMultiplier;
}
