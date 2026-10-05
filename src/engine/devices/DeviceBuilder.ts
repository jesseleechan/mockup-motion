import * as THREE from "three";
import type { Style } from "../../doc/types";
import type { LayoutNode } from "../../motion";
import { ScreenCompositor } from "../materials/screen";

export interface DeviceBuilderContext {
  outputWidthPx: number;
  outputHeightPx: number;
  supersample: number;
}

export interface DeviceInstance {
  object3d: THREE.Object3D;
  compositor: ScreenCompositor;
  update(node: LayoutNode, style: Style, t: number): void;
  dispose(): void;
}

/**
 * Builds a "card" device (screenshot with rounded corners and hairline border).
 * In WP-03, other device kinds fall back to card until WP-06.
 */
export function buildCardDevice(
  node: LayoutNode,
  style: Style,
  ctx: DeviceBuilderContext,
): DeviceInstance {
  const meshW = node.width;
  const meshH = node.height;

  // Viewport px on screen (width in stage units * outputHeightPx * supersample)
  const viewportWidthPx = Math.round(meshW * ctx.outputHeightPx * ctx.supersample);
  const viewportHeightPx = Math.round(meshH * ctx.outputHeightPx * ctx.supersample);

  // Quality-bar §3.4: Card radius 1.6% of width
  const cornerRadius = meshW * 0.016;

  const compositor = new ScreenCompositor({
    viewportWidthPx,
    viewportHeightPx,
    cornerRadius,
    meshWidth: meshW,
    meshHeight: meshH,
  });

  const geo = new THREE.PlaneGeometry(meshW, meshH);
  const mesh = new THREE.Mesh(geo, compositor.material);

  const group = new THREE.Group();
  group.add(mesh);

  function update(updatedNode: LayoutNode, updatedStyle: Style, _t: number): void {
    // Transform
    const tf = updatedNode.transform;
    group.position.set(tf.x, tf.y, tf.z);
    group.rotation.set(tf.rx, tf.ry, tf.rz);
    group.scale.set(tf.scale, tf.scale, 1.0);

    // Opacity
    compositor.material.opacity = updatedNode.opacity;

    // Border color based on appearance
    const isDark = updatedStyle.frameAppearance === "dark";
    const borderRgba = isDark ? [1, 1, 1, 0.08] : [0, 0, 0, 0.08];
    compositor.material.uniforms.uBorderColor.value.set(
      borderRgba[0],
      borderRgba[1],
      borderRgba[2],
      borderRgba[3],
    );
  }

  function dispose(): void {
    geo.dispose();
    compositor.dispose();
  }

  return {
    object3d: group,
    compositor,
    update,
    dispose,
  };
}
