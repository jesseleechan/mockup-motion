import * as THREE from "three";
import { collectAssetIds } from "../doc/assets";
import type { DeviceKind, ProjectDoc } from "../doc/types";
import type { TextLine, TextRaster } from "../text/rasterize";
import {
  evaluate,
  isSteppedLayout,
  type FrameState,
  type LayoutNode,
  type ShotFrame,
} from "../motion";
import { BackgroundRenderer } from "./background/BackgroundRenderer";
import { DeviceFadePass, fadeBlendFor, type DeviceDraw } from "./devices/DeviceFade";
import { DevicePool } from "./devices/DevicePool";
import { applyCameraPose } from "./stage";
import { textureRows, textureWidths } from "./textures/sizing";
import { TextureManager } from "./textures/TextureManager";

export interface EngineOptions {
  width: number; // output px (CSS px × DPR for preview)
  height: number;
  supersample?: 1 | 1.5 | 2; // internal render scale, downsampled in the final pass
  preserveDrawingBuffer?: boolean; // true for export so Mediabunny can read the canvas
  maxTextureSize?: number; // override for tests
  cameraDistanceOverride?: number; // isolated lab/test fixture; not serialized
  hideDevices?: boolean; // lab/test fixture: draw the background only; not serialized
}

export type { TextLine, TextRaster };

export interface AssetProvider {
  /**
   * Decoded image, downscaled with high-quality resampling so width ≤ maxWidth. With `rows`
   * (textureRows), only its top `keptRows(rows, width, height)` rows are needed; returning more
   * is allowed.
   */
  getImage(assetId: string, maxWidth: number, rows?: number | null): Promise<ImageBitmap>;
  /** Pre-rasterised text line at the given output height (main thread rasterises; see src/text). */
  getText(line: TextLine, frameHeightPx: number): Promise<TextRaster>;
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

import { CompositePass } from "./post/composite";
import { FinalPass } from "./post/final";
import { loadChromeUrlRasters, type LoadedChromeUrl } from "./text/chrome-url";
import { ChromeUrlTextures } from "./text/ChromeUrlTextures";
import { loadScreenLabelRasters } from "./text/screen-labels";

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private opts: EngineOptions;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textureManager: TextureManager;
  private backgroundRenderer: BackgroundRenderer;
  private chromeUrls = new ChromeUrlTextures();
  // Before & After's "Before" and "After", keyed by their text.
  private screenLabels = new ChromeUrlTextures();

