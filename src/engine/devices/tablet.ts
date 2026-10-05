import * as THREE from "three";
import type { DeviceFinish, Style } from "../../doc/types";
import type { LayoutNode } from "../../motion";
import { ScreenCompositor } from "../materials/screen";
import {
  createBodyMaterial,
  createRoundedExtrudeGeometry,
  DEVICE_FINISH_COLORS,
} from "./body";
import type { DeviceBuilderContext, DeviceInstance } from "./DeviceBuilder";

export function buildTabletDevice(
  node: LayoutNode,
  style: Style,
  ctx: DeviceBuilderContext,
): DeviceInstance {
  const bodyW = node.width;
  const bodyH = node.height;
  const finish: DeviceFinish = style.deviceFinish ?? "graphite";

  // Quality-bar §3.4
  const bezel = bodyW * 0.04;
  const bodyRadius = bodyW * 0.065;
  const screenRadius = Math.max(0.001, bodyRadius - bezel); // 0.025 * bodyW
  const screenW = bodyW - bezel * 2;
  const screenH = bodyH - bezel * 2;
  const bodyDepth = 0.006;

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

  // Solid chassis
  const bodyGeo = createRoundedExtrudeGeometry(bodyW, bodyH, bodyRadius, bodyDepth, 0.0005);
  const bodyMat = createBodyMaterial(finish);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(bodyMesh);

  // Screen mesh
  const screenGeo = new THREE.PlaneGeometry(screenW, screenH);
  const screenMesh = new THREE.Mesh(screenGeo, compositor.material);
  screenMesh.position.set(0, 0, 0.0001);
  group.add(screenMesh);

  // Front camera pinhole: top center bezel
  const cameraR = bodyW * 0.005;
  const cameraGeo = new THREE.CircleGeometry(cameraR, 16);
  const cameraMat = new THREE.MeshBasicMaterial({ color: 0x0c0c0e });
  const cameraMesh = new THREE.Mesh(cameraGeo, cameraMat);
  cameraMesh.position.set(0, bodyH / 2 - bezel * 0.5, 0.0002);
  group.add(cameraMesh);

  function update(updatedNode: LayoutNode, updatedStyle: Style, _t: number): void {
    const tf = updatedNode.transform;
    group.position.set(tf.x, tf.y, tf.z);
    group.rotation.set(tf.rx, tf.ry, tf.rz);
    group.scale.set(tf.scale, tf.scale, 1.0);

    compositor.material.opacity = updatedNode.opacity;

    const dark = updatedStyle.frameAppearance === "dark";
    const borderRgba = dark ? [1, 1, 1, 0.08] : [0, 0, 0, 0.08];
    compositor.material.uniforms.uBorderColor.value.set(
      borderRgba[0],
      borderRgba[1],
      borderRgba[2],
      borderRgba[3],
    );
    compositor.material.uniforms.uBorderWidth.value = 0.0006;

    const finishHex = DEVICE_FINISH_COLORS[updatedStyle.deviceFinish ?? "graphite"];
    bodyMat.color.set(finishHex);
  }

  function dispose(): void {
    bodyGeo.dispose();
    bodyMat.dispose();
    screenGeo.dispose();
    compositor.dispose();
    cameraGeo.dispose();
    cameraMat.dispose();
  }

  return {
    object3d: group,
    compositor,
    update,
    dispose,
  };
}
