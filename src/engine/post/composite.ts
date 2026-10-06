import * as THREE from "three";
import type { Transition } from "../../doc/types";

// Blends the outgoing and incoming shot targets into one linear composite at the internal
// (supersampled) resolution. Vignette, sRGB encoding, grain and dither are left to the final
// pass, so motion blur can accumulate composites and still finish each frame exactly once.

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D mapA;
  uniform sampler2D mapB;
  uniform float weightA;
  uniform float weightB;
  uniform bool isTransition;
  uniform int transitionKind; // 0 = cut, 1 = fade, 2 = blur, 3 = push, 4 = zoom, 5 = wipe
  uniform float uTransitionProgress; // 0..1
  uniform int uTransitionDirection; // 0 = left, 1 = right, 2 = up, 3 = down
  uniform float uAspect;

  // Multi-tap blur for the blur transition
  vec4 sampleBlur(sampler2D tex, vec2 uv, float radius) {
    if (radius <= 0.0001) return texture2D(tex, uv);
    vec4 sum = vec4(0.0);
    float total = 0.0;
    for (float x = -2.0; x <= 2.0; x += 1.0) {
      for (float y = -2.0; y <= 2.0; y += 1.0) {
        float w = exp(-(x * x + y * y) / 2.0);
        vec2 offset = vec2(x, y) * radius * vec2(1.0 / uAspect, 1.0);
        sum += texture2D(tex, clamp(uv + offset, 0.0, 1.0)) * w;
        total += w;
      }
    }
    return sum / total;
  }

  void main() {
    vec4 color = texture2D(mapA, vUv);

    if (isTransition) {
      float p = clamp(uTransitionProgress, 0.0, 1.0);

      if (transitionKind == 1) {
        // Fade
        color = mix(texture2D(mapA, vUv), texture2D(mapB, vUv), p);
      } else if (transitionKind == 2) {
        // Blur (peaks at 1.2% frame height at p = 0.5)
        float blurR = (1.0 - 2.0 * abs(p - 0.5)) * 0.012;
        color = mix(sampleBlur(mapA, vUv, blurR), sampleBlur(mapB, vUv, blurR), p);
      } else if (transitionKind == 3) {
        // Push: outgoing slides out, incoming slides in without gap
        bool inIncoming = false;
        vec2 uvA = vUv;
        vec2 uvB = vUv;

        if (uTransitionDirection == 1) { // right
          inIncoming = vUv.x <= p;
          uvA = vUv - vec2(p, 0.0);
          uvB = vUv + vec2(1.0 - p, 0.0);
        } else if (uTransitionDirection == 2) { // up
          inIncoming = vUv.y >= 1.0 - p;
          uvA = vUv - vec2(0.0, p);
          uvB = vUv - vec2(0.0, p - 1.0);
        } else if (uTransitionDirection == 3) { // down
          inIncoming = vUv.y <= p;
          uvA = vUv + vec2(0.0, p);
          uvB = vUv + vec2(0.0, p - 1.0);
        } else { // left
          inIncoming = vUv.x >= 1.0 - p;
          uvA = vUv + vec2(p, 0.0);
          uvB = vUv - vec2(1.0 - p, 0.0);
        }

        color = inIncoming
          ? texture2D(mapB, clamp(uvB, 0.0, 1.0))
          : texture2D(mapA, clamp(uvA, 0.0, 1.0));
      } else if (transitionKind == 4) {
        // Zoom: incoming 1.06 -> 1, outgoing 1 -> 0.96 with fade
        float scaleA = mix(1.0, 0.96, p);
        float scaleB = mix(1.06, 1.0, p);
        vec2 uvA = (vUv - 0.5) / scaleA + 0.5;
        vec2 uvB = (vUv - 0.5) / scaleB + 0.5;
        color = mix(texture2D(mapA, clamp(uvA, 0.0, 1.0)), texture2D(mapB, clamp(uvB, 0.0, 1.0)), p);
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
        color = mix(texture2D(mapB, vUv), texture2D(mapA, vUv), factor);
      } else {
        // Cut or simple blend
        color = texture2D(mapA, vUv) * weightA + texture2D(mapB, vUv) * weightB;
      }
    }

    gl_FragColor = color;
  }
`;

export type TransitionState = {
  kind: Transition["kind"];
  progress: number;
  direction?: Transition["direction"];
};

const KIND_CODES: Record<Transition["kind"], number> = {
  cut: 0,
  fade: 1,
  blur: 2,
  push: 3,
  zoom: 4,
  wipe: 5,
};

const DIRECTION_CODES: Record<NonNullable<Transition["direction"]>, number> = {
  left: 0,
  right: 1,
  up: 2,
  down: 3,
};

/** Transition blend of two linear shot targets into one linear composite target. */
export class CompositePass {
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private scene = new THREE.Scene();
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;

  constructor(aspect: number) {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        mapA: { value: null },
        mapB: { value: null },
        weightA: { value: 1.0 },
        weightB: { value: 0.0 },
        isTransition: { value: false },
        transitionKind: { value: 0 },
        uTransitionProgress: { value: 0.0 },
        uTransitionDirection: { value: 0 },
        uAspect: { value: aspect },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(this.mesh);
  }

  setAspect(aspect: number): void {
    this.material.uniforms.uAspect.value = aspect;
  }

  render(
    renderer: THREE.WebGLRenderer,
    targetA: THREE.WebGLRenderTarget,
    targetB: THREE.WebGLRenderTarget,
    layers: { weight: number }[],
    transition: TransitionState | undefined,
    output: THREE.WebGLRenderTarget,
  ): void {
    const uniforms = this.material.uniforms;
    uniforms.mapA.value = targetA.texture;
    uniforms.mapB.value = targetB.texture;
    uniforms.weightA.value = layers[0]?.weight ?? 1.0;
    uniforms.weightB.value = layers[1]?.weight ?? 0.0;
    uniforms.isTransition.value = layers.length > 1 && layers[1].weight > 0;
    uniforms.transitionKind.value = transition ? KIND_CODES[transition.kind] : 0;
    uniforms.uTransitionProgress.value = transition?.progress ?? 0;
    uniforms.uTransitionDirection.value = transition?.direction
      ? DIRECTION_CODES[transition.direction]
      : 0;

    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(output);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(prevTarget);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
