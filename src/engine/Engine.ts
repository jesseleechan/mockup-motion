import * as THREE from "three";
import { collectAssetIds, resolveShotStyle } from "../doc/assets";
import type { DeviceKind, ProjectDoc, Style, TextLayer } from "../doc/types";
import {
  evaluate,
  shotEntrance,
  type FrameState,
  type LayoutNode,
  type ShotFrame,
} from "../motion";
import { BackgroundRenderer } from "./background/BackgroundRenderer";
import { DeviceFadePass, type DeviceDraw } from "./devices/DeviceFade";
import { DevicePool } from "./devices/DevicePool";
import { applyCameraPose } from "./stage";
import { textureWidths } from "./textures/sizing";
import { TextureManager } from "./textures/TextureManager";

export interface EngineOptions {
  width: number; // output px (CSS px × DPR for preview)
  height: number;
  supersample?: 1 | 1.5 | 2; // internal render scale, downsampled in the final pass
  preserveDrawingBuffer?: boolean; // true for export so Mediabunny can read the canvas
  maxTextureSize?: number; // override for tests
  cameraDistanceOverride?: number; // isolated lab/test fixture; not serialized
}

export interface TextRaster {
  bitmap: ImageBitmap;
  words: { x: number; y: number; w: number; h: number }[];
  width: number;
  height: number;
  color?: string;
}

export interface AssetProvider {
  /** Decoded image, downscaled with high-quality resampling so width ≤ maxWidth. */
  getImage(assetId: string, maxWidth: number): Promise<ImageBitmap>;
  /** Pre-rasterised text layer at the given output height (main thread rasterises; see src/text). */
  getText(layer: TextLayer, style: Style, frameHeightPx: number): Promise<TextRaster>;
  /** Raw bytes of an audio asset (music track); absent where audio is unsupported (worker). */
  getAudio?(assetId: string): Promise<Blob | null>;
}

export interface EngineDebugInfo {
  /** Nodes drawn by the most recent render, with whether their screen texture is loaded. */
  nodes: { id: string; device: DeviceKind; assetId: string | null; textureLoaded: boolean }[];
  textures: number;
  geometries: number;
  setDocumentCalls: number;
  renderCalls: number;
  /** Device instances built so far; unchanged when setDocument keeps every device. */
  devicesBuilt: number;
}

