import * as THREE from "three";
import { oklab } from "culori";
import type { Background } from "../../doc/types";
import type { ShotFrame } from "../../motion";
import type { TextureManager } from "../textures/TextureManager";

// Shader: Fullscreen quad vertex shader with optional pan parallax
const bgVertexShader = /* glsl */ `
  varying vec2 vUv;
  uniform vec2 uPanOffset;

  void main() {
    vUv = uv + uPanOffset;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Helper GLSL functions for OKLab to linear sRGB
const oklabGlsl = /* glsl */ `
  float linear_to_srgb_f(float c) {
    c = clamp(c, 0.0, 1.0);
    return c > 0.0031308 ? (1.055 * pow(c, 1.0 / 2.4) - 0.055) : (c * 12.92);
  }

  vec3 oklab_to_srgb(vec3 c) {
    float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
    float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
    float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;

    float l = l_ * l_ * l_;
    float m = m_ * m_ * m_;
    float s = s_ * s_ * s_;

    vec3 lrgb = vec3(
      +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    );

    return vec3(
      linear_to_srgb_f(lrgb.r),
      linear_to_srgb_f(lrgb.g),
      linear_to_srgb_f(lrgb.b)
    );
  }
`;

const solidFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
  }
`;

const gradientFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor0Lab;
  uniform vec3 uColor1Lab;
  uniform vec3 uColor2Lab;
  uniform int uStopCount;
  uniform float uAngleRad;

  ${oklabGlsl}

  void main() {
    vec2 dir = vec2(cos(uAngleRad), sin(uAngleRad));
    // Center gradient at (0.5, 0.5)
    float t = dot(vUv - 0.5, dir) + 0.5;
    t = clamp(t, 0.0, 1.0);

    vec3 lab;
    if (uStopCount <= 2) {
      lab = mix(uColor0Lab, uColor1Lab, t);
    } else {
      if (t < 0.5) {
        lab = mix(uColor0Lab, uColor1Lab, t * 2.0);
      } else {
        lab = mix(uColor1Lab, uColor2Lab, (t - 0.5) * 2.0);
      }
    }

    gl_FragColor = vec4(oklab_to_srgb(lab), 1.0);
  }
`;

const meshFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColorsLab[5];
  uniform vec2 uPoints[5];
  uniform int uColorCount;
  uniform float uPhase;
  uniform float uDrift;
  uniform float uAspect;

  ${oklabGlsl}

  // Simple value noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    // Aspect-corrected UV
    vec2 uv = vec2(vUv.x * uAspect, vUv.y);

    // Domain warp using low frequency noise
    float warp = vnoise(uv * 2.5) * 0.08;

    // Integer harmonics of 2*PI for drift guarantees perfect loop seam at phase 0 and 1
    float twoPi = 6.28318530718;
    float sinPhase1 = sin(twoPi * uPhase);
    float cosPhase1 = cos(twoPi * uPhase);
    float sinPhase2 = sin(twoPi * 2.0 * uPhase);
    float cosPhase2 = cos(twoPi * 2.0 * uPhase);

    vec3 blendedLab = vec3(0.0);
    float totalWeight = 0.0;

    for (int i = 0; i < 5; i++) {
      if (i >= uColorCount) break;

      // Drift each point using integer harmonics, scaled by uDrift (max 6%)
      float pointOffset = float(i) * 1.25;
      vec2 drift = vec2(
        sin(twoPi * uPhase + pointOffset) * 0.05 + sinPhase2 * 0.01,
        cos(twoPi * uPhase + pointOffset) * 0.05 + cosPhase2 * 0.01
      ) * uDrift;

      vec2 pt = uPoints[i] + drift + vec2(warp);
      pt.x *= uAspect;

      float dist = length(uv - pt);
      // Smooth inverse distance falloff
      float weight = 1.0 / (dist * dist * 9.0 + 0.08);

      blendedLab += uColorsLab[i] * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0.0) {
      blendedLab /= totalWeight;
    }

    gl_FragColor = vec4(oklab_to_srgb(blendedLab), 1.0);
  }
`;

const ambientFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D map;
  uniform float uDim;
  uniform bool uHasMap;
  uniform vec3 uFallbackColor;

  void main() {
    if (!uHasMap) {
      gl_FragColor = vec4(uFallbackColor * (1.0 - uDim), 1.0);
      return;
    }

    vec4 tex = texture2D(map, vec2(vUv.x, 1.0 - vUv.y));
    vec3 col = tex.rgb * (1.0 - uDim);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function hexToOklab(hex: string): [number, number, number] {
  const lab = oklab(hex);
  if (!lab) return [0.5, 0, 0];
  return [lab.l, lab.a, lab.b];
}

/**
 * BackgroundRenderer renders screen-space backgrounds (solid, gradient in OKLab,
 * loop-safe drifting mesh gradient, ambient blurred screenshot, or image).
 */
export class BackgroundRenderer {
  private orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private orthoScene = new THREE.Scene();

  private solidMat: THREE.ShaderMaterial;
  private gradientMat: THREE.ShaderMaterial;
  private meshMat: THREE.ShaderMaterial;
  private ambientMat: THREE.ShaderMaterial;
  private quadMesh: THREE.Mesh;

  private ambientBlurTargets = new Map<string, THREE.WebGLRenderTarget>();

  constructor() {
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    this.solidMat = new THREE.ShaderMaterial({
      vertexShader: bgVertexShader,
      fragmentShader: solidFragmentShader,
      uniforms: {
        uPanOffset: { value: new THREE.Vector2(0, 0) },
        uColor: { value: new THREE.Color(0xf1ede6) },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.gradientMat = new THREE.ShaderMaterial({
      vertexShader: bgVertexShader,
      fragmentShader: gradientFragmentShader,
      uniforms: {
        uPanOffset: { value: new THREE.Vector2(0, 0) },
        uColor0Lab: { value: new THREE.Vector3(0.9, 0, 0) },
        uColor1Lab: { value: new THREE.Vector3(0.8, 0, 0) },
        uColor2Lab: { value: new THREE.Vector3(0.7, 0, 0) },
        uStopCount: { value: 2 },
        uAngleRad: { value: (135 * Math.PI) / 180 },
      },
      depthWrite: false,
      depthTest: false,
    });

    // Mesh points default coordinates
    const defaultPoints = [
      new THREE.Vector2(0.2, 0.2),
      new THREE.Vector2(0.8, 0.2),
      new THREE.Vector2(0.5, 0.5),
      new THREE.Vector2(0.2, 0.8),
      new THREE.Vector2(0.8, 0.8),
    ];

    this.meshMat = new THREE.ShaderMaterial({
      vertexShader: bgVertexShader,
      fragmentShader: meshFragmentShader,
      uniforms: {
        uPanOffset: { value: new THREE.Vector2(0, 0) },
        uColorsLab: {
          value: [
            new THREE.Vector3(0.2, 0, 0),
            new THREE.Vector3(0.3, 0, 0),
            new THREE.Vector3(0.4, 0, 0),
            new THREE.Vector3(0.5, 0, 0),
            new THREE.Vector3(0.6, 0, 0),
          ],
        },
        uPoints: { value: defaultPoints },
        uColorCount: { value: 4 },
        uPhase: { value: 0 },
        uDrift: { value: 0.05 },
        uAspect: { value: 16 / 9 },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.ambientMat = new THREE.ShaderMaterial({
      vertexShader: bgVertexShader,
      fragmentShader: ambientFragmentShader,
      uniforms: {
        uPanOffset: { value: new THREE.Vector2(0, 0) },
        map: { value: null },
        uDim: { value: 0.2 },
        uHasMap: { value: false },
        uFallbackColor: { value: new THREE.Vector3(0.08, 0.08, 0.1) },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.quadMesh = new THREE.Mesh(quadGeo, this.solidMat);
    this.orthoScene.add(this.quadMesh);
  }

  render(
    renderer: THREE.WebGLRenderer,
    renderTarget: THREE.WebGLRenderTarget,
    frame: ShotFrame,
    backgroundPhase = 0,
    textureManager?: TextureManager,
  ): void {
    const bg: Background = frame.style.background;
    const stageAspect = renderTarget.width / renderTarget.height;

    // Up to 2% subtle parallax following camera pan
    const panX = (frame.camera?.panX ?? 0) * 0.02;
    const panY = (frame.camera?.panY ?? 0) * 0.02;
    const panOffset = new THREE.Vector2(panX, panY);

    if (bg.kind === "solid") {
      this.solidMat.uniforms.uPanOffset.value.copy(panOffset);
      this.solidMat.uniforms.uColor.value.set(bg.color || "#F1EDE6");
      this.quadMesh.material = this.solidMat;
    } else if (bg.kind === "gradient") {
      this.gradientMat.uniforms.uPanOffset.value.copy(panOffset);
      const stops = bg.stops && bg.stops.length > 0 ? bg.stops : ["#F1EDE6", "#E3DCD0"];
      const lab0 = hexToOklab(stops[0]);
      const lab1 = hexToOklab(stops[1] ?? stops[0]);
      const lab2 = hexToOklab(stops[2] ?? stops[1] ?? stops[0]);

      this.gradientMat.uniforms.uColor0Lab.value.set(lab0[0], lab0[1], lab0[2]);
      this.gradientMat.uniforms.uColor1Lab.value.set(lab1[0], lab1[1], lab1[2]);
      this.gradientMat.uniforms.uColor2Lab.value.set(lab2[0], lab2[1], lab2[2]);
      this.gradientMat.uniforms.uStopCount.value = Math.min(3, stops.length);
      this.gradientMat.uniforms.uAngleRad.value = ((bg.angle ?? 135) * Math.PI) / 180;
      this.quadMesh.material = this.gradientMat;
    } else if (bg.kind === "mesh") {
      this.meshMat.uniforms.uPanOffset.value.copy(panOffset);
      const colors = bg.colors && bg.colors.length >= 3 ? bg.colors : ["#1B1B2F", "#3A2F4F", "#6B4E71", "#C3A6A0"];
      const count = Math.min(5, colors.length);

      for (let i = 0; i < 5; i++) {
        const hex = colors[i] ?? colors[count - 1];
        const lab = hexToOklab(hex);
        this.meshMat.uniforms.uColorsLab.value[i].set(lab[0], lab[1], lab[2]);
      }

      this.meshMat.uniforms.uColorCount.value = count;
      this.meshMat.uniforms.uPhase.value = backgroundPhase;
      this.meshMat.uniforms.uDrift.value = bg.drift ?? 0.05;
      this.meshMat.uniforms.uAspect.value = stageAspect;
      this.quadMesh.material = this.meshMat;
    } else if (bg.kind === "ambient" || bg.kind === "image") {
      this.ambientMat.uniforms.uPanOffset.value.copy(panOffset);
      const assetId = bg.assetId;
      const managed = assetId && textureManager ? textureManager.getLoadedTexture(assetId) : null;

      if (managed && managed.strips.length > 0) {
        this.ambientMat.uniforms.map.value = managed.strips[0].texture;
        this.ambientMat.uniforms.uHasMap.value = true;
        this.ambientMat.uniforms.uDim.value = bg.dim ?? 0.2;
      } else {
        this.ambientMat.uniforms.uHasMap.value = false;
        this.ambientMat.uniforms.uDim.value = bg.dim ?? 0.2;
      }
      this.quadMesh.material = this.ambientMat;
    }

    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(renderTarget);
    renderer.clear(true, true, true);
    renderer.render(this.orthoScene, this.orthoCamera);
    renderer.setRenderTarget(prevTarget);
  }

  dispose(): void {
    this.solidMat.dispose();
    this.gradientMat.dispose();
    this.meshMat.dispose();
    this.ambientMat.dispose();
    this.quadMesh.geometry.dispose();

    for (const rt of this.ambientBlurTargets.values()) {
      rt.dispose();
    }
    this.ambientBlurTargets.clear();
  }
}
