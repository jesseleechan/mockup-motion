import * as THREE from "three";
import type { ManagedTexture } from "../textures/TextureManager";
import {
  createTopLeftQuad,
  createTopLeftQuadSubrange,
  releaseTopLeftQuad,
  retainTopLeftQuad,
} from "../geometry/quads";

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
 * ScreenCompositor renders screenshot tiles into an offscreen render target
 * at current scroll position and provides a ShaderMaterial with rounded corners.
 */
export class ScreenCompositor {
  readonly renderTarget: THREE.WebGLRenderTarget;
  readonly material: THREE.ShaderMaterial;

  private orthoScene: THREE.Scene;
  private orthoCamera: THREE.OrthographicCamera;
  private stripMeshes: THREE.Mesh[] = [];
  private fillMesh: THREE.Mesh;

  private statusBarMesh: THREE.Mesh | null = null;

  private lastScroll = -1;
  // Identity, not asset id: a wider reload of the same asset must recompose.
  private lastManaged: ManagedTexture | null | undefined = undefined;
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
    this.orthoScene = new THREE.Scene();

    // Default fill quad for blank screens or short image bottoms
    const fillGeo = createTopLeftQuad();
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x1e1e21 });
    this.fillMesh = new THREE.Mesh(fillGeo, fillMat);
    this.fillMesh.visible = false;
    this.orthoScene.add(this.fillMesh);

    // Status bar overlay mesh
    const sbGeo = createTopLeftQuadSubrange(0);
    const sbMat = new THREE.MeshBasicMaterial({ transparent: true });
    this.statusBarMesh = new THREE.Mesh(sbGeo, sbMat);
    this.statusBarMesh.visible = false;
    this.orthoScene.add(this.statusBarMesh);

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
      this.lastScroll = -1; // Force re-compose
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

  compose(
    renderer: THREE.WebGLRenderer,
    managed: ManagedTexture | null,
    scroll: number,
    options?: { hasStatusBar?: boolean; isPhone?: boolean },
  ): void {
    // Skip the render if neither scroll nor texture has changed
    if (this.lastScroll === scroll && this.lastManaged === managed) {
      return;
    }

    this.lastScroll = scroll;
    this.lastManaged = managed;

    if (!managed || managed.strips.length === 0) {
      for (const mesh of this.stripMeshes) mesh.visible = false;
      // Empty state
      this.fillMesh.visible = true;
      this.fillMesh.scale.set(this.widthPx, this.heightPx, 1);
      this.fillMesh.position.set(0, 0, 0);
      (this.fillMesh.material as THREE.MeshBasicMaterial).color.set(0x18181b);
      if (this.statusBarMesh) this.statusBarMesh.visible = false;

      const prevTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(this.renderTarget);
      renderer.render(this.orthoScene, this.orthoCamera);
      renderer.setRenderTarget(prevTarget);
      return;
    }

    const scaleFactor = this.widthPx / managed.width;
    const totalRenderedHeight = managed.height * scaleFactor;
    const scrollablePx = Math.max(0, totalRenderedHeight - this.heightPx);
    const scrollY = scroll * scrollablePx;

    // Keep one mesh and material per texture strip; scrolling only changes transforms.
    while (this.stripMeshes.length < managed.strips.length) {
      const strip = managed.strips[this.stripMeshes.length];
      const material = new THREE.MeshBasicMaterial({ map: strip.texture, transparent: false });
      const mesh = new THREE.Mesh(createTopLeftQuad(), material);
      this.stripMeshes.push(mesh);
      this.orthoScene.add(mesh);
    }
    for (let index = 0; index < this.stripMeshes.length; index++) {
      const mesh = this.stripMeshes[index];
      if (index >= managed.strips.length) {
        mesh.visible = false;
        continue;
      }
      const strip = managed.strips[index];
      (mesh.material as THREE.MeshBasicMaterial).map = strip.texture;
      const stripY = strip.yOffset * scaleFactor - scrollY;
      const stripH = strip.height * scaleFactor;

      // Check visibility within viewport [0, heightPx]
      if (stripY + stripH < 0 || stripY > this.heightPx) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.scale.set(this.widthPx, stripH, 1);
      // In Three Orthographic camera top is heightPx, so y starts at heightPx - stripY - stripH
      mesh.position.set(0, this.heightPx - stripY - stripH, 0);
    }

    // Fill bottom if screenshot is shorter than viewport
    if (totalRenderedHeight < this.heightPx) {
      this.fillMesh.visible = true;
      const fillHeight = this.heightPx - totalRenderedHeight;
      this.fillMesh.scale.set(this.widthPx, fillHeight, 1);
      this.fillMesh.position.set(0, 0, 0);

      const color = managed.bottomRowColor;
      if (color) {
        (this.fillMesh.material as THREE.MeshBasicMaterial).color.setRGB(
          color[0],
          color[1],
          color[2],
          THREE.SRGBColorSpace,
        );
      } else {
        (this.fillMesh.material as THREE.MeshBasicMaterial).color.set(0x1e1e21);
      }
    } else {
      this.fillMesh.visible = false;
    }

    // Phone status bar safe zone pinning while scrolling
    if (
      options?.isPhone &&
      options?.hasStatusBar &&
      scrollY > 0 &&
      managed.strips.length > 0 &&
      this.statusBarMesh
    ) {
      const sbHeight = Math.round(this.heightPx * 0.055);
      const firstStrip = managed.strips[0];
      const sbSourcePx = sbHeight / scaleFactor;
      const vMax = Math.min(1, sbSourcePx / firstStrip.height);
      const sbPosition = this.statusBarMesh.geometry.attributes.position;
      const sbUv = this.statusBarMesh.geometry.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < sbPosition.count; i++) {
        sbUv.setY(i, sbPosition.getY(i) > 0 ? 0 : vMax);
      }
      sbUv.needsUpdate = true;
      const mat = this.statusBarMesh.material as THREE.MeshBasicMaterial;
      mat.map = firstStrip.texture;
      mat.transparent = true;
      this.statusBarMesh.visible = true;
      this.statusBarMesh.scale.set(this.widthPx, sbHeight, 1);
      this.statusBarMesh.position.set(0, this.heightPx - sbHeight, 0.2);
    } else if (this.statusBarMesh) {
      this.statusBarMesh.visible = false;
    }

    // Render into target
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(this.orthoScene, this.orthoCamera);
    renderer.setRenderTarget(prevTarget);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const mesh of this.stripMeshes) {
      (mesh.material as THREE.Material).dispose();
    }
    this.stripMeshes = [];
    (this.fillMesh.material as THREE.Material).dispose();
    if (this.statusBarMesh) {
      this.statusBarMesh.geometry.dispose();
      (this.statusBarMesh.material as THREE.Material).dispose();
    }
    this.renderTarget.dispose();
    this.material.dispose();
    releaseTopLeftQuad();
  }
}
