import * as THREE from "three";

/** One device to draw this frame, with its layout node's entrance opacity. */
export interface DeviceDraw {
  object3d: THREE.Object3D;
  opacity: number;
  /** Back to front: a layout draws higher values over lower ones. */
  depthOrder: number;
}

// Opacities within half an 8-bit step of 0 or 1 draw as hidden or opaque.
const OPACITY_EPSILON = 1 / 512;

/**
 * Draws a shot's devices with their entrance opacity (quality-bar §2.5).
 *
 * A device is several meshes (shadow, body, screen, chrome), so fading each material would
 * show the body through the screen. Instead every run of devices that share an opacity is
 * drawn into its own layer and composited over the shot target as one image. Runs go back
 * to front, so a fading device in front of an opaque one still covers it.
 * When every device is opaque this is the plain single scene render.
 */
export class DeviceFadePass {
  private layer: THREE.WebGLRenderTarget | null = null;
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private scene = new THREE.Scene();
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private clearColor = new THREE.Color();

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      // The layer holds premultiplied linear colour (normal blending over a transparent clear).
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D map;
        uniform float uOpacity;
        void main() {
          gl_FragColor = texture2D(map, vUv) * uOpacity;
        }
      `,
      uniforms: {
        map: { value: null },
        uOpacity: { value: 1.0 },
      },
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(this.mesh);
  }

  /** Renders `draws` from `scene` into `target`, which already holds the background. */
  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    target: THREE.WebGLRenderTarget,
    draws: DeviceDraw[],
  ): void {
    const shown = draws.filter((draw) => draw.opacity > OPACITY_EPSILON);
    for (const draw of draws) draw.object3d.visible = false;

    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.clearDepth();

    if (shown.every((draw) => draw.opacity >= 1 - OPACITY_EPSILON)) {
      for (const draw of shown) draw.object3d.visible = true;
      renderer.render(scene, camera);
      renderer.setRenderTarget(prevTarget);
      return;
    }

    for (const run of this.runsBackToFront(shown)) {
      for (const draw of run.draws) draw.object3d.visible = true;
      if (run.opacity >= 1 - OPACITY_EPSILON) {
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
      } else {
        this.renderLayer(renderer, scene, camera, target, run.opacity);
      }
      for (const draw of run.draws) draw.object3d.visible = false;
    }

    // Drawn devices stay visible for picking.
    for (const draw of shown) draw.object3d.visible = true;
    renderer.setRenderTarget(prevTarget);
  }

  /**
   * Layouts number overlapping devices back to front (a pair's phone sits in front of its
   * browser). The devices' centres can disagree: under an orbit the wide browser's centre
   * comes nearer the camera than the phone's.
   */
  private runsBackToFront(draws: DeviceDraw[]): { opacity: number; draws: DeviceDraw[] }[] {
    const sorted = [...draws].sort((a, b) => a.depthOrder - b.depthOrder);
    const runs: { opacity: number; draws: DeviceDraw[] }[] = [];
    for (const draw of sorted) {
      const last = runs[runs.length - 1];
      if (last && Math.abs(last.opacity - draw.opacity) < 1e-4) last.draws.push(draw);
      else runs.push({ opacity: draw.opacity, draws: [draw] });
    }
    return runs;
  }

  private renderLayer(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    target: THREE.WebGLRenderTarget,
    opacity: number,
  ): void {
    const layer = this.layerFor(target);
    const prevClearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clearColor);

    renderer.setRenderTarget(layer);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    renderer.setClearColor(this.clearColor, prevClearAlpha);

    this.material.uniforms.map.value = layer.texture;
    this.material.uniforms.uOpacity.value = opacity;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  /** A multisampled sRGB layer matching the shot targets, created on first use. */
  private layerFor(target: THREE.WebGLRenderTarget): THREE.WebGLRenderTarget {
    if (!this.layer) {
      this.layer = new THREE.WebGLRenderTarget(target.width, target.height, {
        samples: target.samples,
        colorSpace: THREE.SRGBColorSpace,
      });
    } else if (this.layer.width !== target.width || this.layer.height !== target.height) {
      this.layer.setSize(target.width, target.height);
    }
    return this.layer;
  }

  dispose(): void {
    this.layer?.dispose();
    this.layer = null;
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
