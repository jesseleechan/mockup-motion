import * as THREE from "three";
import type { Style } from "../../doc/types";
import type { LayoutNode } from "../../motion";
import { ScreenCompositor } from "../materials/screen";
import { DeviceShadowGroup } from "../shadows/DeviceShadow";
import { createRoundedExtrudeGeometry } from "./body";
import type { DeviceBuilderContext, DeviceInstance } from "./DeviceBuilder";

export function buildCardDevice(
  node: LayoutNode,
  style: Style,
  ctx: DeviceBuilderContext,
): DeviceInstance {
  const meshW = node.width;
  const meshH = node.height;

  // Quality-bar §3.4: Card radius 1.6% of width, hairline border (0.0009 stage units)
  const cornerRadius = meshW * 0.016;
  const depth = 0.002;

  const viewportWidthPx = Math.round(meshW * ctx.outputHeightPx * ctx.supersample);
  const viewportHeightPx = Math.round(meshH * ctx.outputHeightPx * ctx.supersample);

  const compositor = new ScreenCompositor({
    viewportWidthPx,
    viewportHeightPx,
    cornerRadius,
    meshWidth: meshW,
    meshHeight: meshH,
  });

  const group = new THREE.Group();

  // Analytic two-layer soft shadows
  const shadowGroup = new DeviceShadowGroup(meshW, meshH, cornerRadius);
  shadowGroup.update(style);
  group.add(shadowGroup.group);

  // Solid backing slab with beveled edge for solid appearance when tilted
  const bodyGeo = createRoundedExtrudeGeometry(meshW, meshH, cornerRadius, depth, 0.0003);
  const isDark = style.frameAppearance === "dark";
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(isDark ? 0x18181b : 0xf4f4f5),
    roughness: 0.5,
    metalness: 0.1,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(bodyMesh);

  // Screen mesh
  const screenGeo = new THREE.PlaneGeometry(meshW, meshH);
  const screenMesh = new THREE.Mesh(screenGeo, compositor.material);
  screenMesh.position.set(0, 0, 0.0001);
  group.add(screenMesh);

  function update(updatedNode: LayoutNode, updatedStyle: Style, _t: number): void {
    const tf = updatedNode.transform;
    group.position.set(tf.x, tf.y, tf.z);
    group.rotation.set(tf.rx, tf.ry, tf.rz);
    group.scale.set(tf.scale, tf.scale, 1.0);

    shadowGroup.update(updatedStyle);

    const dark = updatedStyle.frameAppearance === "dark";
    const borderRgba = dark ? [1, 1, 1, 0.08] : [0, 0, 0, 0.08];
    compositor.material.uniforms.uBorderColor.value.set(
      borderRgba[0],
      borderRgba[1],
      borderRgba[2],
      borderRgba[3],
    );
    compositor.material.uniforms.uBorderWidth.value = 0.0009;

    bodyMat.color.set(dark ? 0x18181b : 0xf4f4f5);
  }

  function dispose(): void {
    shadowGroup.dispose();
    bodyGeo.dispose();
    bodyMat.dispose();
    screenGeo.dispose();
    compositor.dispose();
  }

  return {
    object3d: group,
    compositor,
    update,
    dispose,
  };
}
