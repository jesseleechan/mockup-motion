import * as THREE from "three";
import type { ProjectDoc, Style, TextLayer } from "../doc/types";
import { evaluate, type FrameState, type LayoutNode, type ShotFrame } from "../motion";
import { BackgroundRenderer } from "./background/BackgroundRenderer";
import { buildDevice, type DeviceInstance } from "./devices/DeviceBuilder";
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

import { FinalPass } from "./post/final";
import { TextPass } from "./text/TextPass";

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private opts: EngineOptions;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textureManager: TextureManager;
  private backgroundRenderer: BackgroundRenderer;
  private textPass: TextPass;
  private textRasters = new Map<string, TextRaster>();

  private targetA: THREE.WebGLRenderTarget;
  private targetB: THREE.WebGLRenderTarget;
  private finalPass: FinalPass;

  // Motion blur accumulation target and blend pass
  private accumTarget: THREE.WebGLRenderTarget | null = null;
  private accumScene: THREE.Scene;
  private accumCamera: THREE.OrthographicCamera;
  private accumMaterial: THREE.ShaderMaterial;
  private accumMesh: THREE.Mesh;

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
    this.renderer.autoClear = false;

    const maxTex = opts.maxTextureSize ?? renderer.capabilities.maxTextureSize;
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    this.textureManager = new TextureManager(maxTex, maxAniso);
    this.backgroundRenderer = new BackgroundRenderer();
    this.textPass = new TextPass();

    this.scene = new THREE.Scene();
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(2, 4, 3);
    this.scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-2, -1, 2);
    this.scene.add(fillLight);

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

    // Final post-processing pass
    this.finalPass = new FinalPass({
      width: opts.width,
      height: opts.height,
      supersample: ss,
    });

    // Motion blur accumulation
    this.accumCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.accumScene = new THREE.Scene();
    this.accumMaterial = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D map;
        uniform float uWeight;
        void main() {
          vec4 col = texture2D(map, vUv);
          gl_FragColor = vec4(col.rgb * uWeight, col.a * uWeight);
        }
      `,
      uniforms: {
        map: { value: null },
        uWeight: { value: 1.0 },
      },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.accumMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.accumMaterial);
    this.accumScene.add(this.accumMesh);

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
    if (this.accumTarget) {
      this.accumTarget.setSize(renderW, renderH);
    }
    this.finalPass.resize(w, h, ss);
  }

  setSupersample(supersample: 1 | 1.5 | 2): void {
    this.opts.supersample = supersample;
    const renderW = Math.round(this.opts.width * supersample);
    const renderH = Math.round(this.opts.height * supersample);
    this.targetA.setSize(renderW, renderH);
    this.targetB.setSize(renderW, renderH);
    if (this.accumTarget) {
      this.accumTarget.setSize(renderW, renderH);
    }
    this.finalPass.resize(this.opts.width, this.opts.height, supersample);
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
      if (shot.texts && shot.texts.length > 0) {
        const shotStyle = shot.styleOverrides
          ? { ...doc.style, ...shot.styleOverrides }
          : doc.style;
        const frameHeightPx = Math.round(this.opts.height * ss);
        for (const layer of shot.texts) {
          loadPromises.push(
            assets.getText(layer, shotStyle, frameHeightPx).then((raster) => {
              this.textRasters.set(layer.id, raster);
              this.textPass.setTextRaster(layer.id, raster);
            }),
          );
        }
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
      dev = buildDevice(node, style, {
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
    backgroundPhase = 0,
  ): void {
    // 1. Clear background
    this.backgroundRenderer.render(
      this.renderer,
      target,
      frame,
      backgroundPhase,
      this.textureManager,
    );

    // 2. Position camera
    applyCameraPose(this.camera, frame.camera, stageAspect);

    // 3. Update / compose devices
    const activeNodeIds = new Set(frame.nodes.map((n) => n.id));
    for (const [id, dev] of this.deviceInstances.entries()) {
      if (!activeNodeIds.has(id)) {
        dev.object3d.visible = false;
      }
    }

    for (const node of frame.nodes) {
      const dev = this.getOrCreateDevice(node, frame.style);
      dev.object3d.visible = true;
      dev.object3d.userData.nodeId = node.id;

      let managed = null;
      if (node.assetId) {
        managed = this.textureManager.getLoadedTexture(node.assetId);
      }

      let cursorData = undefined;
      if (frame.cursor && (frame.cursor.nodeId === node.id || frame.nodes.length === 1)) {
        cursorData = frame.cursor;
      }

      const asset = node.assetId ? this.currentDoc?.assets.find((a) => a.id === node.assetId) : null;
      const hasStatusBar = Boolean(asset?.meta?.hasStatusBar);
      const isPhone = node.device === "phone";

      dev.compositor.compose(this.renderer, managed, node.scroll, cursorData, { hasStatusBar, isPhone });
      dev.update(node, frame.style, frame.localT);
    }

    // 4. Render 3D scene into MSAA target
    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(target);
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(prevTarget);

    // 5. Render screen-space text overlay into MSAA target
    const shot = this.currentDoc?.shots.find((s) => s.id === frame.shotId);
    if (shot && shot.texts && shot.texts.length > 0) {
      const ss = this.opts.supersample ?? 1;
      const renderW = Math.round(this.opts.width * ss);
      const renderH = Math.round(this.opts.height * ss);
      this.textPass.render(
        this.renderer,
        target,
        frame,
        shot.texts,
        this.textRasters,
        this.currentDoc?.aspect ?? "16:9",
        renderW,
        renderH,
      );
    }
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
    this.renderShotToTarget(
      this.targetA,
      layers[0].frame,
      stageAspect,
      frameState.backgroundPhase,
    );

    if (layers.length > 1 && layers[1].weight > 0) {
      // Transition active: render secondary layer into targetB
      this.renderShotToTarget(
        this.targetB,
        layers[1].frame,
        stageAspect,
        frameState.backgroundPhase,
      );
    }

    // Run final post-processing pass (transition blend, 13-tap downsample, vignette, grain, dither)
    this.finalPass.render(
      this.renderer,
      this.targetA,
      this.targetB,
      layers[0].frame.style,
      t,
      layers,
      frameState.transition,
      null,
    );
  }

  private accumulateTarget(source: THREE.WebGLRenderTarget, weight: number): void {
    if (!this.accumTarget) return;
    this.accumMaterial.uniforms.map.value = source.texture;
    this.accumMaterial.uniforms.uWeight.value = weight;

    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.accumTarget);
    this.renderer.render(this.accumScene, this.accumCamera);
    this.renderer.setRenderTarget(prevTarget);
  }

  /**
   * Motion blur accumulated render over shutter interval.
   */
  renderAccumulated(t: number, shutter: number, samples: number): void {
    if (samples <= 1 || shutter <= 0) {
      this.renderAt(t);
      return;
    }

    if (!this.currentDoc) return;

    const ss = this.opts.supersample ?? 1;
    const renderW = Math.round(this.opts.width * ss);
    const renderH = Math.round(this.opts.height * ss);

    if (!this.accumTarget) {
      this.accumTarget = new THREE.WebGLRenderTarget(renderW, renderH, {
        type: THREE.HalfFloatType,
        colorSpace: THREE.SRGBColorSpace,
      });
    }

    // Clear accumulation target to transparent
    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.accumTarget);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear(true, true, true);
    this.renderer.setRenderTarget(prevTarget);

    const halfShutter = shutter * 0.5;
    const dt = shutter / (samples - 1);
    const startT = Math.max(0, t - halfShutter);

    for (let i = 0; i < samples; i++) {
      const sampleT = startT + i * dt;
      const frameState = evaluate(this.currentDoc, sampleT);
      const stageAspect = this.opts.width / this.opts.height;
      if (frameState.layers.length === 0) continue;

      this.renderShotToTarget(
        this.targetA,
        frameState.layers[0].frame,
        stageAspect,
        frameState.backgroundPhase,
      );

      this.accumulateTarget(this.targetA, 1.0 / samples);
    }

    // Final pass directly from accumulation target to canvas
    const frameState = evaluate(this.currentDoc, t);
    this.finalPass.render(
      this.renderer,
      this.accumTarget,
      this.accumTarget,
      frameState.layers[0]?.frame.style ?? this.currentDoc.style,
      t,
      [{ weight: 1.0 }],
      undefined,
      null,
    );
  }

  /**
   * Hit test output pixel coordinate.
   */
  pick(x: number, y: number): { nodeId: string; u: number; v: number } | null {
    if (this.opts.width <= 0 || this.opts.height <= 0) return null;

    const ndcX = (x / this.opts.width) * 2 - 1;
    const ndcY = -((y / this.opts.height) * 2 - 1);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

    const candidates: THREE.Object3D[] = [];
    for (const dev of this.deviceInstances.values()) {
      if (dev.object3d.visible) {
        candidates.push(dev.object3d);
      }
    }

    const intersects = raycaster.intersectObjects(candidates, true);
    for (const hit of intersects) {
      let curr: THREE.Object3D | null = hit.object;
      while (curr) {
        if (curr.userData?.nodeId) {
          const u = hit.uv ? Math.max(0, Math.min(1, hit.uv.x)) : 0.5;
          const v = hit.uv ? Math.max(0, Math.min(1, 1.0 - hit.uv.y)) : 0.5;
          return { nodeId: curr.userData.nodeId, u, v };
        }
        curr = curr.parent;
      }
    }

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

  /**
   * Reads RGBA pixels from the current render output buffer into a top-to-bottom buffer.
   */
  readPixels(target?: Uint8ClampedArray | Uint8Array): Uint8ClampedArray {
    const w = this.opts.width;
    const h = this.opts.height;
    const gl = this.renderer.getContext();
    const raw = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw);

    const out = target ? (target as Uint8ClampedArray) : new Uint8ClampedArray(w * h * 4);
    const rowBytes = w * 4;
    for (let y = 0; y < h; y++) {
      const srcRow = (h - 1 - y) * rowBytes;
      const dstRow = y * rowBytes;
      out.set(raw.subarray(srcRow, srcRow + rowBytes), dstRow);
    }
    return out;
  }

  dispose(): void {
    for (const dev of this.deviceInstances.values()) {
      this.scene.remove(dev.object3d);
      dev.dispose();
    }
    this.deviceInstances.clear();

    this.textureManager.dispose();
    this.backgroundRenderer.dispose();
    this.textPass.dispose();
    this.textRasters.clear();

    this.targetA.dispose();
    this.targetB.dispose();
    if (this.accumTarget) {
      this.accumTarget.dispose();
    }

    this.accumMaterial.dispose();
    this.accumMesh.geometry.dispose();
    this.finalPass.dispose();

    this.renderer.dispose();
  }
}
