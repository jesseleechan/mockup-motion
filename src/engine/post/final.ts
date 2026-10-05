import * as THREE from "three";
import type { Style, Transition } from "../../doc/types";

const finalVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const finalFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D mapA;
  uniform sampler2D mapB;
  uniform float weightA;
  uniform float weightB;
  uniform bool isTransition;
  uniform int transitionKind; // 0 = cut, 1 = fade

  uniform float uSupersample;
  uniform vec2 uTexelSize;
  uniform float uAspect;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uFrameSeed;

  // PRNG
  float hash1(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  // 13-tap Jimenez downsample filter
  vec4 sampleDownsampled(sampler2D tex, vec2 uv, vec2 texelSize) {
    if (uSupersample <= 1.0) {
      return texture2D(tex, uv);
    } else {
      vec2 d = texelSize;

      // Center tap
      vec4 col = texture2D(tex, uv) * 0.5;

      // 4 Corner box samples (0.5 * 0.25 = 0.125 total weight)
      vec4 corner = (
        texture2D(tex, uv + vec2(-d.x, -d.y)) +
        texture2D(tex, uv + vec2( d.x, -d.y)) +
        texture2D(tex, uv + vec2(-d.x,  d.y)) +
        texture2D(tex, uv + vec2( d.x,  d.y))
      ) * 0.0625;

      // 4 Edge box samples (0.5 * 0.25 = 0.125 total weight)
      vec4 edge = (
        texture2D(tex, uv + vec2(-d.x, 0.0)) +
        texture2D(tex, uv + vec2( d.x, 0.0)) +
        texture2D(tex, uv + vec2(0.0, -d.y)) +
        texture2D(tex, uv + vec2(0.0,  d.y))
      ) * 0.0625;

      return col + corner + edge;
    }
  }

  void main() {
    // 1. Transition blend
    vec4 colA = sampleDownsampled(mapA, vUv, uTexelSize);
    vec4 baseColor = colA;

    if (isTransition) {
      vec4 colB = sampleDownsampled(mapB, vUv, uTexelSize);
      baseColor = colA * weightA + colB * weightB;
    }

    vec3 color = baseColor.rgb;

    // 2. Elliptical vignette (aspect-correct, Style.vignette 0-12%, default 6%)
    if (uVignette > 0.0) {
      vec2 coord = (vUv - 0.5) * vec2(uAspect, 1.0);
      float dist = length(coord);
      float vig = smoothstep(0.4, 0.95, dist);
      // Darkens corners up to uVignette (max 12%)
      color = mix(color, color * (1.0 - uVignette), vig);
    }

    // 3. Monochrome grain (1.5-4% amplitude, seeded per frame index)
    if (uGrain > 0.0) {
      float grainAmp = mix(0.015, 0.04, uGrain);
      vec2 seedCoord = gl_FragCoord.xy + vec2(uFrameSeed * 17.13, uFrameSeed * 31.41);
      float noise = hash1(seedCoord) - 0.5;
      color += vec3(noise * grainAmp);
    }

    // 4. Triangular dither (±0.5 LSB before 8-bit quantization to prevent H.264 banding)
    float d1 = hash1(gl_FragCoord.xy + vec2(0.1, 0.3));
    float d2 = hash1(gl_FragCoord.xy + vec2(0.7, 0.9));
    float triangularDither = (d1 + d2 - 1.0) / 255.0;
    color += vec3(triangularDither);

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

export interface FinalPassOptions {
  width: number;
  height: number;
  supersample: number;
}

/**
 * Final post-processing pass: transition blend -> 13-tap downsample ->
 * aspect-correct vignette -> monochrome grain -> triangular dither.
 */
export class FinalPass {
  private camera: THREE.OrthographicCamera;
  private scene: THREE.Scene;
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;

  private width: number;
  private height: number;
  private supersample: number;

  constructor(opts: FinalPassOptions) {
    this.width = opts.width;
    this.height = opts.height;
    this.supersample = opts.supersample;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();

    const ss = opts.supersample || 1;
    const internalW = Math.round(opts.width * ss);
    const internalH = Math.round(opts.height * ss);

    this.material = new THREE.ShaderMaterial({
      vertexShader: finalVertexShader,
      fragmentShader: finalFragmentShader,
      uniforms: {
        mapA: { value: null },
        mapB: { value: null },
        weightA: { value: 1.0 },
        weightB: { value: 0.0 },
        isTransition: { value: false },
        transitionKind: { value: 0 },
        uSupersample: { value: ss },
        uTexelSize: { value: new THREE.Vector2(1 / internalW, 1 / internalH) },
        uAspect: { value: opts.width / opts.height },
        uVignette: { value: 0.06 },
        uGrain: { value: 0.25 },
        uFrameSeed: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    const quad = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(quad, this.material);
    this.scene.add(this.mesh);
  }

  resize(width: number, height: number, supersample: number): void {
    this.width = width;
    this.height = height;
    this.supersample = supersample;

    const internalW = Math.round(width * supersample);
    const internalH = Math.round(height * supersample);

    this.material.uniforms.uSupersample.value = supersample;
    this.material.uniforms.uTexelSize.value.set(1 / internalW, 1 / internalH);
    this.material.uniforms.uAspect.value = width / height;
  }

  render(
    renderer: THREE.WebGLRenderer,
    targetA: THREE.WebGLRenderTarget,
    targetB: THREE.WebGLRenderTarget,
    style: Style,
    t: number,
    layers: { weight: number }[],
    transition?: { kind: Transition["kind"]; progress: number },
    outputTarget: THREE.WebGLRenderTarget | null = null,
  ): void {
    const isTransition = layers.length > 1 && layers[1].weight > 0;

    this.material.uniforms.mapA.value = targetA.texture;
    this.material.uniforms.mapB.value = targetB.texture;
    this.material.uniforms.weightA.value = layers[0]?.weight ?? 1.0;
    this.material.uniforms.weightB.value = layers[1]?.weight ?? 0.0;
    this.material.uniforms.isTransition.value = isTransition;
    this.material.uniforms.transitionKind.value = transition?.kind === "fade" ? 1 : 0;

    // Quality-bar values
    this.material.uniforms.uVignette.value = style.vignette ?? 0.06;
    this.material.uniforms.uGrain.value = style.grain ?? 0.25;

    // Seed grain per frame index (seeded by hash(round(t * 120)))
    const frameIndex = Math.round(t * 120);
    this.material.uniforms.uFrameSeed.value = (frameIndex * 2654435761) % 10000;

    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(outputTarget);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(prevTarget);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
