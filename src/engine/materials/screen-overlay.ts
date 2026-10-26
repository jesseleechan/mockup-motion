import * as THREE from "three";
import { createTopLeftQuad } from "../geometry/quads";
import type { ChromeUrlText } from "../text/ChromeUrlTextures";

/**
 * A label to draw in a corner of a screen (Before & After's "Before" and "After", quality bar
 * §4): its text raster, once loaded, the corner, and the font size in stage units.
 */
export interface OverlayLabel {
  text: ChromeUrlText | null;
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  size: number;
}

/** Bands at the screen's top and bottom a label keeps clear of, in target px (a phone's). */
export interface LabelClearance {
  top: number;
  bottom: number;
}

/** The divider across the screen: its centre in screen widths, its opacity and width (units). */
export interface OverlayDivider {
  x: number;
  opacity: number;
  width: number;
}

// Quality bar §4 (Before & After), in em of the label's font size: the preview's pill.
const PILL_HEIGHT_EM = 2.1;
const PILL_PADDING_EM = 0.9;
const LABEL_INSET_EM = 1.2;
// rasterizeText pads the glyphs by 0.4 em on each side, so the pill is the raster plus 1.0 em.
const RASTER_SIDE_PADDING_EM = 0.4;
// Where Inter's capitals sit in a raster: from 0.24 em below its top to the baseline at 1.0 em
// (measured in Chromium), so their middle is 0.62 em down. The pill centres them there, as the
// preview's CSS centres the line.
const RASTER_CAP_MIDDLE_EM = 0.62;
// The preview's pill is #111114 at 72%, blended in sRGB. Screens blend in linear light, where
// 90% looks the same over a light page (a white page shows 92 for the preview's 84, a mid grey
// 45 for 48) and keeps a dark photo's detail faintly visible.
const PILL_COLOR = 0x111114;
const PILL_OPACITY = 0.9;
// A hairline ring inside the pill's edge, so the pill reads on a dark page: 0.05 em wide (1 px
// at 1080p, scaled with the label) in white at RING_OPACITY, over the pill.
const RING_WIDTH_EM = 0.05;
const RING_COLOR = 0xffffff;
const RING_OPACITY = 0.12;
const TEXT_COLOR = 0xffffff;
// The divider's soft shadow: black, 22% at the line's edge, falling off as a Gaussian whose
// sigma is the line's width, drawn out to 3 sigma (quality bar §4).
const SHADOW_OPACITY = 0.22;
const SHADOW_SIGMA_OF_WIDTH = 1;
const SHADOW_EXTENT_SIGMAS = 3;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A rounded rectangle uSize px, centred in a quad uQuad px, antialiased over one px, with a ring
// uRing px wide inside its edge drawn over the fill. Premultiplied, linear out.
const pillFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform vec2 uQuad;
  uniform vec2 uSize;
  uniform float uRadius;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uRing;
  uniform vec3 uRingColor;
  uniform float uRingOpacity;

  float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + vec2(r);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  void main() {
    vec2 p = (vUv - 0.5) * uQuad;
    float d = sdRoundedBox(p, uSize * 0.5, uRadius);
    float coverage = clamp(0.5 - d, 0.0, 1.0);
    float ring = coverage - clamp(0.5 - (d + uRing), 0.0, 1.0);
    float fillAlpha = coverage * uOpacity;
    float ringAlpha = ring * uRingOpacity;
    vec3 rgb = uRingColor * ringAlpha + uColor * fillAlpha * (1.0 - ringAlpha);
    gl_FragColor = vec4(rgb, ringAlpha + fillAlpha * (1.0 - ringAlpha));
  }
`;

// The raster's alpha is glyph coverage; its texel row 0 is the top (flipY = false, v = 0 at top).
const textFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D map;
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, texture2D(map, vUv).a);
  }
`;

// A white line uHalfWidth px each side of the quad's centre, antialiased over one px, over a
// black Gaussian shadow from its edges. Premultiplied, linear out.
const dividerFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uQuadWidth;
  uniform float uHalfWidth;
  uniform float uSigma;
  uniform float uShadow;
  uniform float uOpacity;
  void main() {
    float d = abs((vUv.x - 0.5) * uQuadWidth);
    float core = clamp(uHalfWidth + 0.5 - d, 0.0, 1.0);
    float outside = max(0.0, d - uHalfWidth);
    float shadow = uShadow * exp(-0.5 * outside * outside / (uSigma * uSigma));
    float alpha = core + shadow * (1.0 - core);
    gl_FragColor = vec4(vec3(core), alpha) * uOpacity;
  }
