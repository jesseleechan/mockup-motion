import * as THREE from "three";
import type { Style } from "../../doc/types";

// Render targets hold linear-light sRGB-primaries values (sRGB byte targets
// encode on write and decode on sampling). Only this final pass explicitly
// converts to sRGB; grain and dither follow that conversion. No colorspace include.
// Its input is one linear composite (CompositePass output or the motion-blur
// accumulation), so every frame is finished exactly once.

const finalVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const finalFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D map;

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

  vec3 linearToSrgb(vec3 c) {
    c = max(c, vec3(0.0));
    return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,
      12.92 * c, lessThanEqual(c, vec3(0.0031308)));
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
    vec3 color = sampleDownsampled(map, vUv, uTexelSize).rgb;

    // 2. Elliptical vignette (aspect-correct, Style.vignette 0-12%, default 6%)
    if (uVignette > 0.0) {
      vec2 coord = (vUv - 0.5) * vec2(uAspect, 1.0);
      float dist = length(coord);
      float vig = smoothstep(0.4, 0.95, dist);
      // Darkens corners up to uVignette (max 12%)
      color = mix(color, color * (1.0 - uVignette), vig);
    }

    color = linearToSrgb(color);

    // Monochrome zero-mean grain: peak amplitude 1.5–4%, 2.5% at 0.25 (§5).
    if (uGrain > 0.0) {
      float g = clamp(uGrain, 0.0, 1.0);
      float grainAmp = g <= 0.25 ? mix(0.015, 0.025, g / 0.25)
        : mix(0.025, 0.04, (g - 0.25) / 0.75);
      vec2 seedCoord = gl_FragCoord.xy + vec2(uFrameSeed * 17.13, uFrameSeed * 31.41);
      float noise = hash1(seedCoord) * 2.0 - 1.0;
      color += vec3(noise * grainAmp);
    }

    // 4. Triangular dither (±0.5 LSB before 8-bit quantization to prevent H.264 banding)
    float d1 = hash1(gl_FragCoord.xy + vec2(0.1, 0.3));
    float d2 = hash1(gl_FragCoord.xy + vec2(0.7, 0.9));
    float triangularDither = (d1 + d2 - 1.0) * (0.5 / 255.0);
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
 * Final post-processing pass: 13-tap downsample -> aspect-correct vignette -> sRGB ->
 * monochrome grain -> triangular dither. Transitions are blended earlier (CompositePass).
 */
export class FinalPass {
  private camera: THREE.OrthographicCamera;
  private scene: THREE.Scene;
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;

  constructor(opts: FinalPassOptions) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();

    const ss = opts.supersample || 1;
    const internalW = Math.round(opts.width * ss);
    const internalH = Math.round(opts.height * ss);

    this.material = new THREE.ShaderMaterial({
      vertexShader: finalVertexShader,
      fragmentShader: finalFragmentShader,
      uniforms: {
        map: { value: null },
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
    const internalW = Math.round(width * supersample);
    const internalH = Math.round(height * supersample);

    this.material.uniforms.uSupersample.value = supersample;
    this.material.uniforms.uTexelSize.value.set(1 / internalW, 1 / internalH);
    this.material.uniforms.uAspect.value = width / height;
  }

  /** Finishes the linear composite in `source` into `outputTarget` (null: the canvas). */
  render(
    renderer: THREE.WebGLRenderer,
    source: THREE.WebGLRenderTarget,
    style: Style,
    t: number,
    outputTarget: THREE.WebGLRenderTarget | null = null,
  ): void {
    this.material.uniforms.map.value = source.texture;

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
