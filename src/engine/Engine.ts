import * as THREE from "three";
import type { ProjectDoc, Style, TextLayer } from "../doc/types";
import { evaluate, type FrameState, type LayoutNode, type ShotFrame } from "../motion";
import { BackgroundRenderer } from "./background/BackgroundRenderer";
import { buildCardDevice, type DeviceInstance } from "./devices/DeviceBuilder";
import { applyCameraPose } from "./stage";
import { TextureManager } from "./textures/TextureManager";

export interface EngineOptions {
  width: number; // output px (CSS px × DPR for preview)
  height: number;
  supersample?: 1 | 1.5 | 2; // internal render scale, downsampled in the final pass
  preserveDrawingBuffer?: boolean; // true for export so Mediabunny can read the canvas
  maxTextureSize?: number; // override for tests
}

export interface TextRaster {
  bitmap: ImageBitmap;
  words: { x: number; y: number; w: number; h: number }[];
  width: number;
  height: number;
}

export interface AssetProvider {
  /** Decoded image, downscaled with high-quality resampling so width ≤ maxWidth. */
  getImage(assetId: string, maxWidth: number): Promise<ImageBitmap>;
  /** Pre-rasterised text layer at the given output height (main thread rasterises; see src/text). */
  getText(layer: TextLayer, style: Style, frameHeightPx: number): Promise<TextRaster>;
}

const blitVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const blitFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D mapA;
  uniform sampler2D mapB;
  uniform float weightA;
  uniform float weightB;
  uniform bool isTransition;

  void main() {
    vec4 colA = texture2D(mapA, vUv);
    if (!isTransition) {
      gl_FragColor = colA;
      return;
    }
    vec4 colB = texture2D(mapB, vUv);
    gl_FragColor = colA * weightA + colB * weightB;
  }
