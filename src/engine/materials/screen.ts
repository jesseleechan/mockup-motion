import * as THREE from "three";
import type { ManagedTexture } from "../textures/TextureManager";
import { releaseTopLeftQuad, retainTopLeftQuad } from "../geometry/quads";
import { ScreenPage } from "./screen-page";

export interface ScreenCompositorOptions {
  viewportWidthPx: number;
  viewportHeightPx: number;
  cornerRadius: number; // in stage units
  meshWidth: number; // in stage units
  meshHeight: number; // in stage units
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D map;
  uniform vec2 uSize;
  uniform float uRadius;
  uniform vec4 uBorderColor;
  uniform float uBorderWidth;

  float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + vec2(r);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  // smoothstep(-w, w, x) with its ramp half-width w. fwidth gives w = 0 where the distance is
  // flat across a pixel quad, which happens on the box's medial axis (the diagonals from the
  // corners and the centre line). smoothstep(0, 0, x) is undefined: SwiftShader returns 1 there,
  // which discarded whole quads of the screen and showed the card slab through it as a dotted
  // diagonal or a line. A zero-width ramp is a step.
  float aaStep(float w, float x) {
    return w > 0.0 ? smoothstep(-w, w, x) : step(0.0, x);
  }

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    vec2 halfSize = uSize * 0.5;
    float d = sdRoundedBox(p, halfSize, uRadius);

    float delta = fwidth(d) * 0.7;
    float alpha = 1.0 - aaStep(delta, d);
    if (alpha <= 0.001) {
      discard;
    }

    vec4 color = texture2D(map, vUv);

    if (uBorderWidth > 0.0) {
      float borderD = d + uBorderWidth;
      float borderDelta = fwidth(borderD) * 0.7;
      float borderAlpha = aaStep(borderDelta, borderD);
      color = mix(color, uBorderColor, borderAlpha * uBorderColor.a);
    }

    gl_FragColor = vec4(color.rgb, color.a * alpha);
  }
