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

export function buildPhoneDevice(
  node: LayoutNode,
  style: Style,
  ctx: DeviceBuilderContext,
): DeviceInstance {
  const bodyW = node.width;
  const bodyH = node.height;
  const finish: DeviceFinish = style.deviceFinish ?? "graphite";

  // Quality-bar §3.3
  const bodyRadius = bodyW * 0.155;
  const bezel = bodyW * 0.032;
  const screenRadius = bodyRadius - bezel; // 0.123 * bodyW
  const screenW = bodyW - bezel * 2;
  const screenH = bodyH - bezel * 2;
  const bodyDepth = 0.008;

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
  const shadowGroup = new DeviceShadowGroup(bodyW, bodyH, bodyRadius);
  shadowGroup.update(style);
  group.add(shadowGroup.group);

  // Solid phone chassis
  const bodyGeo = createRoundedExtrudeGeometry(bodyW, bodyH, bodyRadius, bodyDepth, 0.0006);
  const bodyMat = createBodyMaterial(finish);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(bodyMesh);

  // Screen mesh (sits at z = 0.0001, centered inside bezel)
  const screenGeo = new THREE.PlaneGeometry(screenW, screenH);
  const screenMesh = new THREE.Mesh(screenGeo, compositor.material);
  screenMesh.position.set(0, 0, 0.0001);
  group.add(screenMesh);

  // Side buttons: protruding 0.6% of width
  const buttonProtrusion = bodyW * 0.006;
  const buttonDepth = bodyDepth * 0.5;

  // Power button on right
  const powerGeo = new THREE.BoxGeometry(buttonProtrusion, bodyW * 0.14, buttonDepth);
  const powerMesh = new THREE.Mesh(powerGeo, bodyMat);
  powerMesh.position.set(bodyW / 2 + buttonProtrusion / 2, bodyH * 0.1, -bodyDepth / 2);
  group.add(powerMesh);

  // Volume buttons on left
  const volUpGeo = new THREE.BoxGeometry(buttonProtrusion, bodyW * 0.1, buttonDepth);
  const volUpMesh = new THREE.Mesh(volUpGeo, bodyMat);
  volUpMesh.position.set(-bodyW / 2 - buttonProtrusion / 2, bodyH * 0.16, -bodyDepth / 2);
  group.add(volUpMesh);

  const volDownGeo = new THREE.BoxGeometry(buttonProtrusion, bodyW * 0.1, buttonDepth);
  const volDownMesh = new THREE.Mesh(volDownGeo, bodyMat);
  volDownMesh.position.set(-bodyW / 2 - buttonProtrusion / 2, bodyH * 0.04, -bodyDepth / 2);
  group.add(volDownMesh);

  // Camera pill: width 27% screen width, height 7.6% screen width, 2.4% below screen top
  const pillW = screenW * 0.27;
  const pillH = screenW * 0.076;
  const pillR = pillH / 2;
  const pillTop = screenH / 2 - screenW * 0.024;
  const pillCenterY = pillTop - pillR;

  const pillShape = createRoundedRectShape(pillW, pillH, pillR);
  const pillGeo = new THREE.ShapeGeometry(pillShape);
  const pillMat = new THREE.MeshBasicMaterial({ color: 0x0c0c0e });
  const pillMesh = new THREE.Mesh(pillGeo, pillMat);
  pillMesh.position.set(0, pillCenterY, 0.0002);
  group.add(pillMesh);

  // Dual camera lens reflections inside pill
  const lensRadius = pillH * 0.28;
  const lensLeftGeo = new THREE.CircleGeometry(lensRadius, 16);
  const lensMat = new THREE.MeshBasicMaterial({ color: 0x161a28 });
  const lensLeft = new THREE.Mesh(lensLeftGeo, lensMat);
  lensLeft.position.set(-pillW * 0.22, pillCenterY, 0.00025);
  group.add(lensLeft);

  const lensRightGeo = new THREE.CircleGeometry(lensRadius * 0.8, 16);
  const lensRight = new THREE.Mesh(lensRightGeo, lensMat);
  lensRight.position.set(pillW * 0.22, pillCenterY, 0.00025);
  group.add(lensRight);

  function update(updatedNode: LayoutNode, updatedStyle: Style, _t: number): void {
    const tf = updatedNode.transform;
    group.position.set(tf.x, tf.y, tf.z);
    group.rotation.set(tf.rx, tf.ry, tf.rz);
    group.scale.set(tf.scale, tf.scale, 1.0);

    shadowGroup.update(updatedStyle);
    compositor.material.opacity = updatedNode.opacity;

    // Border color
    const dark = updatedStyle.frameAppearance === "dark";
    const borderRgba = dark ? [1, 1, 1, 0.08] : [0, 0, 0, 0.08];
    compositor.material.uniforms.uBorderColor.value.set(
      borderRgba[0],
      borderRgba[1],
      borderRgba[2],
      borderRgba[3],
    );
    compositor.material.uniforms.uBorderWidth.value = 0.0005;

    // Update finish color
    const finishHex = DEVICE_FINISH_COLORS[updatedStyle.deviceFinish ?? "graphite"];
    bodyMat.color.set(finishHex);
  }

  function dispose(): void {
    shadowGroup.dispose();
    bodyGeo.dispose();
    bodyMat.dispose();
    screenGeo.dispose();
    compositor.dispose();
    powerGeo.dispose();
    volUpGeo.dispose();
    volDownGeo.dispose();
    pillGeo.dispose();
    pillMat.dispose();
    lensLeftGeo.dispose();
    lensRightGeo.dispose();
    lensMat.dispose();
  }

  return {
    object3d: group,
    compositor,
    update,
    dispose,
  };
}
