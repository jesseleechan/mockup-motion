import type * as THREE from "three";
import { resolveShotStyle } from "../../doc/assets";
import type { ProjectDoc, Style } from "../../doc/types";
import { resolveLayout, type LayoutNode } from "../../motion";
import { buildDevice, type DeviceBuilderContext, type DeviceInstance } from "./DeviceBuilder";

/**
 * Device instances are reused while this key holds. Geometry (bodies, bezels,
 * toolbars) is built from the node's stage size, so a size change is a new key;
 * output-pixel changes go through `rescale` instead.
 */
export function deviceKey(node: LayoutNode, style: Style): string {
  return [
    node.id,
    node.device,
    node.width.toFixed(5),
    node.height.toFixed(5),
    style.frameAppearance,
    style.deviceFinish,
    style.browserChrome,
    style.browserUrl,
    style.shadow,
  ].join("|");
}

/** The scene's device instances, diffed against each new document. */
export class DevicePool {
  private instances = new Map<string, DeviceInstance>();
  private builtCount = 0;
  private scene: THREE.Scene;
  private context: () => DeviceBuilderContext;

  constructor(scene: THREE.Scene, context: () => DeviceBuilderContext) {
    this.scene = scene;
    this.context = context;
  }

  /**
   * Builds the instances the document needs and disposes the rest. Node ids and
   * sizes do not depend on time (tests/doc-assets.test.ts), so the layout at each
   * shot's start names every device the shot will draw.
   */
  sync(doc: ProjectDoc): void {
    const wanted = new Map<string, { node: LayoutNode; style: Style }>();
    doc.shots.forEach((shot, shotIndex) => {
      const style = resolveShotStyle(doc, shotIndex);
      const nodes = resolveLayout(
        shot.layout,
        doc.aspect,
        doc.assets,
        0,
        shot.duration,
        shot.entrance ?? "none",
      );
      for (const node of nodes) wanted.set(deviceKey(node, style), { node, style });
    });

    for (const [key, dev] of this.instances) {
      if (wanted.has(key)) continue;
      this.scene.remove(dev.object3d);
      dev.dispose();
      this.instances.delete(key);
    }
    for (const { node, style } of wanted.values()) this.acquire(node, style);
  }

  /** The instance for this node and style, built on first use. */
  acquire(node: LayoutNode, style: Style): DeviceInstance {
    const key = deviceKey(node, style);
    let dev = this.instances.get(key);
    if (!dev) {
      dev = buildDevice(node, style, this.context());
      this.builtCount++;
      dev.object3d.visible = false;
      this.instances.set(key, dev);
      this.scene.add(dev.object3d);
    }
    return dev;
  }

  /** Device instances built since the pool was created. */
  get built(): number {
    return this.builtCount;
  }

  hideAll(): void {
    for (const dev of this.instances.values()) dev.object3d.visible = false;
  }

  /** Screen targets are sized in output px per stage unit (stage height = 1). */
  rescale(pixelsPerUnit: number): void {
    for (const dev of this.instances.values()) dev.compositor.setPixelsPerUnit(pixelsPerUnit);
  }

  visibleObjects(): THREE.Object3D[] {
    return [...this.instances.values()]
      .filter((dev) => dev.object3d.visible)
      .map((dev) => dev.object3d);
  }

  dispose(): void {
    for (const dev of this.instances.values()) {
      this.scene.remove(dev.object3d);
      dev.dispose();
    }
    this.instances.clear();
  }
}
