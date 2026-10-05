import type * as THREE from "three";
import type { Style } from "../../doc/types";
import type { LayoutNode } from "../../motion";
import type { ScreenCompositor } from "../materials/screen";
import { buildBrowserDevice } from "./browser";
import { buildCardDevice } from "./card";
import { buildLaptopDevice } from "./laptop";
import { buildPhoneDevice } from "./phone";
import { buildTabletDevice } from "./tablet";

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
 * Dispatches creation of device 3D instance based on node.device kind.
 */
export function buildDevice(
  node: LayoutNode,
  style: Style,
  ctx: DeviceBuilderContext,
): DeviceInstance {
  switch (node.device) {
    case "browser":
      return buildBrowserDevice(node, style, ctx);
    case "phone":
      return buildPhoneDevice(node, style, ctx);
    case "tablet":
      return buildTabletDevice(node, style, ctx);
    case "laptop":
      return buildLaptopDevice(node, style, ctx);
    case "card":
    default:
      return buildCardDevice(node, style, ctx);
  }
}

export {
  buildBrowserDevice,
  buildCardDevice,
  buildLaptopDevice,
  buildPhoneDevice,
  buildTabletDevice,
};
