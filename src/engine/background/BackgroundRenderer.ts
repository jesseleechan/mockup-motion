import * as THREE from "three";
import { oklab } from "culori";
import type { Background } from "../../doc/types";
import type { ShotFrame } from "../../motion";

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
  vec3 oklab_to_linear_srgb(vec3 c) {
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

    return lrgb;
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
    vec2 dir = vec2(sin(uAngleRad), cos(uAngleRad));
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

    gl_FragColor = vec4(oklab_to_linear_srgb(lab), 1.0);
  }
`;

function hexToOklab(hex: string): [number, number, number] {
  const lab = oklab(hex);
  if (!lab) return [0.5, 0, 0];
  return [lab.l, lab.a, lab.b];
}

/**
 * BackgroundRenderer renders screen-space backgrounds: a solid or a gradient in OKLab.
 */
export class BackgroundRenderer {
  private orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private orthoScene = new THREE.Scene();

  private solidMat: THREE.ShaderMaterial;
  private gradientMat: THREE.ShaderMaterial;
  private quadMesh: THREE.Mesh;
  private panOffset = new THREE.Vector2();

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
        uAngleRad: { value: (315 * Math.PI) / 180 },
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
  ): void {
    const bg: Background = frame.style.background;

    // Up to 2% subtle parallax following camera pan
    const panX = (frame.camera?.panX ?? 0) * 0.02;
    const panY = (frame.camera?.panY ?? 0) * 0.02;
    const panOffset = this.panOffset.set(panX, panY);

    if (bg.kind === "solid") {
      this.solidMat.uniforms.uPanOffset.value.copy(panOffset);
      this.solidMat.uniforms.uColor.value.set(bg.color || "#F1EDE6");
      this.quadMesh.material = this.solidMat;
    } else {
      this.gradientMat.uniforms.uPanOffset.value.copy(panOffset);
      const stops = bg.stops && bg.stops.length > 0 ? bg.stops : ["#F1EDE6", "#E3DCD0"];
      const lab0 = hexToOklab(stops[0]);
      const lab1 = hexToOklab(stops[1] ?? stops[0]);
      const lab2 = hexToOklab(stops[2] ?? stops[1] ?? stops[0]);

      this.gradientMat.uniforms.uColor0Lab.value.set(lab0[0], lab0[1], lab0[2]);
      this.gradientMat.uniforms.uColor1Lab.value.set(lab1[0], lab1[1], lab1[2]);
      this.gradientMat.uniforms.uColor2Lab.value.set(lab2[0], lab2[1], lab2[2]);
      this.gradientMat.uniforms.uStopCount.value = Math.min(3, stops.length);
      this.gradientMat.uniforms.uAngleRad.value = ((bg.angle ?? 315) * Math.PI) / 180;
      this.quadMesh.material = this.gradientMat;
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
    this.quadMesh.geometry.dispose();
  }
}