import { AccumulationPass } from "./post/accumulate";
import { CompositePass } from "./post/composite";
import { FinalPass } from "./post/final";
import { loadChromeUrlRasters, type LoadedChromeUrl } from "./text/chrome-url";
import { ChromeUrlTextures } from "./text/ChromeUrlTextures";
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
  private chromeUrls = new ChromeUrlTextures();

  private targetA: THREE.WebGLRenderTarget;
  private targetB: THREE.WebGLRenderTarget;
  // Linear composite of the active layers and transition, before the final pass
  private compositeTarget: THREE.WebGLRenderTarget;
  private compositePass: CompositePass;
  private finalPass: FinalPass;
  // Motion blur accumulation, created on first use (export only)
  private accumulation: AccumulationPass | null = null;

  private currentDoc: ProjectDoc | null = null;
  private currentAssets: AssetProvider | null = null;
  private devices: DevicePool;
  private deviceFade = new DeviceFadePass();

  private generation = 0;
  private setDocumentCalls = 0;
  private renderCalls = 0;
  private lastRenderedNodes: LayoutNode[] = [];

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
    this.devices = new DevicePool(
      this.scene,
      () => ({
        outputWidthPx: this.opts.width,
        outputHeightPx: this.opts.height,
        supersample: this.opts.supersample ?? 1,
        chromeUrlText: (key) => this.chromeUrls.get(key),
      }),
      maxTex,
    );
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

    // Single-sample composite target; sRGB byte storage like the shot targets
    this.compositeTarget = new THREE.WebGLRenderTarget(renderW, renderH, {
      colorSpace: THREE.SRGBColorSpace,
    });
    this.compositePass = new CompositePass(opts.width / opts.height);

    // Final post-processing pass
    this.finalPass = new FinalPass({
      width: opts.width,
      height: opts.height,
      supersample: ss,
    });

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

    this.resizeTargets(renderW, renderH);
    this.compositePass.setAspect(w / h);
    this.finalPass.resize(w, h, ss);
    this.rescaleScreens();
  }

  private resizeTargets(renderW: number, renderH: number): void {
    this.targetA.setSize(renderW, renderH);
    this.targetB.setSize(renderW, renderH);
    this.compositeTarget.setSize(renderW, renderH);
    this.accumulation?.setSize(renderW, renderH);
    this.deviceFade.setSize(renderW, renderH);
  }

  private rescaleScreens(): void {
    this.devices.rescale(this.opts.height * (this.opts.supersample ?? 1));
  }

  setSupersample(supersample: 1 | 1.5 | 2): void {
    this.opts.supersample = supersample;
    const renderW = Math.round(this.opts.width * supersample);
    const renderH = Math.round(this.opts.height * supersample);
    this.resizeTargets(renderW, renderH);
    this.finalPass.resize(this.opts.width, this.opts.height, supersample);
    this.rescaleScreens();
  }

  /**
   * Loads every image and text raster the document needs, then swaps the
   * document in: keeps device instances whose key still exists, disposes the
   * rest, and releases textures the document no longer uses. A newer call
   * supersedes an older one that is still loading; the older one changes nothing.
   */
  async setDocument(doc: ProjectDoc, assets: AssetProvider): Promise<void> {
    const generation = ++this.generation;
    this.setDocumentCalls++;

    const ss = this.opts.supersample ?? 1;
    const widths = textureWidths(doc, {
      outputWidthPx: this.opts.width,
      supersample: ss,
      quality: doc.export?.quality,
      cameraDistanceOverride: this.opts.cameraDistanceOverride,
    });
    const frameHeightPx = Math.round(this.opts.height * ss);
    const rasters = new Map<string, TextRaster>();

    const loads: Promise<unknown>[] = [];
    for (const [assetId, widthPx] of widths) {
      loads.push(this.textureManager.getTexture(assetId, widthPx, assets));
    }
    doc.shots.forEach((shot, shotIndex) => {
      const style = resolveShotStyle(doc, shotIndex);
      for (const layer of shot.texts ?? []) {
        loads.push(
          assets.getText(layer, style, frameHeightPx).then((raster) => {
            rasters.set(layer.id, raster);
          }),
        );
      }
    });
    let chromeUrls = new Map<string, LoadedChromeUrl>();
    loads.push(
      loadChromeUrlRasters(doc, assets, frameHeightPx).then((loaded) => {
        chromeUrls = loaded;
      }),
    );
    await Promise.all(loads);
    if (generation !== this.generation) return;

    this.currentDoc = doc;
    this.currentAssets = assets;
    this.textureManager.retainOnly(collectAssetIds(doc));
    this.backgroundRenderer.prepareDocument(this.renderer, doc, this.textureManager);
    this.textRasters = rasters;
    for (const [layerId, raster] of rasters) this.textPass.setTextRaster(layerId, raster);
    this.textPass.retainOnly(rasters.keys());
    this.chromeUrls.replaceAll(chromeUrls);
    this.devices.sync(doc);
    this.deviceFade.prepare(
      this.renderer,
      this.targetA,
      doc.shots.some((_, index) => shotEntrance(doc, index) !== "none"),
    );

    // Warm-up compilation
    this.renderAt(0);
    // A frame never creates GPU objects (F03/F11). The incoming-layer target is first drawn
    // only during a transition or the loop wrap crossfade, so allocate it here.
    this.renderer.initRenderTarget(this.targetB);
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
    applyCameraPose(
      this.camera,
      {
        ...frame.camera,
        distance: this.opts.cameraDistanceOverride ?? frame.camera.distance,
      },
      stageAspect,
    );

    // 3. Update / compose devices (only this frame's devices are visible)
    this.devices.hideAll();
    const draws: DeviceDraw[] = [];

    for (const node of frame.nodes) {
      const dev = this.devices.acquire(node, frame.style);
      dev.object3d.userData.nodeId = node.id;
      draws.push({ object3d: dev.object3d, opacity: node.opacity, depthOrder: node.depthOrder });

      let managed = null;
      if (node.assetId) {
        managed = this.textureManager.getLoadedTexture(node.assetId);
      }

      let cursorData = undefined;
      if (frame.cursor && (frame.cursor.nodeId === node.id || frame.nodes.length === 1)) {
        cursorData = frame.cursor;
      }

      const asset = node.assetId
        ? this.currentDoc?.assets.find((a) => a.id === node.assetId)
        : null;
      const hasStatusBar = Boolean(asset?.meta?.hasStatusBar);
      const isPhone = node.device === "phone";

      dev.compositor.compose(this.renderer, managed, node.scroll, cursorData, {
        hasStatusBar,
        isPhone,
      });
      dev.update(node, frame.style, frame.localT);
    }

    // 4. Render the devices into the MSAA target with their entrance opacity
    this.deviceFade.render(this.renderer, this.scene, this.camera, target, draws);

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
   * Renders the active layers at t and blends any transition into `target` as linear
   * values, without vignette, sRGB encoding or grain. Returns the evaluated frame, or
   * null when there is nothing to draw.
   */
  renderComposite(t: number, target: THREE.WebGLRenderTarget): FrameState | null {
    if (!this.currentDoc) return null;

    const frameState: FrameState = evaluate(this.currentDoc, t);
    const stageAspect = this.opts.width / this.opts.height;
    const layers = frameState.layers;
    this.lastRenderedNodes = layers.flatMap((layer) => layer.frame.nodes);

    if (layers.length === 0) return null;

    // Outgoing (or only) layer into targetA, incoming layer into targetB during a transition
    this.renderShotToTarget(this.targetA, layers[0].frame, stageAspect, frameState.backgroundPhase);
    if (layers.length > 1 && layers[1].weight > 0) {
      this.renderShotToTarget(
        this.targetB,
        layers[1].frame,
        stageAspect,
        frameState.backgroundPhase,
      );
    }

    this.compositePass.render(
      this.renderer,
      this.targetA,
      this.targetB,
      layers,
      frameState.transition,
      target,
    );
    return frameState;
  }

  /**
   * Deterministic synchronous render of document state at time t.
   */
  renderAt(t: number): void {
    if (!this.currentDoc) return;
    this.renderCalls++;
    this.renderer.info.reset();

    const frameState = this.renderComposite(t, this.compositeTarget);
    if (!frameState) return;
    this.finalPass.render(this.renderer, this.compositeTarget, frameState.layers[0].frame.style, t);
  }

  /**
   * Motion blur: averages `samples` composites spread over the shutter interval centred
   * on t (transitions included), then runs the final pass once.
   */
  renderAccumulated(t: number, shutter: number, samples: number): void {
    if (samples <= 1 || shutter <= 0) {
      this.renderAt(t);
      return;
    }

    if (!this.currentDoc) return;
    this.renderCalls++;

    if (!this.accumulation) {
      const ss = this.opts.supersample ?? 1;
      this.accumulation = new AccumulationPass(
        Math.round(this.opts.width * ss),
        Math.round(this.opts.height * ss),
      );
    }
    const accumulation = this.accumulation;
    accumulation.clear(this.renderer);

    const halfShutter = shutter * 0.5;
    const dt = shutter / (samples - 1);
    const startT = Math.max(0, t - halfShutter);

    for (let i = 0; i < samples; i++) {
      if (!this.renderComposite(startT + i * dt, this.compositeTarget)) continue;
      accumulation.add(this.renderer, this.compositeTarget, 1.0 / samples);
    }

    const frameState = evaluate(this.currentDoc, t);
    this.finalPass.render(
      this.renderer,
      accumulation.target,
      frameState.layers[0]?.frame.style ?? this.currentDoc.style,
      t,
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

    const intersects = raycaster.intersectObjects(this.devices.visibleObjects(), true);
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

  /** Cheap, always-on counters and texture state for tests and the editor (F05). */
  debugInfo(): EngineDebugInfo {
    return {
      nodes: this.lastRenderedNodes.map((node) => ({
        id: node.id,
        device: node.device,
        assetId: node.assetId,
        textureLoaded: node.assetId
          ? this.textureManager.getLoadedTexture(node.assetId) !== null
          : false,
      })),
      textures: this.renderer.info.memory.textures,
      geometries: this.renderer.info.memory.geometries,
      setDocumentCalls: this.setDocumentCalls,
      renderCalls: this.renderCalls,
      devicesBuilt: this.devices.built,
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
    this.devices.dispose();

    this.textureManager.dispose();
    this.backgroundRenderer.dispose();
    this.textPass.dispose();
    this.chromeUrls.dispose();
    this.textRasters.clear();

    this.targetA.dispose();
    this.targetB.dispose();
    this.compositeTarget.dispose();
    this.accumulation?.dispose();

    this.compositePass.dispose();
    this.finalPass.dispose();
    this.deviceFade.dispose();

    this.renderer.dispose();
  }
}
