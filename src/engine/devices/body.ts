import * as THREE from "three";
import type { DeviceFinish } from "../../doc/types";

export const DEVICE_FINISH_COLORS: Record<DeviceFinish, string> = {
  graphite: "#3A3B3F",
  silver: "#D9DADD",
  black: "#121214",
  sand: "#CBBBA0",
};

/**
 * Creates a 2D rounded rectangle shape centered at (0, 0).
 */
export function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const w = width;
  const h = height;
  const r = Math.max(0.0001, Math.min(radius, w / 2, h / 2));

  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, (3 * Math.PI) / 2, false);

  return shape;
}

/**
 * Creates an extruded 3D geometry with beveled rounded corners.
 * Front face sits at z = 0, back face at z = -depth.
 */
export function createRoundedExtrudeGeometry(
  width: number,
  height: number,
  radius: number,
  depth: number,
  bevel = 0.0005,
): THREE.ExtrudeGeometry {
  const shape = createRoundedRectShape(width, height, radius);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0001, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelSegments: 3,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  // Center along Z so front face is at z = 0, back face is at z = -depth
  geo.translate(0, 0, -depth);
  return geo;
}

/**
 * Creates standard PBR material for a device finish.
 */
export function createBodyMaterial(finish: DeviceFinish): THREE.MeshStandardMaterial {
  const hex = DEVICE_FINISH_COLORS[finish] ?? DEVICE_FINISH_COLORS.graphite;
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness: 0.35,
    metalness: 0.5,
  });
}
