import * as THREE from "three";
import type { DeviceFinish, Style } from "../../doc/types";
import type { LayoutNode } from "../../motion";
import { ScreenCompositor } from "../materials/screen";
import { DeviceShadowGroup } from "../shadows/DeviceShadow";
import {
  createBodyMaterial,
  createRoundedExtrudeGeometry,
  createRoundedRectShape,
  DEVICE_FINISH_COLORS,
} from "./body";
import type { DeviceBuilderContext, DeviceInstance } from "./DeviceBuilder";

export function buildLaptopDevice(
  node: LayoutNode,
  style: Style,
  ctx: DeviceBuilderContext,
): DeviceInstance {
  const lidW = node.width;
  const lidH = node.height;
  const finish: DeviceFinish = style.deviceFinish ?? "silver";

  // Quality-bar §3.4: Bezel 1.8% of width, base at 6% of lid height
  const bezel = lidW * 0.018;
  const lidRadius = lidW * 0.015;
  const screenRadius = Math.max(0.001, lidW * 0.008);
  const screenW = lidW - bezel * 2;
  const screenH = lidH - bezel * 2;
  const lidDepth = 0.003;

  const viewportWidthPx = Math.round(screenW * ctx.outputHeightPx * ctx.supersample);
  const viewportHeightPx = Math.round(screenH * ctx.outputHeightPx * ctx.supersample);

  const compositor = new ScreenCompositor({
    viewportWidthPx,
    viewportHeightPx,
    cornerRadius: screenRadius,
    meshWidth: screenW,
    meshHeight: screenH,
  });

  const group = new THREE.Group();

  // Analytic two-layer soft shadows
  const shadowGroup = new DeviceShadowGroup(lidW, lidH, lidRadius);
  shadowGroup.update(style);
  group.add(shadowGroup.group);

  // Lid chassis
  const lidGeo = createRoundedExtrudeGeometry(lidW, lidH, lidRadius, lidDepth, 0.0003);
  const bodyMat = createBodyMaterial(finish);
  const lidMesh = new THREE.Mesh(lidGeo, bodyMat);
  group.add(lidMesh);

  // Screen mesh
  const screenGeo = new THREE.PlaneGeometry(screenW, screenH);
  const screenMesh = new THREE.Mesh(screenGeo, compositor.material);
  screenMesh.position.set(0, 0, 0.0001);
  group.add(screenMesh);

  // Camera dot centered in top bezel
  const cameraDotGeo = new THREE.CircleGeometry(lidW * 0.003, 16);
  const cameraDotMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0c });
  const cameraDot = new THREE.Mesh(cameraDotGeo, cameraDotMat);
  cameraDot.position.set(0, lidH / 2 - bezel * 0.5, 0.0002);
  group.add(cameraDot);

  // Laptop Base (keyboard deck)
  // Attached at hinge: bottom of lid (y = -lidH / 2, z = 0)
  // Projected forward horizontally: width = lidW, length = lidH * 0.72, thickness = 0.0035
  const baseDepth = lidH * 0.72;
  const baseThickness = 0.0035;
  const baseRadius = lidRadius;

  const baseGeo = createRoundedExtrudeGeometry(lidW, baseDepth, baseRadius, baseThickness, 0.0003);
  const baseMesh = new THREE.Mesh(baseGeo, bodyMat);

  // Rotate base 80 degrees forward so it forms an open laptop angle (~100 deg between lid and base)
  baseMesh.rotation.x = Math.PI * 0.44; // ~79.2 degrees
  baseMesh.position.set(0, -lidH / 2 + 0.002, baseDepth * 0.38);
  group.add(baseMesh);

  // Trackpad on base
  const trackpadW = lidW * 0.32;
  const trackpadH = baseDepth * 0.28;
  const trackpadShape = createRoundedRectShape(trackpadW, trackpadH, lidW * 0.006);
  const trackpadGeo = new THREE.ShapeGeometry(trackpadShape);
  const trackpadMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(DEVICE_FINISH_COLORS[finish]).multiplyScalar(0.92),
    roughness: 0.5,
  });
  const trackpadMesh = new THREE.Mesh(trackpadGeo, trackpadMat);
  trackpadMesh.rotation.x = Math.PI * 0.44;
  trackpadMesh.position.set(0, -lidH / 2 + 0.004, baseDepth * 0.46);
  group.add(trackpadMesh);

  function update(updatedNode: LayoutNode, updatedStyle: Style, _t: number): void {
    const tf = updatedNode.transform;
    group.position.set(tf.x, tf.y, tf.z);
    group.rotation.set(tf.rx, tf.ry, tf.rz);
    group.scale.set(tf.scale, tf.scale, 1.0);

    shadowGroup.update(updatedStyle);
    compositor.material.opacity = updatedNode.opacity;

    const dark = updatedStyle.frameAppearance === "dark";
    const borderRgba = dark ? [1, 1, 1, 0.08] : [0, 0, 0, 0.08];
    compositor.material.uniforms.uBorderColor.value.set(
      borderRgba[0],
      borderRgba[1],
      borderRgba[2],
      borderRgba[3],
    );
    compositor.material.uniforms.uBorderWidth.value = 0.0005;

    const finishHex = DEVICE_FINISH_COLORS[updatedStyle.deviceFinish ?? "silver"];
    bodyMat.color.set(finishHex);
    trackpadMat.color.set(finishHex).multiplyScalar(0.92);
  }

  function dispose(): void {
    shadowGroup.dispose();
    lidGeo.dispose();
    bodyMat.dispose();
    screenGeo.dispose();
    compositor.dispose();
    cameraDotGeo.dispose();
    cameraDotMat.dispose();
    baseGeo.dispose();
    trackpadGeo.dispose();
    trackpadMat.dispose();
  }

  return {
    object3d: group,
    compositor,
    update,
    dispose,
  };
}
