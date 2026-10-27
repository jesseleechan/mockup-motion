import * as THREE from "three";
import { oklch, formatHex } from "culori";
import { RASTER_CAP_MIDDLE_EM } from "../../text/metrics";
import type { ChromeUrlText } from "../text/ChromeUrlTextures";
import { createRoundedRectShape } from "./body";

// Quality-bar §3.2: URL text at 55% opacity.
const URL_TEXT_OPACITY = 0.55;
// A long URL is scaled down to fit inside the pill with this much side padding in total.
const URL_PILL_FILL = 0.88;

/**
 * Decorations are never hit-tested: Engine.pick() raycasts invisible meshes too, and these
 * carry no screen UVs (the URL plane is a hidden 1x1 quad until a raster arrives).
 */
function ignoreRaycast(mesh: THREE.Mesh): void {
  mesh.raycast = () => {};
}

// The raster is twice the text's on-screen size (chrome-url.ts), so its half-resolution mip
// shows one texel per output pixel. Off the pixel grid, each pixel blends two of those texels and
// the glyphs' horizontal strokes go soft: half a pixel off, the 720p pill has 10% less edge
// contrast. With uSnap on, the whole plane moves by under half a pixel so its top-left corner,
// and with it the texel grid, sits on whole output pixels, as Before & After's labels do (§4).
const urlVertexShader = /* glsl */ `
  uniform vec2 uOutputSize;
  uniform float uSnap;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    mat4 mvp = projectionMatrix * modelViewMatrix;
    gl_Position = mvp * vec4(position, 1.0);
    if (uSnap > 0.5) {
      vec4 corner = mvp * vec4(-0.5, 0.5, 0.0, 1.0);
      vec2 px = (corner.xy / corner.w * 0.5 + 0.5) * uOutputSize;
      gl_Position.xy += (floor(px + 0.5) - px) * 2.0 / uOutputSize * gl_Position.w;
    }
  }
`;

// The raster's alpha is glyph coverage; uColor is its exact glyph colour in linear sRGB.
const urlFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D map;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float coverage = texture2D(map, vec2(vUv.x, 1.0 - vUv.y)).a;
    gl_FragColor = vec4(uColor, coverage * uOpacity);
  }