  private targetA: THREE.WebGLRenderTarget;
  private targetB: THREE.WebGLRenderTarget;
  // Linear composite of the active layers and transition, before the final pass
  private compositeTarget: THREE.WebGLRenderTarget;
  private compositePass: CompositePass;
  private finalPass: FinalPass;

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
    this.compositePass = new CompositePass();

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
    this.finalPass.resize(w, h, ss);
    this.rescaleScreens();
  }

  private resizeTargets(renderW: number, renderH: number): void {
    this.targetA.setSize(renderW, renderH);
    this.targetB.setSize(renderW, renderH);
    this.compositeTarget.setSize(renderW, renderH);
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
    const rows = textureRows(doc);
    const frameHeightPx = Math.round(this.opts.height * ss);

    const loads: Promise<unknown>[] = [];
    for (const [assetId, widthPx] of widths) {
      const assetRows = rows.get(assetId) ?? null;
      loads.push(this.textureManager.getTexture(assetId, widthPx, assets, assetRows));
    }
    let chromeUrls = new Map<string, LoadedChromeUrl>();
    loads.push(
      loadChromeUrlRasters(doc, assets, frameHeightPx).then((loaded) => {
        chromeUrls = loaded;
      }),
    );
    let screenLabels = new Map<string, LoadedChromeUrl>();
    loads.push(
      loadScreenLabelRasters(doc, assets, frameHeightPx).then((loaded) => {
        screenLabels = loaded;
      }),
    );
    await Promise.all(loads);
    if (generation !== this.generation) return;

    this.currentDoc = doc;
    this.currentAssets = assets;
    this.textureManager.retainOnly(collectAssetIds(doc));
    this.chromeUrls.replaceAll(chromeUrls);
    this.screenLabels.replaceAll(screenLabels);
    this.devices.sync(doc);
    // Slider neighbours, orbit cards and a deck's entering card are faded cards (quality bar
    // §3.1); the carousel's and the orbit's fades mix in sRGB like the slider reference. A Site
    // Tour and a Responsive Tour fade nothing.
    const hasStepped = doc.shots.some(
      (shot) =>
        isSteppedLayout(shot.layout) &&
        shot.layout.kind !== "tour" &&
        shot.layout.kind !== "responsive-tour",
    );
    this.deviceFade.prepare(this.renderer, this.targetA, {
      fade: hasStepped,
      srgb: doc.shots.some((shot) => fadeBlendFor(shot.layout) !== "linear"),
    });

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
  ): void {
    // 1. Clear background
    this.backgroundRenderer.render(this.renderer, target, frame);

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

    const nodes = this.opts.hideDevices ? [] : frame.nodes;
    for (const node of nodes) {
      const dev = this.devices.acquire(node, frame.style);
      dev.object3d.userData.nodeId = node.id;
      draws.push({ object3d: dev.object3d, opacity: node.opacity, depthOrder: node.depthOrder });

      const isPhone = node.device === "phone";
      if (node.panes) {
        // A screen that draws more than one screenshot (Site Tour, Before & After, contracts.md
        // §4), with Before & After's labels and divider over it.
        const panes = node.panes.map((pane) => ({
          managed: pane.assetId ? this.textureManager.getLoadedTexture(pane.assetId) : null,
          scroll: pane.scroll,
          offset: pane.offset,
          clip: pane.clip,
          hasStatusBar: this.hasStatusBar(pane.assetId),
          label: pane.label && {
            text: this.screenLabels.get(pane.label.text),
            corner: pane.label.corner,
            size: pane.label.size,
          },
        }));
        dev.compositor.composePanes(this.renderer, panes, { isPhone, divider: node.divider });
      } else {
        const managed = node.assetId ? this.textureManager.getLoadedTexture(node.assetId) : null;
        dev.compositor.compose(this.renderer, managed, node.scroll, {
          hasStatusBar: this.hasStatusBar(node.assetId),
          isPhone,
        });
      }
      dev.update(node, frame.style, frame.localT);
    }

    // 4. Render the devices into the MSAA target with their opacity
    const shot = this.currentDoc?.shots.find((s) => s.id === frame.shotId);
    const blend = fadeBlendFor(shot?.layout);
    this.deviceFade.render(this.renderer, this.scene, this.camera, target, draws, blend);
  }

  /** Whether a screenshot includes its own phone status bar (quality-bar §3.3). */
  private hasStatusBar(assetId: string | null): boolean {
    if (!assetId) return false;
    const asset = this.currentDoc?.assets.find((a) => a.id === assetId);
    return Boolean(asset?.meta?.hasStatusBar);
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
    this.renderShotToTarget(this.targetA, layers[0].frame, stageAspect);
    if (layers.length > 1 && layers[1].weight > 0) {
      this.renderShotToTarget(this.targetB, layers[1].frame, stageAspect);
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
      nodes: this.lastRenderedNodes.map((node) => {
        // A screen of several panes is loaded when every screenshot it can show is.
        const ids = node.panes ? node.panes.map((pane) => pane.assetId) : [node.assetId];
        return {
          id: node.id,
          device: node.device,
          assetId: node.assetId,
          textureLoaded: ids.every(
            (id) => id !== null && this.textureManager.getLoadedTexture(id) !== null,
          ),
        };
      }),
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
    this.chromeUrls.dispose();
    this.screenLabels.dispose();

    this.targetA.dispose();
    this.targetB.dispose();
    this.compositeTarget.dispose();

    this.compositePass.dispose();
    this.finalPass.dispose();
    this.deviceFade.dispose();

    this.renderer.dispose();
  }
}
