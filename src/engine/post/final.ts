import * as THREE from "three";
import type { Style, Transition } from "../../doc/types";

// Render targets hold linear-light sRGB-primaries values (sRGB byte targets
// encode on write and decode on sampling). Only this final pass explicitly
// converts to sRGB; grain and dither follow that conversion. No colorspace include.

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
  uniform int transitionKind; // 0 = cut, 1 = fade, 2 = blur, 3 = push, 4 = zoom, 5 = wipe
  uniform float uTransitionProgress; // 0..1
  uniform int uTransitionDirection; // 0 = left, 1 = right, 2 = up, 3 = down

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

  // Multi-tap blur for the blur transition
  vec4 sampleBlur(sampler2D tex, vec2 uv, float radius) {
    if (radius <= 0.0001) return sampleDownsampled(tex, uv, uTexelSize);
    vec4 sum = vec4(0.0);
    float total = 0.0;
    for (float x = -2.0; x <= 2.0; x += 1.0) {
      for (float y = -2.0; y <= 2.0; y += 1.0) {
        float w = exp(-(x * x + y * y) / 2.0);
        vec2 offset = vec2(x, y) * radius * vec2(1.0 / uAspect, 1.0);
        sum += sampleDownsampled(tex, clamp(uv + offset, 0.0, 1.0), uTexelSize) * w;
        total += w;
      }
    }
    return sum / total;
  }

  void main() {
    vec4 baseColor = sampleDownsampled(mapA, vUv, uTexelSize);

    if (isTransition) {
      float p = clamp(uTransitionProgress, 0.0, 1.0);

      if (transitionKind == 1) {
        // Fade
        vec4 colA = sampleDownsampled(mapA, vUv, uTexelSize);
        vec4 colB = sampleDownsampled(mapB, vUv, uTexelSize);
        baseColor = mix(colA, colB, p);
      } else if (transitionKind == 2) {
        // Blur (peaks at 1.2% frame height at p = 0.5)
        float blurR = (1.0 - 2.0 * abs(p - 0.5)) * 0.012;
        vec4 bA = sampleBlur(mapA, vUv, blurR);
        vec4 bB = sampleBlur(mapB, vUv, blurR);
        baseColor = mix(bA, bB, p);
      } else if (transitionKind == 3) {
        // Push: outgoing slides out, incoming slides in without gap
        vec2 dir = vec2(-1.0, 0.0); // left default
        bool inIncoming = false;
        vec2 uvA = vUv;
        vec2 uvB = vUv;

        if (uTransitionDirection == 1) { // right
          dir = vec2(1.0, 0.0);
          inIncoming = vUv.x <= p;
          uvA = vUv - vec2(p, 0.0);
          uvB = vUv + vec2(1.0 - p, 0.0);
        } else if (uTransitionDirection == 2) { // up
          dir = vec2(0.0, 1.0);
          inIncoming = vUv.y >= 1.0 - p;
          uvA = vUv - vec2(0.0, p);
          uvB = vUv - vec2(0.0, p - 1.0);
        } else if (uTransitionDirection == 3) { // down
          dir = vec2(0.0, -1.0);
          inIncoming = vUv.y <= p;
          uvA = vUv + vec2(0.0, p);
          uvB = vUv + vec2(0.0, p - 1.0);
        } else { // left
          inIncoming = vUv.x >= 1.0 - p;
          uvA = vUv + vec2(p, 0.0);
          uvB = vUv - vec2(1.0 - p, 0.0);
        }

        if (inIncoming) {
          baseColor = sampleDownsampled(mapB, clamp(uvB, 0.0, 1.0), uTexelSize);
        } else {
          baseColor = sampleDownsampled(mapA, clamp(uvA, 0.0, 1.0), uTexelSize);
        }
      } else if (transitionKind == 4) {
        // Zoom: incoming 1.06 -> 1, outgoing 1 -> 0.96 with fade
        float scaleA = mix(1.0, 0.96, p);
        float scaleB = mix(1.06, 1.0, p);
        vec2 uvA = (vUv - 0.5) / scaleA + 0.5;
        vec2 uvB = (vUv - 0.5) / scaleB + 0.5;
        vec4 zA = sampleDownsampled(mapA, clamp(uvA, 0.0, 1.0), uTexelSize);
        vec4 zB = sampleDownsampled(mapB, clamp(uvB, 0.0, 1.0), uTexelSize);
        baseColor = mix(zA, zB, p);
      } else if (transitionKind == 5) {
        // Wipe: soft diagonal mask, 6% feather
        float feather = 0.06;
        float d = (vUv.x + (1.0 - vUv.y)) * 0.5; // diagonal
        if (uTransitionDirection == 0) d = vUv.x;
        else if (uTransitionDirection == 1) d = 1.0 - vUv.x;
        else if (uTransitionDirection == 2) d = 1.0 - vUv.y;
        else if (uTransitionDirection == 3) d = vUv.y;

        float edge = p * (1.0 + feather * 2.0) - feather;
        float factor = smoothstep(edge - feather, edge + feather, d);

        vec4 colA = sampleDownsampled(mapA, vUv, uTexelSize);
        vec4 colB = sampleDownsampled(mapB, vUv, uTexelSize);
        baseColor = mix(colB, colA, factor);
      } else {
        // Cut or simple blend
        vec4 colA = sampleDownsampled(mapA, vUv, uTexelSize);
        vec4 colB = sampleDownsampled(mapB, vUv, uTexelSize);
        baseColor = colA * weightA + colB * weightB;
      }
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
 * Final post-processing pass: transition blend (cut, fade, blur, push, zoom, wipe) ->
 * 13-tap downsample -> aspect-correct vignette -> monochrome grain -> triangular dither.
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
        uTransitionProgress: { value: 0.0 },
        uTransitionDirection: { value: 0 },
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
    transition?: {
      kind: Transition["kind"];
      progress: number;
      direction?: Transition["direction"];
    },
    outputTarget: THREE.WebGLRenderTarget | null = null,
  ): void {
    const isTransition = layers.length > 1 && layers[1].weight > 0;

    this.material.uniforms.mapA.value = targetA.texture;
    this.material.uniforms.mapB.value = targetB.texture;
    this.material.uniforms.weightA.value = layers[0]?.weight ?? 1.0;
    this.material.uniforms.weightB.value = layers[1]?.weight ?? 0.0;
    this.material.uniforms.isTransition.value = isTransition;

    let kindCode = 0;
    if (transition) {
      switch (transition.kind) {
        case "fade":
          kindCode = 1;
          break;
        case "blur":
          kindCode = 2;
          break;
        case "push":
          kindCode = 3;
          break;
        case "zoom":
          kindCode = 4;
          break;
        case "wipe":
          kindCode = 5;
          break;
        case "cut":
        default:
          kindCode = 0;
          break;
      }
    }
    this.material.uniforms.transitionKind.value = kindCode;
    this.material.uniforms.uTransitionProgress.value = transition?.progress ?? 0;

    let dirCode = 0;
    if (transition?.direction) {
      switch (transition.direction) {
        case "right":
          dirCode = 1;
          break;
        case "up":
          dirCode = 2;
          break;
        case "down":
          dirCode = 3;
          break;
        case "left":
        default:
          dirCode = 0;
          break;
      }
    }
    this.material.uniforms.uTransitionDirection.value = dirCode;

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
