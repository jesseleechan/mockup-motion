import * as THREE from "three";
import type { Transition } from "../../doc/types";

// Blends the outgoing and incoming layers of the loop wrap into one linear composite at the internal
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
  uniform bool isFade;
  uniform float uTransitionProgress; // 0..1

  void main() {
    vec4 color = texture2D(mapA, vUv);

    if (isTransition) {
      if (isFade) {
        color = mix(texture2D(mapA, vUv), texture2D(mapB, vUv), clamp(uTransitionProgress, 0.0, 1.0));
      } else {
        color = texture2D(mapA, vUv) * weightA + texture2D(mapB, vUv) * weightB;
      }
    }

    gl_FragColor = color;
  }
`;

export type TransitionState = {
  kind: Transition["kind"];
  progress: number;
};

/**
 * The loop wrap crossfade: blends the outgoing and incoming linear shot targets into one linear
 * composite target (contracts.md §5).
 */
export class CompositePass {
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private scene = new THREE.Scene();
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        mapA: { value: null },
        mapB: { value: null },
        weightA: { value: 1.0 },
        weightB: { value: 0.0 },
        isTransition: { value: false },
        isFade: { value: false },
        uTransitionProgress: { value: 0.0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(this.mesh);
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
    uniforms.isFade.value = transition?.kind === "fade";
    uniforms.uTransitionProgress.value = transition?.progress ?? 0;

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
