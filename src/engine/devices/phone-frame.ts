import * as THREE from "three";
import type { DeviceFinish } from "../../doc/types";

/**
 * Phone frame colours, after the iPhone Pro finishes (quality-bar §3.3). The finish names are
 * the document's; the colours are Black Titanium, a deeper black, Silver and Desert Titanium.
 */
export const PHONE_FINISH_COLORS: Record<DeviceFinish, string> = {
  graphite: "#45454A",
  black: "#232326",
  silver: "#D9DADC",
  sand: "#C2A78F",
};

const vertexShader = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The metal band seen from the front: a rounded edge that catches light on its outer half and
// falls into a dark seam where it meets the glass, lit a little more from the top-left.
// Outputs linear colour, like every custom shader (CLAUDE.md, colour pipeline).
const fragmentShader = /* glsl */ `
  varying vec2 vPos;
  uniform vec2 uHalfSize;
  uniform float uRadius;
  uniform float uRing;
  uniform vec3 uColor;

  float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + vec2(r);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  void main() {
    float d = sdRoundedBox(vPos, uHalfSize, uRadius);
    float w = max(fwidth(d), 1e-6);
    float outer = 1.0 - smoothstep(-w, w, d);
    if (outer <= 0.001 || d < -uRing - w) discard;

    // 0 at the outer edge, 1 at the seam with the glass.
    float t = clamp(-d / uRing, 0.0, 1.0);
    float band = 0.78 + 0.42 * exp(-pow((t - 0.35) / 0.22, 2.0));
    float seam = 1.0 - 0.55 * smoothstep(0.82, 1.0, t);
    vec2 n = vPos / uHalfSize;
    float light = 0.92 + 0.12 * dot(normalize(n + 1e-6), normalize(vec2(-1.0, 1.0)));
    gl_FragColor = vec4(uColor * band * seam * light, outer);
  }
`;

/** The front-facing metal frame: a ring `ring` wide inside the body outline. */
export function createPhoneFrameRing(
  width: number,
  height: number,
  radius: number,
  ring: number,
  finish: DeviceFinish,
): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uHalfSize: { value: new THREE.Vector2(width / 2, height / 2) },
      uRadius: { value: radius },
      uRing: { value: ring },
      uColor: { value: new THREE.Color(PHONE_FINISH_COLORS[finish]) },
    },
    transparent: true,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.raycast = () => {};
  return mesh;
}
