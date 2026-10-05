import * as THREE from "three";
import type { CameraPose } from "../doc/types";

/**
 * Computes fit distance for vertical stage height = 1.0.
 * d_fit = 0.5 / tan(fov / 2)
 */
export function computeFitDistance(fovDegrees: number): number {
  const halfFovRad = (fovDegrees * 0.5 * Math.PI) / 180;
  return 0.5 / Math.tan(halfFovRad);
}

/**
 * Configures a Three.js PerspectiveCamera to match a CameraPose.
 * Adheres to contracts.md §3:
 * - Orbit around target (panX, panY, 0)
 * - Radius = distance * d_fit
 * - Yaw (degrees): horizontal orbit (+ moves right)
 * - Pitch (degrees): vertical orbit (+ moves above looking down)
 * - Roll (degrees): rotation around camera view axis
 */
export function applyCameraPose(
  camera: THREE.PerspectiveCamera,
  pose: CameraPose,
  stageAspect: number,
): void {
  const fov = pose.fov || 22;
  const dFit = computeFitDistance(fov);
  const radius = (pose.distance || 1.0) * dFit;

  camera.fov = fov;
  camera.aspect = stageAspect;
  camera.near = Math.max(0.01, radius * 0.1);
  camera.far = radius * 10;
  camera.updateProjectionMatrix();

  const yawRad = (pose.yaw * Math.PI) / 180;
  const pitchRad = (pose.pitch * Math.PI) / 180;
  const rollRad = (pose.roll * Math.PI) / 180;

  const targetX = pose.panX || 0;
  const targetY = pose.panY || 0;
  const targetZ = 0;

  // Spherical orbit around target
  const horiz = radius * Math.cos(pitchRad);
  const camX = targetX + horiz * Math.sin(yawRad);
  const camY = targetY + radius * Math.sin(pitchRad);
  const camZ = targetZ + horiz * Math.cos(yawRad);

  camera.position.set(camX, camY, camZ);
  camera.up.set(0, 1, 0);
  camera.lookAt(targetX, targetY, targetZ);

  if (Math.abs(pose.roll) > 1e-6) {
    camera.rotateZ(-rollRad);
  }
}