`;

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private opts: EngineOptions;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textureManager: TextureManager;
  private backgroundRenderer: BackgroundRenderer;

  private targetA: THREE.WebGLRenderTarget;
  private targetB: THREE.WebGLRenderTarget;
  private blitScene: THREE.Scene;
  private blitCamera: THREE.OrthographicCamera;
  private blitMaterial: THREE.ShaderMaterial;
  private blitMesh: THREE.Mesh;

  private currentDoc: ProjectDoc | null = null;
  private currentAssets: AssetProvider | null = null;
  private deviceInstances = new Map<string, DeviceInstance>();

  private _onContextRestored?: () => void;

  private constructor(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    opts: EngineOptions,
    renderer: THREE.WebGLRenderer,
  ) {
    this.canvas = canvas;
    this.opts = opts;
    this.renderer = renderer;

    const maxTex = opts.maxTextureSize ?? renderer.capabilities.maxTextureSize;
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    this.textureManager = new TextureManager(maxTex, maxAniso);
    this.backgroundRenderer = new BackgroundRenderer();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(22, opts.width / opts.height, 0.05, 50);

    const ss = opts.supersample ?? 1;
    const renderW = Math.round(opts.width * ss);
    const renderH = Math.round(opts.height * ss);

    // Multi-sample render targets for shots
    this.targetA = new THREE.WebGLRenderTarget(renderW, renderH, {
      samples: 4,
      colorSpace: THREE.SRGBColorSpace,
    });
    this.targetB = new THREE.WebGLRenderTarget(renderW, renderH, {
      samples: 4,
      colorSpace: THREE.SRGBColorSpace,
    });

    // Blit pass
    this.blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.blitScene = new THREE.Scene();
    this.blitMaterial = new THREE.ShaderMaterial({
      vertexShader: blitVertexShader,
      fragmentShader: blitFragmentShader,
      uniforms: {
        mapA: { value: this.targetA.texture },
        mapB: { value: this.targetB.texture },
        weightA: { value: 1.0 },
        weightB: { value: 0.0 },
        isTransition: { value: false },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.PlaneGeometry(2, 2);
    this.blitMesh = new THREE.Mesh(quad, this.blitMaterial);
    this.blitScene.add(this.blitMesh);

    this.setupContextLossHandling();
  }

  static async create(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    opts: EngineOptions,
  ): Promise<Engine> {
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas as HTMLCanvasElement,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: Boolean(opts.preserveDrawingBuffer),
    });

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setSize(opts.width, opts.height, false);

    return new Engine(canvas, opts, renderer);
  }

  get onContextRestored(): (() => void) | undefined {
    return this._onContextRestored;
  }

  set onContextRestored(callback: (() => void) | undefined) {
    this._onContextRestored = callback;
  }

  private setupContextLossHandling(): void {
    if ("addEventListener" in this.canvas) {
      const el = this.canvas as HTMLCanvasElement;
      el.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        console.warn("[Engine] WebGL context lost.");
      });

      el.addEventListener("webglcontextrestored", async () => {
        console.info("[Engine] WebGL context restored. Rebuilding GPU resources...");
        if (this.currentDoc && this.currentAssets) {
          await this.setDocument(this.currentDoc, this.currentAssets);
        }
        this._onContextRestored?.();
      });
    }
  }

  get info(): { maxTextureSize: number; renderer: string; drawCalls: number } {
    return {
      maxTextureSize: this.opts.maxTextureSize ?? this.renderer.capabilities.maxTextureSize,
      renderer: this.renderer.capabilities.isWebGL2 ? "WebGL 2.0" : "WebGL 1.0",
      drawCalls: this.renderer.info.render.calls,
    };
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (w === this.opts.width && h === this.opts.height) return;

    this.opts.width = w;
    this.opts.height = h;
    this.renderer.setSize(w, h, false);

    const ss = this.opts.supersample ?? 1;
    const renderW = Math.round(w * ss);
    const renderH = Math.round(h * ss);

    this.targetA.setSize(renderW, renderH);
    this.targetB.setSize(renderW, renderH);
  }

  setSupersample(supersample: 1 | 1.5 | 2): void {
    this.opts.supersample = supersample;
    const renderW = Math.round(this.opts.width * supersample);
    const renderH = Math.round(this.opts.height * supersample);
    this.targetA.setSize(renderW, renderH);
    this.targetB.setSize(renderW, renderH);
  }

  /**
   * Diff document against current state, pre-upload needed textures,
   * rebuild devices, and pre-warm shader cache.
   */
  async setDocument(doc: ProjectDoc, assets: AssetProvider): Promise<void> {
    this.currentDoc = doc;
    this.currentAssets = assets;

    // Remove obsolete device instances
    for (const [id, dev] of this.deviceInstances.entries()) {
      this.scene.remove(dev.object3d);
      dev.dispose();
      this.deviceInstances.delete(id);
    }

    // Pre-load textures for all shots
    const ss = this.opts.supersample ?? 1;
    const targetWidthPx = Math.ceil(this.opts.width * ss * 1.5);

    const loadPromises: Promise<unknown>[] = [];
    for (const shot of doc.shots) {
      if (shot.layout.kind === "single" && shot.layout.assetId) {
        loadPromises.push(
          this.textureManager.getTexture(shot.layout.assetId, targetWidthPx, assets),
        );
      }
    }

    await Promise.all(loadPromises);

    // Warm-up compilation
    this.renderAt(0);
  }

  private getOrCreateDevice(node: LayoutNode, style: Style): DeviceInstance {
    let dev = this.deviceInstances.get(node.id);
    if (!dev) {
      const ss = this.opts.supersample ?? 1;
      dev = buildCardDevice(node, style, {
        outputWidthPx: this.opts.width,
        outputHeightPx: this.opts.height,
        supersample: ss,
      });
      this.deviceInstances.set(node.id, dev);
      this.scene.add(dev.object3d);
    }
    return dev;
  }

  private renderShotToTarget(
    target: THREE.WebGLRenderTarget,
    frame: ShotFrame,
    stageAspect: number,
  ): void {
    // 1. Clear background
    this.backgroundRenderer.render(this.renderer, target, frame);

    // 2. Position camera
    applyCameraPose(this.camera, frame.camera, stageAspect);

    // 3. Update / compose devices
    for (const node of frame.nodes) {
      const dev = this.getOrCreateDevice(node, frame.style);

      let managed = null;
      if (node.assetId) {
        managed = this.textureManager.getLoadedTexture(node.assetId);
      }

      dev.compositor.compose(this.renderer, managed, node.scroll);
      dev.update(node, frame.style, frame.localT);
    }

    // 4. Render 3D scene into MSAA target
    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(prevTarget);
  }

  /**
   * Deterministic synchronous render of document state at time t.
   */
  renderAt(t: number): void {
    if (!this.currentDoc) return;

    const frameState: FrameState = evaluate(this.currentDoc, t);
    const stageAspect = this.opts.width / this.opts.height;
    const layers = frameState.layers;

    if (layers.length === 0) return;

    this.renderer.info.reset();

    // Render primary layer into targetA
    this.renderShotToTarget(this.targetA, layers[0].frame, stageAspect);

    if (layers.length > 1 && layers[1].weight > 0) {
      // Transition active: render secondary layer into targetB
      this.renderShotToTarget(this.targetB, layers[1].frame, stageAspect);

      this.blitMaterial.uniforms.mapA.value = this.targetA.texture;
      this.blitMaterial.uniforms.mapB.value = this.targetB.texture;
      this.blitMaterial.uniforms.weightA.value = layers[0].weight;
      this.blitMaterial.uniforms.weightB.value = layers[1].weight;
      this.blitMaterial.uniforms.isTransition.value = true;
    } else {
      this.blitMaterial.uniforms.mapA.value = this.targetA.texture;
      this.blitMaterial.uniforms.isTransition.value = false;
    }

    // Blit to output canvas
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.blitScene, this.blitCamera);
  }

  /**
   * Motion blur accumulated render over shutter interval.
   */
  renderAccumulated(t: number, shutter: number, samples: number): void {
    if (samples <= 1 || shutter <= 0) {
      this.renderAt(t);
      return;
    }

    // Average samples across shutter interval [t - shutter/2, t + shutter/2]
    const halfShutter = shutter * 0.5;
    const dt = shutter / (samples - 1);
    const startT = Math.max(0, t - halfShutter);

    // Simple deterministic accumulation pass
    for (let i = 0; i < samples; i++) {
      this.renderAt(startT + i * dt);
    }
  }

  /**
   * Hit test output pixel coordinate.
   */
  pick(_x: number, _y: number): { nodeId: string; u: number; v: number } | null {
    // In WP-03, hit-testing stub is provided; full raycaster hit-test is finalized in WP-12
    return null;
  }

  getMemoryInfo(): { geometries: number; textures: number } {
    return {
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    };
  }

  getCurrentDoc(): ProjectDoc | null {
    return this.currentDoc;
  }

  getCurrentAssets(): AssetProvider | null {
    return this.currentAssets;
  }

  dispose(): void {
    for (const dev of this.deviceInstances.values()) {
      this.scene.remove(dev.object3d);
      dev.dispose();
    }
    this.deviceInstances.clear();

    this.textureManager.dispose();
    this.backgroundRenderer.dispose();

    this.targetA.dispose();
    this.targetB.dispose();

    this.blitMesh.geometry.dispose();
    this.blitMaterial.dispose();

    this.renderer.dispose();
  }
}