`;

function overlayMaterial(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

/**
 * What a screen draws over its panes (contracts.md §4): Before & After's labels, each drawn in
 * its pane's band so it is clipped with the pane, and the divider at the sweep's edge. They are
 * drawn into the screen's target after the screenshots, so the screenshots stay unlit and
 * colour-exact; the target's camera has y up, from 0 at the bottom, in px.
 */
export class ScreenOverlay {
  readonly labelScene = new THREE.Scene();
  readonly dividerScene = new THREE.Scene();

  private pill: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private glyphs: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private line: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor() {
    // The compositor that owns this overlay retains the shared quad.
    const quad = createTopLeftQuad();
    const pillMaterial = overlayMaterial(pillFragmentShader, {
      uQuad: { value: new THREE.Vector2(1, 1) },
      uSize: { value: new THREE.Vector2(1, 1) },
      uRadius: { value: 0 },
      uColor: { value: new THREE.Color(PILL_COLOR) },
      uOpacity: { value: PILL_OPACITY },
      uRing: { value: 1 },
      uRingColor: { value: new THREE.Color(RING_COLOR) },
      uRingOpacity: { value: RING_OPACITY },
    });
    pillMaterial.premultipliedAlpha = true;
    this.pill = new THREE.Mesh(quad, pillMaterial);
    this.glyphs = new THREE.Mesh(
      quad,
      overlayMaterial(textFragmentShader, {
        map: { value: null },
        uColor: { value: new THREE.Color(TEXT_COLOR) },
      }),
    );
    // The scene draws in order: the pill, then its text.
    this.pill.renderOrder = 0;
    this.glyphs.renderOrder = 1;
    this.labelScene.add(this.pill, this.glyphs);

    const lineMaterial = overlayMaterial(dividerFragmentShader, {
      uQuadWidth: { value: 1 },
      uHalfWidth: { value: 0.5 },
      uSigma: { value: 1 },
      uShadow: { value: SHADOW_OPACITY },
      uOpacity: { value: 1 },
    });
    lineMaterial.premultipliedAlpha = true;
    this.line = new THREE.Mesh(quad, lineMaterial);
    this.dividerScene.add(this.line);
  }

  /**
   * Lays out `label` in a `widthPx` × `heightPx` target at `pxPerUnit` px per stage unit, inset
   * 1.2 em from its corner's edges and kept clear of `clearance` (a phone's status bar at the
   * top, its home indicator's area at the bottom). False while its text has no raster yet, so
   * nothing is drawn.
   */
  layoutLabel(
    label: OverlayLabel,
    widthPx: number,
    heightPx: number,
    pxPerUnit: number,
    clearance: LabelClearance,
  ): boolean {
    const text = label.text;
    if (!text || text.fontPx <= 0) return false;
    const em = label.size * pxPerUnit;
    const rasterScale = em / text.fontPx;
    const textWidth = text.raster.width * rasterScale;
    const textHeight = text.raster.height * rasterScale;
    const pillWidth = textWidth + 2 * (PILL_PADDING_EM - RASTER_SIDE_PADDING_EM) * em;
    const pillHeight = PILL_HEIGHT_EM * em;
    const inset = LABEL_INSET_EM * em;
    const atLeft = label.corner === "top-left" || label.corner === "bottom-left";
    const atTop = label.corner === "top-left" || label.corner === "top-right";
    // Whole px, so the pill's edges and the text stay crisp. A top label is inset below the
    // status bar; a bottom one keeps its inset unless the home indicator's area is taller.
    const left = Math.round(atLeft ? inset : widthPx - inset - pillWidth);
    const top = Math.round(
      atTop ? clearance.top + inset : heightPx - Math.max(inset, clearance.bottom) - pillHeight,
    );
    const centreX = left + pillWidth / 2;
    const centreY = heightPx - top - pillHeight / 2;

    // One extra px on each side holds the antialiased edge.
    const quadWidth = pillWidth + 2;
    const quadHeight = pillHeight + 2;
    const pill = this.pill.material.uniforms;
    (pill.uQuad.value as THREE.Vector2).set(quadWidth, quadHeight);
    (pill.uSize.value as THREE.Vector2).set(pillWidth, pillHeight);
    pill.uRadius.value = pillHeight / 2;
    pill.uRing.value = RING_WIDTH_EM * em;
    this.pill.scale.set(quadWidth, quadHeight, 1);
    this.pill.position.set(centreX - quadWidth / 2, centreY - quadHeight / 2, 0);

    this.glyphs.material.uniforms.map.value = text.texture;
    this.glyphs.scale.set(textWidth, textHeight, 1);
    // y is up: the raster's top edge sits the capitals' middle above the pill's centre.
    this.glyphs.position.set(
      Math.round(centreX - textWidth / 2),
      Math.round(centreY + RASTER_CAP_MIDDLE_EM * em - textHeight),
      0,
    );
    return true;
  }

  /**
   * Lays out `divider` across the whole height of a `widthPx` × `heightPx` target at `pxPerUnit`
   * px per stage unit. False when it is hidden.
   */
  layoutDivider(
    divider: OverlayDivider,
    widthPx: number,
    heightPx: number,
    pxPerUnit: number,
  ): boolean {
    if (divider.opacity <= 0) return false;
    const halfWidth = (divider.width * pxPerUnit) / 2;
    const sigma = Math.max(0.5, divider.width * pxPerUnit * SHADOW_SIGMA_OF_WIDTH);
    const quadWidth = 2 * (halfWidth + SHADOW_EXTENT_SIGMAS * sigma + 1);
    const uniforms = this.line.material.uniforms;
    uniforms.uQuadWidth.value = quadWidth;
    uniforms.uHalfWidth.value = halfWidth;
    uniforms.uSigma.value = sigma;
    uniforms.uOpacity.value = divider.opacity;
    this.line.scale.set(quadWidth, heightPx, 1);
    this.line.position.set(divider.x * widthPx - quadWidth / 2, 0, 0);
    return true;
  }

  dispose(): void {
    // The quad is shared; its owner releases it.
    this.pill.material.dispose();
    this.glyphs.material.dispose();
    this.line.material.dispose();
  }
}