`;

/**
 * One screenshot to draw on a screen, with its texture: a motion `ScreenPane` (contracts.md §4)
 * that the engine has resolved. `offset` and `clip` are in screen widths.
 */
export interface ComposedPane {
  managed: ManagedTexture | null;
  scroll: number;
  offset: number;
  clip: readonly [number, number];
  hasStatusBar?: boolean;
}

const WHOLE_SCREEN: readonly [number, number] = [0, 1];

function samePane(a: ComposedPane, b: ComposedPane): boolean {
  return (
    a.managed === b.managed &&
    a.scroll === b.scroll &&
    a.offset === b.offset &&
    a.clip[0] === b.clip[0] &&
    a.clip[1] === b.clip[1] &&
    Boolean(a.hasStatusBar) === Boolean(b.hasStatusBar)
  );
}

/**
 * ScreenCompositor renders a screen's screenshots into an offscreen render target and provides
 * a ShaderMaterial that shows it with rounded corners. A screen usually shows one screenshot; a
 * screen that shows more (Site Tour) draws each as its own page, offset and clipped to its band
 * of the screen (`composePanes`).
 */
export class ScreenCompositor {
  readonly renderTarget: THREE.WebGLRenderTarget;
  readonly material: THREE.ShaderMaterial;

  private orthoCamera: THREE.OrthographicCamera;
  // One page per pane, reused from frame to frame.
  private pages: ScreenPage[] = [];
  // Drawn under the panes where they leave part of the screen uncovered.
  private basePage: ScreenPage | null = null;

  // Identity, not asset id: a wider reload of the same asset must recompose.
  private lastPanes: ComposedPane[] | null = null;
  private lastIsPhone = false;
  // The textures every page was last drawn with once, so each is uploaded up front.
  private primedTextures: (ManagedTexture | null)[] = [];
  // On-screen viewport size; the target is this times `targetScale`.
  private baseWidthPx: number;
  private baseHeightPx: number;
  private targetScale = 1;
  private maxTargetSize = Infinity;
  private widthPx: number;
  private heightPx: number;
  private disposed = false;

  constructor(opts: ScreenCompositorOptions) {
    retainTopLeftQuad();
    this.baseWidthPx = Math.max(1, opts.viewportWidthPx);
    this.baseHeightPx = Math.max(1, opts.viewportHeightPx);
    this.widthPx = Math.max(1, Math.round(opts.viewportWidthPx));
    this.heightPx = Math.max(1, Math.round(opts.viewportHeightPx));

    this.renderTarget = new THREE.WebGLRenderTarget(this.widthPx, this.heightPx, {
      colorSpace: THREE.SRGBColorSpace,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });

    this.orthoCamera = new THREE.OrthographicCamera(0, this.widthPx, this.heightPx, 0, -1, 1);
    // The first page's materials are made before the screen material, as they always were.
    this.pages.push(new ScreenPage());

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        map: { value: this.renderTarget.texture },
        uSize: { value: new THREE.Vector2(opts.meshWidth, opts.meshHeight) },
        uRadius: { value: opts.cornerRadius },
        uBorderColor: { value: new THREE.Vector4(0, 0, 0, 0.08) },
        uBorderWidth: { value: 0.001 },
      },
      transparent: true,
      depthWrite: true,
    });
  }

  /** Pixel area of the on-screen viewport, before `targetScale`. */
  get baseArea(): number {
    return this.baseWidthPx * this.baseHeightPx;
  }

  /** Current render target size in px. */
  get targetSize(): { width: number; height: number } {
    return { width: this.widthPx, height: this.heightPx };
  }

  /**
   * Renders the screen at `scale` times its on-screen size, so the 3D pass minifies
   * the target through its mipmaps instead of resampling it at 1:1, which blurs text
   * under perspective. The larger side never exceeds `maxSize`.
   */
  setTargetScale(scale: number, maxSize: number): void {
    this.targetScale = Math.max(1, scale);
    this.maxTargetSize = Math.max(1, maxSize);
    const size = this.material.uniforms.uSize.value as THREE.Vector2;
    this.resize(this.baseWidthPx, this.baseHeightPx, size.x, size.y);
  }

  resize(viewportWidthPx: number, viewportHeightPx: number, meshW: number, meshH: number): void {
    this.baseWidthPx = Math.max(1, viewportWidthPx);
    this.baseHeightPx = Math.max(1, viewportHeightPx);
    let scale = this.targetScale;
    const largest = Math.max(this.baseWidthPx, this.baseHeightPx) * scale;
    if (largest > this.maxTargetSize) scale *= this.maxTargetSize / largest;
    const w = Math.max(1, Math.round(this.baseWidthPx * scale));
    const h = Math.max(1, Math.round(this.baseHeightPx * scale));
    if (w !== this.widthPx || h !== this.heightPx) {
      this.widthPx = w;
      this.heightPx = h;
      this.renderTarget.setSize(w, h);
      this.orthoCamera.right = w;
      this.orthoCamera.top = h;
      this.orthoCamera.updateProjectionMatrix();
      this.lastPanes = null; // Force re-compose
    }
    this.material.uniforms.uSize.value.set(meshW, meshH);
  }

  /** Resizes the screen target for a new output scale (px per stage unit), keeping the mesh size. */
  setPixelsPerUnit(pixelsPerUnit: number): void {
    const size = this.material.uniforms.uSize.value as THREE.Vector2;
    this.resize(size.x * pixelsPerUnit, size.y * pixelsPerUnit, size.x, size.y);
  }

  setCornerRadius(radius: number): void {
    this.material.uniforms.uRadius.value = radius;
  }

  /** Draws one screenshot on the whole screen, scrolled to `scroll`, or the empty state. */
  compose(
    renderer: THREE.WebGLRenderer,
    managed: ManagedTexture | null,
    scroll: number,
    options?: { hasStatusBar?: boolean; isPhone?: boolean },
  ): void {
    this.composePanes(
      renderer,
      [{ managed, scroll, offset: 0, clip: WHOLE_SCREEN, hasStatusBar: options?.hasStatusBar }],
      { isPhone: options?.isPhone },
    );
  }

  /**
   * Draws several screenshots on the screen (contracts.md §4), in order: each fit to the screen's
   * width, its left edge at `offset` screen widths, and drawn only where it overlaps its `clip`
   * band and the screen, later panes over earlier ones. Where the panes leave part of the screen
   * uncovered it shows the empty-state fill. Skipped when nothing changed since the last call.
   */
  composePanes(
    renderer: THREE.WebGLRenderer,
    panes: readonly ComposedPane[],
    options?: { isPhone?: boolean },
  ): void {
    const isPhone = Boolean(options?.isPhone);
    if (
      this.lastPanes &&
      this.lastIsPhone === isPhone &&
      this.lastPanes.length === panes.length &&
      this.lastPanes.every((pane, i) => samePane(pane, panes[i]))
    ) {
      return;
    }
    this.lastPanes = panes.map((pane) => ({ ...pane }));
    this.lastIsPhone = isPhone;

    const count = Math.max(1, panes.length);
    while (this.pages.length < count) this.pages.push(new ScreenPage());
    while (this.pages.length > count) this.pages.pop()?.dispose();

    const prevTarget = renderer.getRenderTarget();
    this.prime(renderer, panes, isPhone);

    // Each pane's band of the target in px. Both sides of a shared edge round alike, so
    // neighbouring panes neither overlap nor leave a gap.
    const bands = panes.map((pane) => {
      const left = Math.max(0, pane.clip[0], pane.offset);
      const right = Math.min(1, pane.clip[1], pane.offset + 1);
      return { x0: Math.round(left * this.widthPx), x1: Math.round(right * this.widthPx) };
    });
    if (!this.covers(bands)) {
      this.basePage ??= new ScreenPage();
      this.basePage.layout(null, 0, this.widthPx, this.heightPx, 0);
      this.draw(renderer, this.basePage, null);
    }
    panes.forEach((pane, i) => {
      const { x0, x1 } = bands[i];
      if (x1 <= x0) return;
      const page = this.pages[i];
      page.layout(
        pane.managed,
        pane.scroll,
        this.widthPx,
        this.heightPx,
        pane.offset * this.widthPx,
        {
          hasStatusBar: pane.hasStatusBar,
          isPhone,
        },
      );
      // A pane on the whole screen needs no scissor, so a one-screenshot screen draws as it
      // always has.
      const whole = x0 === 0 && x1 === this.widthPx;
      this.draw(renderer, page, whole ? null : { x0, x1 });
    });
    this.renderTarget.scissorTest = false;
    renderer.setRenderTarget(prevTarget);
  }

  /**
   * The first time a screen of two or more panes gets its screenshots, every page is laid out
   * and drawn once, so each texture is uploaded and each page's meshes are built in setDocument's
   * warm-up render, never while playing (F03, F11). The frame is then drawn over it.
   */
  private prime(
    renderer: THREE.WebGLRenderer,
    panes: readonly ComposedPane[],
    isPhone: boolean,
  ): void {
    const textures = panes.map((pane) => pane.managed);
    const primed =
      textures.length === this.primedTextures.length &&
      textures.every((managed, i) => managed === this.primedTextures[i]);
    this.primedTextures = textures;
    if (primed || panes.length < 2) return;
    panes.forEach((pane, i) => {
      this.pages[i].layout(pane.managed, pane.scroll, this.widthPx, this.heightPx, 0, {
        hasStatusBar: pane.hasStatusBar,
        isPhone,
      });
      this.draw(renderer, this.pages[i], null);
    });
  }

  /** Whether the px bands cover the whole target width. */
  private covers(bands: { x0: number; x1: number }[]): boolean {
    let reached = 0;
    for (const band of [...bands].sort((a, b) => a.x0 - b.x0)) {
      if (band.x1 <= band.x0) continue;
      if (band.x0 > reached) return false;
      reached = Math.max(reached, band.x1);
    }
    return reached >= this.widthPx;
  }

  /** Renders a page into the target, inside the px band [x0, x1) when one is given. */
  private draw(
    renderer: THREE.WebGLRenderer,
    page: ScreenPage,
    band: { x0: number; x1: number } | null,
  ): void {
    if (band) {
      this.renderTarget.scissor.set(band.x0, 0, band.x1 - band.x0, this.heightPx);
      this.renderTarget.scissorTest = true;
    } else {
      this.renderTarget.scissorTest = false;
    }
    // setRenderTarget applies the target's scissor.
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(page.scene, this.orthoCamera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const page of this.pages) page.dispose();
    this.pages = [];
    this.basePage?.dispose();
    this.basePage = null;
    this.renderTarget.dispose();
    this.material.dispose();
    releaseTopLeftQuad();
  }
}
