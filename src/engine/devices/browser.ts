import * as THREE from "three";
import type { Style } from "../../doc/types";
import type { LayoutNode } from "../../motion";
import { ScreenCompositor } from "../materials/screen";
import { DeviceShadowGroup } from "../shadows/DeviceShadow";
import { chromeUrlKey, toolbarHeightFor, URL_TEXT_FRACTION } from "../text/chrome-url";
import { createRoundedExtrudeGeometry, createRoundedRectShape } from "./body";
import type { DeviceBuilderContext, DeviceInstance } from "./DeviceBuilder";
import { createHairline, setHairlineAppearance, UrlText } from "./details";

export function buildBrowserDevice(
  node: LayoutNode,
  style: Style,
  ctx: DeviceBuilderContext,
): DeviceInstance {
  const width = node.width;
  const height = node.height;
  const chrome = style.browserChrome ?? "standard";
  const isDark = style.frameAppearance === "dark";

  // Quality-bar §3.2
  const cornerRadius = width * 0.011;
  const depth = 0.004;
  const toolbarHeight = chrome === "standard" ? toolbarHeightFor(width) : 0;

  const screenW = width;
  const screenH = height - toolbarHeight;
  const screenY = chrome === "standard" ? -toolbarHeight / 2 : 0;

  const viewportWidthPx = Math.round(screenW * ctx.outputHeightPx * ctx.supersample);
  const viewportHeightPx = Math.round(screenH * ctx.outputHeightPx * ctx.supersample);

  const compositor = new ScreenCompositor({
    viewportWidthPx,
    viewportHeightPx,
    cornerRadius: cornerRadius,
    meshWidth: screenW,
    meshHeight: screenH,
  });

  const group = new THREE.Group();

  // Analytic two-layer soft shadows
  const shadowGroup = new DeviceShadowGroup(width, height, cornerRadius);
  shadowGroup.update(style);
  group.add(shadowGroup.group);

  // Solid body backing
  const bodyGeo = createRoundedExtrudeGeometry(width, height, cornerRadius, depth, 0.0004);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(isDark ? 0x1e1e21 : 0xf6f6f7),
    roughness: 0.4,
    metalness: 0.1,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(bodyMesh);

  // Screen mesh
  const screenGeo = new THREE.PlaneGeometry(screenW, screenH);
  const screenMesh = new THREE.Mesh(screenGeo, compositor.material);
  screenMesh.position.set(0, screenY, 0.0001);
  group.add(screenMesh);

  // Chrome decorations group
  const chromeGroup = new THREE.Group();
  group.add(chromeGroup);

  // Window hairline (quality-bar §3.2), above the toolbar and screen so dark frames
  // keep an edge on dark backgrounds.
  const hairline = createHairline(width, height, cornerRadius, 0.0009);
  hairline.position.set(0, 0, 0.00036);
  setHairlineAppearance(hairline, isDark);
  group.add(hairline);

  let urlText: UrlText | null = null;
  let pillWidth = 0;

  const trafficLights = [
    { color: 0xff5f57, ringColor: 0xd9443c }, // Red
    { color: 0xfebc2e, ringColor: 0xd69917 }, // Yellow
    { color: 0x28c840, ringColor: 0x1ea030 }, // Green
  ];

  if (chrome === "standard") {
    // Toolbar background plate
    const tbShape = new THREE.Shape();
    const halfW = width / 2;
    const topY = height / 2;
    const bottomY = topY - toolbarHeight;
    const r = cornerRadius;

    tbShape.moveTo(-halfW + r, bottomY);
    tbShape.lineTo(halfW - r, bottomY);
    tbShape.lineTo(halfW, bottomY);
    tbShape.lineTo(halfW, topY - r);
    tbShape.absarc(halfW - r, topY - r, r, 0, Math.PI / 2, false);
    tbShape.lineTo(-halfW + r, topY);
    tbShape.absarc(-halfW + r, topY - r, r, Math.PI / 2, Math.PI, false);
    tbShape.lineTo(-halfW, bottomY);
    tbShape.closePath();

    const tbGeo = new THREE.ShapeGeometry(tbShape);
    const tbMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(isDark ? 0x1e1e21 : 0xf6f6f7),
    });
    const tbMesh = new THREE.Mesh(tbGeo, tbMat);
    tbMesh.position.set(0, 0, 0.0002);
    chromeGroup.add(tbMesh);

    // Traffic lights: diameter 0.85% of width, gap 0.55%, left inset 1.6%
    const diameter = width * 0.0085;
    const radius = diameter / 2;
    const gap = width * 0.0055;
    const leftInset = width * 0.016;
    const lightCenterY = topY - toolbarHeight / 2;
    const firstCenterX = -halfW + leftInset + radius;

    trafficLights.forEach((light, i) => {
      const cx = firstCenterX + i * (diameter + gap);
      const dotGeo = new THREE.CircleGeometry(radius, 24);
      const dotMat = new THREE.MeshBasicMaterial({ color: light.color });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.set(cx, lightCenterY, 0.0003);
      chromeGroup.add(dotMesh);

      const ringGeo = new THREE.RingGeometry(radius * 0.88, radius, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: light.ringColor });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(cx, lightCenterY, 0.00032);
      chromeGroup.add(ringMesh);
    });

    // URL pill: centered, 34% width, 56% toolbar height, fully round
    const pillW = width * 0.34;
    const pillH = toolbarHeight * 0.56;
    const pillShape = createRoundedRectShape(pillW, pillH, pillH / 2);
    const pillGeo = new THREE.ShapeGeometry(pillShape);
    const pillMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(isDark ? 0x2c2c30 : 0xe5e5ea),
    });
    const pillMesh = new THREE.Mesh(pillGeo, pillMat);
    pillMesh.position.set(0, lightCenterY, 0.0003);
    chromeGroup.add(pillMesh);

    urlText = new UrlText();
    urlText.mesh.position.set(0, lightCenterY, 0.00034);
    group.add(urlText.mesh);
    pillWidth = pillW;
  } else if (chrome === "minimal") {
    // Floating traffic lights inside top-left corner
    const diameter = width * 0.0085;
    const radius = diameter / 2;
    const gap = width * 0.0055;
    const leftInset = width * 0.016;
    const topInset = width * 0.016;
    const halfW = width / 2;
    const topY = height / 2;
    const lightCenterY = topY - topInset - radius;
    const firstCenterX = -halfW + leftInset + radius;

    trafficLights.forEach((light, i) => {
      const cx = firstCenterX + i * (diameter + gap);
      const dotGeo = new THREE.CircleGeometry(radius, 24);
      const dotMat = new THREE.MeshBasicMaterial({ color: light.color });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.set(cx, lightCenterY, 0.0003);
      chromeGroup.add(dotMesh);
    });
  }

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

    bodyMat.color.set(dark ? 0x1e1e21 : 0xf6f6f7);
    setHairlineAppearance(hairline, dark);
    urlText?.update(
      updatedStyle.browserUrl ? (ctx.chromeUrlText?.(chromeUrlKey(updatedStyle)) ?? null) : null,
      toolbarHeight * URL_TEXT_FRACTION,
      pillWidth,
    );
  }

  function dispose(): void {
    shadowGroup.dispose();
    bodyGeo.dispose();
    bodyMat.dispose();
    screenGeo.dispose();
    compositor.dispose();
    hairline.geometry.dispose();
    hairline.material.dispose();
    urlText?.dispose();

    chromeGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }

  return {
    object3d: group,
    compositor,
    update,
    dispose,
  };
}
