import * as THREE from "three";
import type { ManagedTexture } from "../textures/TextureManager";
import { getCursorTexture, getRippleTexture, type CursorStyle } from "../cursor/CursorSprites";
import {
  createTopLeftQuad,
  createTopLeftQuadSubrange,
  releaseTopLeftQuad,
  retainTopLeftQuad,
} from "../geometry/quads";

export interface ScreenCursorData {
  x: number;
  y: number;
  scale?: number;
  pressed?: number;
  rippleRadius?: number;
  rippleOpacity?: number;
  style?: "arrow" | "pointer" | "dot";
}

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

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    vec2 halfSize = uSize * 0.5;
    float d = sdRoundedBox(p, halfSize, uRadius);

    float delta = fwidth(d) * 0.7;
    float alpha = 1.0 - smoothstep(-delta, delta, d);
    if (alpha <= 0.001) {
      discard;
    }

    vec4 color = texture2D(map, vUv);

    if (uBorderWidth > 0.0) {
      float borderD = d + uBorderWidth;
      float borderDelta = fwidth(borderD) * 0.7;
      float borderAlpha = smoothstep(-borderDelta, borderDelta, borderD);
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

  private cursorMesh: THREE.Mesh | null = null;
  private rippleMesh: THREE.Mesh | null = null;
  private statusBarMesh: THREE.Mesh | null = null;

  private lastScroll = -1;
  private lastAssetId = "";
  private lastCursorKey = "";
  private widthPx: number;
  private heightPx: number;
  private disposed = false;

  constructor(opts: ScreenCompositorOptions) {
    retainTopLeftQuad();
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

    // Cursor mesh
    const curGeo = createTopLeftQuad();
    const curMat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthTest: false,
    });
    this.cursorMesh = new THREE.Mesh(curGeo, curMat);
    this.cursorMesh.visible = false;
    this.orthoScene.add(this.cursorMesh);

    // Ripple mesh
    const ripGeo = createTopLeftQuad();
    const ripMat = new THREE.MeshBasicMaterial({
      map: getRippleTexture(),
      transparent: true,
      depthTest: false,
    });
    this.rippleMesh = new THREE.Mesh(ripGeo, ripMat);
    this.rippleMesh.visible = false;
    this.orthoScene.add(this.rippleMesh);

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

  resize(viewportWidthPx: number, viewportHeightPx: number, meshW: number, meshH: number): void {
    const w = Math.max(1, Math.round(viewportWidthPx));
    const h = Math.max(1, Math.round(viewportHeightPx));
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

  setCornerRadius(radius: number): void {
    this.material.uniforms.uRadius.value = radius;
  }

  compose(
    renderer: THREE.WebGLRenderer,
    managed: ManagedTexture | null,
    scroll: number,
    cursor?: ScreenCursorData,
    options?: { hasStatusBar?: boolean; isPhone?: boolean },
  ): void {
    const assetId = managed?.assetId ?? "";
    const cursorKey = cursor
      ? `${cursor.x.toFixed(3)},${cursor.y.toFixed(3)},${(cursor.scale ?? 1).toFixed(2)},${(cursor.rippleOpacity ?? 0).toFixed(2)},${cursor.style}`
      : "none";

    // Only skip render if scroll, texture, and cursor have not changed
    if (
      this.lastScroll === scroll &&
      this.lastAssetId === assetId &&
      this.lastCursorKey === cursorKey
    ) {
      return;
    }

    this.lastScroll = scroll;
    this.lastAssetId = assetId;
    this.lastCursorKey = cursorKey;

    if (!managed || managed.strips.length === 0) {
      for (const mesh of this.stripMeshes) mesh.visible = false;
      // Empty state
      this.fillMesh.visible = true;
      this.fillMesh.scale.set(this.widthPx, this.heightPx, 1);
      this.fillMesh.position.set(0, 0, 0);
      (this.fillMesh.material as THREE.MeshBasicMaterial).color.set(0x18181b);
      if (this.statusBarMesh) this.statusBarMesh.visible = false;
      if (this.cursorMesh) this.cursorMesh.visible = false;
      if (this.rippleMesh) this.rippleMesh.visible = false;

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

    // Cursor rendering (in viewport coordinates, unaffected by scroll)
    if (cursor && this.cursorMesh) {
      const cursorSize = Math.max(24, Math.round(this.widthPx * 0.038)) * (cursor.scale ?? 1.0);
      const style: CursorStyle = cursor.style ?? "arrow";
      const curMat = this.cursorMesh.material as THREE.MeshBasicMaterial;
      curMat.map = getCursorTexture(style);
      curMat.transparent = true;
      this.cursorMesh.visible = true;
      this.cursorMesh.scale.set(cursorSize, cursorSize, 1);

      // Place the actual glyph hotspot, including its transparent canvas inset, on the click.
      let cx = cursor.x * this.widthPx;
      let cy = this.heightPx - cursor.y * this.heightPx;
      if (style === "arrow") {
        cx -= cursorSize * (14 / 128);
        cy -= cursorSize * (1 - 14 / 128);
      } else if (style === "pointer") {
        cx -= cursorSize * (28 / 128);
        cy -= cursorSize * (1 - 18 / 128);
      } else {
        cx -= cursorSize / 2;
        cy -= cursorSize / 2;
      }
      this.cursorMesh.position.set(cx, cy, 0.6);

      // Ripple rendering
      if (cursor.rippleOpacity && cursor.rippleOpacity > 0.01 && this.rippleMesh) {
        const rSize = (cursor.rippleRadius ?? 0.02) * this.widthPx * 2;
        const ripMat = this.rippleMesh.material as THREE.MeshBasicMaterial;
        ripMat.opacity = cursor.rippleOpacity;
        ripMat.transparent = true;
        this.rippleMesh.visible = true;
        this.rippleMesh.scale.set(rSize, rSize, 1);
        this.rippleMesh.position.set(
          cursor.x * this.widthPx - rSize / 2,
          this.heightPx - cursor.y * this.heightPx - rSize / 2,
          0.5,
        );
      } else if (this.rippleMesh) {
        this.rippleMesh.visible = false;
      }
    } else {
      if (this.cursorMesh) this.cursorMesh.visible = false;
      if (this.rippleMesh) this.rippleMesh.visible = false;
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
    if (this.cursorMesh) {
      (this.cursorMesh.material as THREE.Material).dispose();
    }
    if (this.rippleMesh) {
      (this.rippleMesh.material as THREE.Material).dispose();
    }
    this.renderTarget.dispose();
    this.material.dispose();
    releaseTopLeftQuad();
  }
}
