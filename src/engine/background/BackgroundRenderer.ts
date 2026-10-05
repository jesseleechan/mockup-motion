import * as THREE from "three";
import type { ShotFrame } from "../../motion";

/**
 * BackgroundRenderer renders the background for a shot frame into the current render target.
 * In WP-03, solid colors and default background colors are supported;
 * WP-07 implements gradients and mesh.
 */
export class BackgroundRenderer {
  private clearColor = new THREE.Color(0xf1ede6); // Bone default

  render(
    renderer: THREE.WebGLRenderer,
    renderTarget: THREE.WebGLRenderTarget,
    frame: ShotFrame,
  ): void {
    const bg = frame.style.background;
    if (bg.kind === "solid") {
      this.clearColor.set(bg.color || "#F1EDE6");
    } else {
      // Default Bone background
      this.clearColor.set(0xf1ede6);
    }

    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(renderTarget);
    renderer.setClearColor(this.clearColor, 1.0);
    renderer.clear(true, true, true);
    renderer.setRenderTarget(prevTarget);
  }

  dispose(): void {
    // No persistent GPU resources in solid color background
  }
}