`;

/**
 * The URL text in the browser's pill, its capitals centred on the pill's centre line (quality bar
 * §3.2). A Site Tour fades it from page to page (`LayoutNode.urls`).
 */
export class UrlText {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private current: ChromeUrlText | null = null;
  private centreY = 0;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: urlVertexShader,
      fragmentShader: urlFragmentShader,
      uniforms: {
        map: { value: null },
        uColor: { value: new THREE.Color(0, 0, 0) },
        uOpacity: { value: URL_TEXT_OPACITY },
        uOutputSize: { value: new THREE.Vector2(1, 1) },
        uSnap: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    ignoreRaycast(this.mesh);
    this.mesh.visible = false;
    // The renderer's size is the output frame in px, whatever the supersample of the target the
    // scene draws into, so the snap lands on the output's pixels.
    const outputSize = this.material.uniforms.uOutputSize.value as THREE.Vector2;
    this.mesh.onBeforeRender = (renderer) => {
      renderer.getSize(outputSize);
    };
  }

  /** Puts the text in a pill whose centre is at (x, y), at depth z (stage units). */
  place(x: number, y: number, z: number): void {
    this.centreY = y;
    this.mesh.position.set(x, y, z);
  }

  /**
   * Shows `text` with its glyphs at `glyphHeight` stage units, fitted inside `maxWidth`, at
   * `opacity` of the pill text's own opacity. Hidden without a raster or at opacity 0. `snap`
   * puts it on whole output pixels; only text that holds still is snapped (`holdsStill`), so
   * moving text never steps against its pill.
   */
  update(
    text: ChromeUrlText | null,
    glyphHeight: number,
    maxWidth: number,
    opacity = 1,
    snap = false,
  ): void {
    this.material.uniforms.uSnap.value = snap ? 1 : 0;
    if (!text || opacity <= 0) {
      this.mesh.visible = false;
      this.current = null;
      return;
    }
    if (text !== this.current) {
      this.current = text;
      this.material.uniforms.map.value = text.texture;
      (this.material.uniforms.uColor.value as THREE.Color).set(text.raster.color ?? "#000000");
    }
    this.material.uniforms.uOpacity.value = URL_TEXT_OPACITY * Math.min(1, opacity);
    let unitsPerPx = glyphHeight / text.fontPx;
    const width = text.raster.width * unitsPerPx;
    if (width > maxWidth * URL_PILL_FILL) unitsPerPx *= (maxWidth * URL_PILL_FILL) / width;
    const height = text.raster.height * unitsPerPx;
    const em = text.fontPx * unitsPerPx;
    this.mesh.scale.set(text.raster.width * unitsPerPx, height, 1);
    // The plane is centred on the raster, whose capitals sit above its middle. y is up: move the
    // raster down so the capitals' middle is on the pill's centre, as Before & After's labels do.
    this.mesh.position.y = this.centreY - height / 2 + RASTER_CAP_MIDDLE_EM * em;
    this.mesh.visible = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

/** A rounded-rectangle outline `lineWidth` wide, drawn inside the given outer edge. */
export function createHairline(
  width: number,
  height: number,
  radius: number,
  lineWidth: number,
): THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial> {
  const outer = createRoundedRectShape(width, height, radius);
  const inner = createRoundedRectShape(
    width - lineWidth * 2,
    height - lineWidth * 2,
    Math.max(0.0001, radius - lineWidth),
  );
  outer.holes.push(inner);
  const geometry = new THREE.ShapeGeometry(outer, 24);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  ignoreRaycast(mesh);
  return mesh;
}

/** Quality-bar §3.2 hairline colours: white 8% on dark frames, black 8% on light. */
export function setHairlineAppearance(
  hairline: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>,
  dark: boolean,
): void {
  hairline.material.color.set(dark ? 0xffffff : 0x000000);
  hairline.material.opacity = 0.08;
}

const rimVertexShader = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Two stops along the top-left diagonal: full highlight at the top-left corner, none
// past the centre line, so the rim reads against dark backgrounds without a glossy look.
const rimFragmentShader = /* glsl */ `
  varying vec2 vPos;
  uniform vec2 uHalfSize;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    vec2 p = vPos / uHalfSize;
    float t = dot(p, normalize(vec2(-1.0, 1.0)));
    float alpha = smoothstep(-0.1, 0.9, t);
    gl_FragColor = vec4(uColor, alpha * uOpacity);
  }
`;

/** The finish colour lightened by 0.18 OKLCH lightness (quality-bar §3.3). */
export function rimHighlightColor(finishHex: string): string {
  const parsed = oklch(finishHex);
  if (!parsed) return finishHex;
  return formatHex({ ...parsed, l: Math.min(1, parsed.l + 0.18) }) ?? finishHex;
}

/** The phone's specular rim: a thin outline along the body edge, lit from the top-left. */
export function createRimHighlight(
  width: number,
  height: number,
  radius: number,
  rimWidth: number,
): THREE.Mesh<THREE.ShapeGeometry, THREE.ShaderMaterial> {
  const outer = createRoundedRectShape(width, height, radius);
  const inner = createRoundedRectShape(
    width - rimWidth * 2,
    height - rimWidth * 2,
    Math.max(0.0001, radius - rimWidth),
  );
  outer.holes.push(inner);
  const material = new THREE.ShaderMaterial({
    vertexShader: rimVertexShader,
    fragmentShader: rimFragmentShader,
    uniforms: {
      uHalfSize: { value: new THREE.Vector2(width / 2, height / 2) },
      uColor: { value: new THREE.Color(1, 1, 1) },
      uOpacity: { value: 0.9 },
    },
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(outer, 24), material);
  ignoreRaycast(mesh);
  return mesh;
}
