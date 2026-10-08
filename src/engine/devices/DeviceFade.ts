import * as THREE from "three";

const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/** One device to draw this frame, with its layout node's entrance opacity. */
export interface DeviceDraw {
  object3d: THREE.Object3D;
  opacity: number;
  /** Back to front: a layout draws higher values over lower ones. */
  depthOrder: number;
}

/**
 * How a faded layer mixes with what is behind it. `linear` blends in linear light, like every
 * other pass. `srgb` mixes the encoded sRGB values, the way the slider reference fades its
 * neighbours (docs/presets-plan/reference.md: a pixel of 15 at 65% over 223 shows 88).
 */
export type FadeBlend = "linear" | "srgb";

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
  // A copy of the shot target under an `srgb` layer, because a target can't be sampled while
  // it is drawn to.
  private backdrop: THREE.WebGLRenderTarget | null = null;
  private srgbMaterial: THREE.ShaderMaterial;
  private copyMaterial: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
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
    this.srgbMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      // The layer is premultiplied linear colour and the backdrop is the target before it. The
      // devices are first put over the backdrop as if opaque, then the two are mixed as encoded
      // sRGB values and written back as linear (the target encodes on store).
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D map;
        uniform sampler2D backdrop;
        uniform float uOpacity;
        vec3 toSrgb(vec3 c) {
          c = clamp(c, 0.0, 1.0);
          return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
        }
        vec3 toLinear(vec3 c) {
          c = clamp(c, 0.0, 1.0);
          return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
        }
        void main() {
          vec4 layer = texture2D(map, vUv);
          vec4 back = texture2D(backdrop, vUv);
          vec3 shown = layer.rgb + (1.0 - layer.a) * back.rgb;
          vec3 mixed = mix(toSrgb(back.rgb), toSrgb(shown), uOpacity);
          gl_FragColor = vec4(toLinear(mixed), back.a + uOpacity * layer.a * (1.0 - back.a));
        }
      `,
      uniforms: {
        map: { value: null },
        backdrop: { value: null },
        uOpacity: { value: 1.0 },
      },
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    this.copyMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D map;
        void main() { gl_FragColor = texture2D(map, vUv); }
      `,
      uniforms: { map: { value: null } },
      blending: THREE.NoBlending,
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
    blend: FadeBlend = "linear",
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
        this.renderLayer(renderer, scene, camera, target, run.opacity, blend);
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
    blend: FadeBlend,
  ): void {
    const layer = this.layerFor(target);
    const prevClearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clearColor);

    renderer.setRenderTarget(layer);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    renderer.setClearColor(this.clearColor, prevClearAlpha);

    if (blend === "srgb") {
      // Every render into the multisampled target resolves it, so its texture is current.
      const backdrop = this.backdropFor(target);
      this.mesh.material = this.copyMaterial;
      this.copyMaterial.uniforms.map.value = target.texture;
      renderer.setRenderTarget(backdrop);
      renderer.render(this.scene, this.camera);

      this.mesh.material = this.srgbMaterial;
      this.srgbMaterial.uniforms.map.value = layer.texture;
      this.srgbMaterial.uniforms.backdrop.value = backdrop.texture;
      this.srgbMaterial.uniforms.uOpacity.value = opacity;
    } else {
      this.mesh.material = this.material;
      this.material.uniforms.map.value = layer.texture;
      this.material.uniforms.uOpacity.value = opacity;
    }
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  /**
   * Allocates the targets for a document whose devices can fade (`srgb`: with that blend), or
   * frees them for one whose devices never do, so rendering a frame never creates GPU objects.
   */
  prepare(
    renderer: THREE.WebGLRenderer,
    target: THREE.WebGLRenderTarget,
    needs: { fade: boolean; srgb: boolean },
  ): void {
    if (needs.fade) {
      renderer.initRenderTarget(this.layerFor(target));
    } else {
      this.layer?.dispose();
      this.layer = null;
    }
    if (needs.fade && needs.srgb) {
      renderer.initRenderTarget(this.backdropFor(target));
    } else {
      this.backdrop?.dispose();
      this.backdrop = null;
    }
  }

  /** Follows the shot targets' size; the targets reallocate on their next use. */
  setSize(width: number, height: number): void {
    this.layer?.setSize(width, height);
    this.backdrop?.setSize(width, height);
  }

  /** A multisampled sRGB layer matching the shot targets. */
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

  /** A single-sample sRGB copy of the shot target. */
  private backdropFor(target: THREE.WebGLRenderTarget): THREE.WebGLRenderTarget {
    if (!this.backdrop) {
      this.backdrop = new THREE.WebGLRenderTarget(target.width, target.height, {
        colorSpace: THREE.SRGBColorSpace,
        depthBuffer: false,
      });
    } else if (this.backdrop.width !== target.width || this.backdrop.height !== target.height) {
      this.backdrop.setSize(target.width, target.height);
    }
    return this.backdrop;
  }

  dispose(): void {
    this.layer?.dispose();
    this.layer = null;
    this.backdrop?.dispose();
    this.backdrop = null;
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.srgbMaterial.dispose();
    this.copyMaterial.dispose();
  }
}
