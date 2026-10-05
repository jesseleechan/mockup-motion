import * as THREE from "three";
import { shadowTintFor } from "../../doc/palettes";
import type { ShadowPreset, Style } from "../../doc/types";

export interface ShadowParameters {
  contactBlur: number;
  contactOpacity: number;
  contactOffsetY: number;
  ambientBlur: number;
  ambientOpacity: number;
  ambientOffsetY: number;
}

/**
 * Maps Style.shadow preset to exact parameters per quality-bar §5.
 * Measurements in stage units (frame height = 1).
 */
export function getShadowParameters(preset: ShadowPreset): ShadowParameters {
  // Quality-bar §5: Contact: blur 0.6%, opacity 0.22, offset y -0.25%
  const contact = {
    contactBlur: 0.006,
    contactOpacity: preset === "none" ? 0 : 0.22,
    contactOffsetY: -0.0025,
  };

  switch (preset) {
    case "none":
      return {
        ...contact,
        ambientBlur: 0,
        ambientOpacity: 0,
        ambientOffsetY: 0,
      };
    case "soft":
      // blur 6%, opacity 0.10, offset y -2.5%
      return {
        ...contact,
        ambientBlur: 0.06,
        ambientOpacity: 0.1,
        ambientOffsetY: -0.025,
      };
    case "medium":
      // blur 8%, opacity 0.16, offset y -3.5%
      return {
        ...contact,
        ambientBlur: 0.08,
        ambientOpacity: 0.16,
        ambientOffsetY: -0.035,
      };
    case "dramatic":
      // blur 11%, opacity 0.24, offset y -5.0%
      return {
        ...contact,
        ambientBlur: 0.11,
        ambientOpacity: 0.24,
        ambientOffsetY: -0.05,
      };
  }
}

const shadowVertexShader = /* glsl */ `
  varying vec2 vLocalPos;
  void main() {
    vLocalPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const shadowFragmentShader = /* glsl */ `
  varying vec2 vLocalPos;
  uniform vec2 uHalfSize;
  uniform float uRadius;
  uniform float uSigma;
  uniform vec3 uColor;
  uniform float uOpacity;

  // Closed-form approximation of erf(x) (Winitzki / Abramowitz & Stegun, error < 1.5e-7)
  float erf(float x) {
    float s = sign(x);
    float a = abs(x);
    float x2 = a * a;
    float p = 1.0 + 0.278393 * a + 0.230389 * x2 + 0.000972 * a * x2 + 0.078108 * x2 * x2;
    return s * (1.0 - 1.0 / (p * p * p * p));
  }

  // 1D Gaussian integral of box [-half, half]
  float gaussianBox1D(float x, float halfSize, float sigma) {
    float invSigmaSqrt2 = 1.0 / (max(0.00005, sigma) * 1.41421356);
    return 0.5 * (erf((x + halfSize) * invSigmaSqrt2) - erf((x - halfSize) * invSigmaSqrt2));
  }

  // 2D analytic rounded rectangle shadow
  float shadowRoundedBox(vec2 p, vec2 halfSize, float r, float sigma) {
    vec2 innerHalf = max(vec2(0.0), halfSize - vec2(r));
    vec2 d = abs(p) - innerHalf;

    if (d.x > 0.0 && d.y > 0.0) {
      // Corner region
      float dist = length(d);
      float invSigmaSqrt2 = 1.0 / (max(0.00005, sigma) * 1.41421356);
      return 0.5 * (1.0 - erf((dist - r) * invSigmaSqrt2));
    } else {
      // Axial region
      float bx = gaussianBox1D(p.x, halfSize.x, sigma);
      float by = gaussianBox1D(p.y, halfSize.y, sigma);
      return bx * by;
    }
  }

  void main() {
    float s = shadowRoundedBox(vLocalPos, uHalfSize, uRadius, uSigma);
    float alpha = s * uOpacity;
    if (alpha <= 0.001) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

/**
 * Creates a two-layer analytic soft shadow (contact + ambient) for a device.
 * Closed-form Gaussian approximation evaluated in shader with no shadow maps.
 */
export class DeviceShadowGroup {
  readonly group = new THREE.Group();

  private contactMesh: THREE.Mesh;
  private ambientMesh: THREE.Mesh;
  private contactMat: THREE.ShaderMaterial;
  private ambientMat: THREE.ShaderMaterial;
  private contactGeo: THREE.PlaneGeometry;
  private ambientGeo: THREE.PlaneGeometry;

  private width: number;
  private height: number;
  private radius: number;

  constructor(width: number, height: number, radius: number) {
    this.width = width;
    this.height = height;
    this.radius = radius;

    // Contact shadow quad
    const maxContactSigma = 0.01;
    this.contactGeo = new THREE.PlaneGeometry(
      width + maxContactSigma * 8,
      height + maxContactSigma * 8,
    );
    this.contactMat = new THREE.ShaderMaterial({
      vertexShader: shadowVertexShader,
      fragmentShader: shadowFragmentShader,
      uniforms: {
        uHalfSize: { value: new THREE.Vector2(width / 2, height / 2) },
        uRadius: { value: radius },
        uSigma: { value: 0.006 },
        uColor: { value: new THREE.Color(0x151518) },
        uOpacity: { value: 0.22 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    this.contactMesh = new THREE.Mesh(this.contactGeo, this.contactMat);
    // Sits just behind device
    this.contactMesh.position.set(0, -0.0025, -0.001);
    this.group.add(this.contactMesh);

    // Ambient shadow quad
    const maxAmbientSigma = 0.15;
    this.ambientGeo = new THREE.PlaneGeometry(
      width + maxAmbientSigma * 8,
      height + maxAmbientSigma * 8,
    );
    this.ambientMat = new THREE.ShaderMaterial({
      vertexShader: shadowVertexShader,
      fragmentShader: shadowFragmentShader,
      uniforms: {
        uHalfSize: { value: new THREE.Vector2(width / 2, height / 2) },
        uRadius: { value: radius },
        uSigma: { value: 0.08 },
        uColor: { value: new THREE.Color(0x151518) },
        uOpacity: { value: 0.16 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    this.ambientMesh = new THREE.Mesh(this.ambientGeo, this.ambientMat);
    // Sits slightly further back behind contact shadow
    this.ambientMesh.position.set(0, -0.035, -0.002);
    this.group.add(this.ambientMesh);
  }

  update(style: Style): void {
    const params = getShadowParameters(style.shadow ?? "soft");
    const tintHex = shadowTintFor(style.background);
    const color = new THREE.Color(tintHex);

    // Update contact
    this.contactMat.uniforms.uSigma.value = params.contactBlur;
    this.contactMat.uniforms.uOpacity.value = params.contactOpacity;
    this.contactMat.uniforms.uColor.value.copy(color);
    this.contactMesh.position.y = params.contactOffsetY;
    this.contactMesh.visible = params.contactOpacity > 0;

    // Update ambient
    this.ambientMat.uniforms.uSigma.value = params.ambientBlur;
    this.ambientMat.uniforms.uOpacity.value = params.ambientOpacity;
    this.ambientMat.uniforms.uColor.value.copy(color);
    this.ambientMesh.position.y = params.ambientOffsetY;
    this.ambientMesh.visible = params.ambientOpacity > 0;
  }

  dispose(): void {
    this.contactGeo.dispose();
    this.contactMat.dispose();
    this.ambientGeo.dispose();
    this.ambientMat.dispose();
  }
}
