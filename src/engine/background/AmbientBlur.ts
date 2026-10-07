import * as THREE from "three";
import type { AssetRef } from "../../doc/types";
import { screenAspectFor } from "../../motion";
import type { ManagedTexture } from "../textures/TextureManager";

// The blur runs once per asset on a small copy of its first viewport; the result is
// magnified to the frame, so 256 px is plenty for a heavily blurred image.
const AMBIENT_SOURCE_WIDTH = 256;
// Dual-Kawase iterations at blur = 1 (F11). Each iteration halves the resolution on the
// way down and doubles it on the way up, so 5 reaches 8 px wide at the bottom.
const MAX_ITERATIONS = 5;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Copies the top `uVMax` of the source (v = 0 is the image top, flipY = false) so the
// target's v = 1 is the image top, like every other render target.
const copyFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D map;
  uniform float uVMax;
  void main() {
    gl_FragColor = vec4(texture2D(map, vec2(vUv.x, (1.0 - vUv.y) * uVMax)).rgb, 1.0);
  }
`;

const downFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D map;
  uniform vec2 uHalfPixel;
  void main() {
    vec3 sum = texture2D(map, vUv).rgb * 4.0;
    sum += texture2D(map, vUv - uHalfPixel).rgb;
    sum += texture2D(map, vUv + uHalfPixel).rgb;
    sum += texture2D(map, vUv + vec2(uHalfPixel.x, -uHalfPixel.y)).rgb;
    sum += texture2D(map, vUv - vec2(uHalfPixel.x, -uHalfPixel.y)).rgb;
    gl_FragColor = vec4(sum / 8.0, 1.0);
  }
`;

const upFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D map;
  uniform vec2 uHalfPixel;
  void main() {
    vec2 h = uHalfPixel;
    vec3 sum = texture2D(map, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
    sum += texture2D(map, vUv + vec2(-h.x, h.y)).rgb * 2.0;
    sum += texture2D(map, vUv + vec2(0.0, h.y * 2.0)).rgb;
    sum += texture2D(map, vUv + vec2(h.x, h.y)).rgb * 2.0;
    sum += texture2D(map, vUv + vec2(h.x * 2.0, 0.0)).rgb;
    sum += texture2D(map, vUv + vec2(h.x, -h.y)).rgb * 2.0;
    sum += texture2D(map, vUv + vec2(0.0, -h.y * 2.0)).rgb;
    sum += texture2D(map, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
    gl_FragColor = vec4(sum / 12.0, 1.0);
  }
`;

/** Width / height of an asset's first viewport: the region the ambient background shows. */
export function ambientSourceAspect(asset: AssetRef | undefined): number {
  if (asset?.role === "mobile") return screenAspectFor("phone");
  if (asset?.role === "tablet") return screenAspectFor("tablet");
  return screenAspectFor("browser", asset);
}

/** Iterations for `Background.blur` (0..1): 5 at full blur, never fewer than 1. */
export function ambientIterations(blur: number): number {
  return Math.max(1, Math.min(MAX_ITERATIONS, Math.round(blur * MAX_ITERATIONS)));
}

export function ambientKey(assetId: string, blur: number): string {
  return `${assetId}|${ambientIterations(blur)}`;
}

interface AmbientEntry {
  assetId: string;
  target: THREE.WebGLRenderTarget;
  source: ManagedTexture;
  aspect: number;
}

function createTarget(width: number, height: number): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, {
    colorSpace: THREE.SRGBColorSpace,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  target.texture.wrapS = THREE.ClampToEdgeWrapping;
  target.texture.wrapT = THREE.ClampToEdgeWrapping;
  return target;
}

/**
 * Blurred first-viewport copies of ambient background assets: a dual-Kawase blur run
 * once per (asset, blur) into a cached 256 px wide target. Rendering only samples it.
 */
export class AmbientBlur {
  private entries = new Map<string, AmbientEntry>();
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private copyMat: THREE.ShaderMaterial;
  private downMat: THREE.ShaderMaterial;
  private upMat: THREE.ShaderMaterial;

  constructor() {
    const material = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });
    this.copyMat = material(copyFragmentShader, { map: { value: null }, uVMax: { value: 1 } });
    this.downMat = material(downFragmentShader, {
      map: { value: null },
      uHalfPixel: { value: new THREE.Vector2() },
    });
    this.upMat = material(upFragmentShader, {
      map: { value: null },
      uHalfPixel: { value: new THREE.Vector2() },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copyMat);
    this.scene.add(this.quad);
  }

  /**
   * Blurs the asset's first viewport unless the cached result is for the same loaded
   * texture. `aspect` is the first viewport's width / height.
   */
  prepare(
    renderer: THREE.WebGLRenderer,
    assetId: string,
    managed: ManagedTexture,
    aspect: number,
    blur: number,
  ): void {
    const key = ambientKey(assetId, blur);
    const existing = this.entries.get(key);
    if (existing && existing.source === managed && existing.aspect === aspect) return;
    const strip = managed.strips[0];
    if (!strip) return;

    // The first viewport, never more than the first strip.
    const regionHeight = Math.min(strip.height, managed.width / aspect);
    const width = AMBIENT_SOURCE_WIDTH;
    const height = Math.max(1, Math.round((width * regionHeight) / managed.width));
    let target = existing?.target;
    if (!target || target.width !== width || target.height !== height) {
      target?.dispose();
      target = createTarget(width, height);
    }

    const previous = renderer.getRenderTarget();
    this.copyMat.uniforms.map.value = strip.texture;
    this.copyMat.uniforms.uVMax.value = regionHeight / strip.height;
    this.draw(renderer, this.copyMat, target);

    const iterations = ambientIterations(blur);
    const levels: THREE.WebGLRenderTarget[] = [target];
    for (let i = 1; i <= iterations; i++) {
      const w = Math.max(1, width >> i);
      const h = Math.max(1, height >> i);
      levels.push(createTarget(w, h));
    }
    for (let i = 1; i <= iterations; i++) {
      const src = levels[i - 1];
      this.downMat.uniforms.map.value = src.texture;
      this.downMat.uniforms.uHalfPixel.value.set(0.5 / src.width, 0.5 / src.height);
      this.draw(renderer, this.downMat, levels[i]);
    }
    for (let i = iterations; i >= 1; i--) {
      const src = levels[i];
      this.upMat.uniforms.map.value = src.texture;
      this.upMat.uniforms.uHalfPixel.value.set(0.5 / src.width, 0.5 / src.height);
      this.draw(renderer, this.upMat, levels[i - 1]);
    }
    for (let i = 1; i < levels.length; i++) levels[i].dispose();
    this.copyMat.uniforms.map.value = null;
    this.downMat.uniforms.map.value = null;
    this.upMat.uniforms.map.value = null;
    renderer.setRenderTarget(previous);

    this.entries.set(key, { assetId, target, source: managed, aspect });
  }

  /** The blurred first viewport and its aspect, or null when it has not been prepared. */
  get(assetId: string, blur: number): { texture: THREE.Texture; aspect: number } | null {
    const entry = this.entries.get(ambientKey(assetId, blur));
    return entry ? { texture: entry.target.texture, aspect: entry.aspect } : null;
  }

  /** Disposes every blurred target whose key is not in `keys`. */
  retainOnly(keys: Iterable<string>): void {
    const keep = new Set(keys);
    for (const [key, entry] of this.entries) {
      if (keep.has(key)) continue;
      entry.target.dispose();
      this.entries.delete(key);
    }
  }

  private draw(
    renderer: THREE.WebGLRenderer,
    material: THREE.ShaderMaterial,
    target: THREE.WebGLRenderTarget,
  ): void {
    this.quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    for (const entry of this.entries.values()) entry.target.dispose();
    this.entries.clear();
    this.copyMat.dispose();
    this.downMat.dispose();
    this.upMat.dispose();
    this.quad.geometry.dispose();
  }
}
