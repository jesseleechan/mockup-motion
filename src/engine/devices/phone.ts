import * as THREE from "three";
import type { DeviceFinish, Style } from "../../doc/types";
import type { LayoutNode } from "../../motion";
import {
  PHONE_BORDER,
  PHONE_DEPTH,
  PHONE_FRAME,
  PHONE_ISLAND,
  PHONE_SCREEN_RADIUS,
} from "../../motion/phone-spec";
import { ScreenCompositor } from "../materials/screen";
import { DeviceShadowGroup } from "../shadows/DeviceShadow";
import { createRoundedExtrudeGeometry, createRoundedRectShape } from "./body";
import type { DeviceBuilderContext, DeviceInstance } from "./DeviceBuilder";
import { createPhoneFrameRing, PHONE_FINISH_COLORS } from "./phone-frame";

// Glass around the screen: near-black, as the display's border is when it is lit.
const GLASS_COLOR = 0x050506;
// The pair layout puts the phone 0.04 stage units in front of the browser (quality-bar §4),
// so the body stays thinner than that.
const MAX_DEPTH = 0.036;

/**
 * Side buttons as [top, bottom] fractions of body height from the top: the Action button
 * and volume buttons on the left, the side button on the right.
 */
const LEFT_BUTTONS: [number, number][] = [
  [0.18, 0.227],
  [0.273, 0.367],
  [0.393, 0.487],
];
const RIGHT_BUTTONS: [number, number][] = [[0.313, 0.44]];

/** An iPhone Pro, front on (quality-bar §3.3; dimensions in `motion/phone-spec.ts`). */
export function buildPhoneDevice(
  node: LayoutNode,
  style: Style,
  ctx: DeviceBuilderContext,
): DeviceInstance {
  const bodyW = node.width;
  const bodyH = node.height;
  const finish: DeviceFinish = style.deviceFinish ?? "silver";

  const border = bodyW * PHONE_BORDER;
  const frame = bodyW * PHONE_FRAME;
  const screenW = bodyW - border * 2;
  const screenH = bodyH - border * 2;
  // Concentric corners: the body and glass share the screen's corner centres.
  const screenRadius = screenW * PHONE_SCREEN_RADIUS;
  const bodyRadius = screenRadius + border;
  const bodyDepth = Math.min(bodyH * PHONE_DEPTH, MAX_DEPTH);

  const viewportWidthPx = Math.round(screenW * ctx.outputHeightPx * ctx.supersample);
  const viewportHeightPx = Math.round(screenH * ctx.outputHeightPx * ctx.supersample);
  const compositor = new ScreenCompositor({
    viewportWidthPx,
    viewportHeightPx,
    cornerRadius: screenRadius,
    meshWidth: screenW,
    meshHeight: screenH,
  });
  // The black glass already separates the screen from the frame.
  compositor.material.uniforms.uBorderWidth.value = 0;

  const group = new THREE.Group();

  const shadowGroup = new DeviceShadowGroup(bodyW, bodyH, bodyRadius);
  shadowGroup.update(style);
  group.add(shadowGroup.group);

  // The body: its sides show when the camera tilts.
  const bodyGeo = createRoundedExtrudeGeometry(bodyW, bodyH, bodyRadius, bodyDepth, frame * 0.5);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PHONE_FINISH_COLORS[finish]),
    roughness: 0.32,
    metalness: 0.6,
  });
  group.add(new THREE.Mesh(bodyGeo, bodyMat));

  const ring = createPhoneFrameRing(bodyW, bodyH, bodyRadius, frame, finish);
  ring.position.z = 0.00005;
  group.add(ring);

  const glassGeo = new THREE.ShapeGeometry(
    createRoundedRectShape(bodyW - frame * 2, bodyH - frame * 2, bodyRadius - frame),
    24,
  );
  const glassMat = new THREE.MeshBasicMaterial({ color: GLASS_COLOR });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.z = 0.00006;
  group.add(glass);

  const screenGeo = new THREE.PlaneGeometry(screenW, screenH);
  const screenMesh = new THREE.Mesh(screenGeo, compositor.material);
  screenMesh.position.set(0, 0, 0.0001);
  group.add(screenMesh);

  // Buttons stand 0.4 mm proud of the sides, centred in the body's depth.
  const buttonGeos: THREE.BoxGeometry[] = [];
  const protrusion = bodyW * 0.006;
  const addButton = ([top, bottom]: [number, number], side: -1 | 1) => {
    const length = (bottom - top) * bodyH;
    const geo = new THREE.BoxGeometry(protrusion, length, bodyDepth * 0.45);
    buttonGeos.push(geo);
    const mesh = new THREE.Mesh(geo, bodyMat);
    const centerY = bodyH / 2 - ((top + bottom) / 2) * bodyH;
    mesh.position.set(side * (bodyW / 2 + protrusion / 2), centerY, -bodyDepth / 2);
    group.add(mesh);
  };
  for (const button of LEFT_BUTTONS) addButton(button, -1);
  for (const button of RIGHT_BUTTONS) addButton(button, 1);

  // Dynamic Island, with the front camera's lens at its right end.
  const islandW = screenW * PHONE_ISLAND.width;
  const islandH = screenW * PHONE_ISLAND.height;
  const islandY = screenH / 2 - screenW * PHONE_ISLAND.top - islandH / 2;
  const islandGeo = new THREE.ShapeGeometry(
    createRoundedRectShape(islandW, islandH, islandH / 2),
    24,
  );
  const islandMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const island = new THREE.Mesh(islandGeo, islandMat);
  island.position.set(0, islandY, 0.0002);
  group.add(island);

  const lensX = islandW / 2 - islandH / 2;
  const lensGeo = new THREE.CircleGeometry(islandH * 0.27, 24);
  const lensMat = new THREE.MeshBasicMaterial({ color: 0x0b0d14 });
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.position.set(lensX, islandY, 0.00025);
  group.add(lens);
  const glintGeo = new THREE.CircleGeometry(islandH * 0.08, 16);
  const glintMat = new THREE.MeshBasicMaterial({ color: 0x1c2438 });
  const glint = new THREE.Mesh(glintGeo, glintMat);
  glint.position.set(lensX - islandH * 0.07, islandY + islandH * 0.07, 0.0003);
  group.add(glint);

  function update(updatedNode: LayoutNode, updatedStyle: Style, _t: number): void {
    const tf = updatedNode.transform;
    group.position.set(tf.x, tf.y, tf.z);
    group.rotation.set(tf.rx, tf.ry, tf.rz);
    group.scale.set(tf.scale, tf.scale, 1.0);

    shadowGroup.update(updatedStyle);

    const finishHex = PHONE_FINISH_COLORS[updatedStyle.deviceFinish ?? "silver"];
    bodyMat.color.set(finishHex);
    (ring.material.uniforms.uColor.value as THREE.Color).set(finishHex);
  }

  function dispose(): void {
    shadowGroup.dispose();
    bodyGeo.dispose();
    bodyMat.dispose();
    ring.geometry.dispose();
    ring.material.dispose();
    glassGeo.dispose();
    glassMat.dispose();
    screenGeo.dispose();
    compositor.dispose();
    for (const geo of buttonGeos) geo.dispose();
    islandGeo.dispose();
    islandMat.dispose();
    lensGeo.dispose();
    lensMat.dispose();
    glintGeo.dispose();
    glintMat.dispose();
  }

  return {
    object3d: group,
    compositor,
    update,
    dispose,
  };
}
