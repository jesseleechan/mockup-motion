import type { EasingId } from "../doc/types";

interface BezierCurve {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const BEZIER_PRESETS: Record<Exclude<EasingId, "linear" | "spring">, BezierCurve> = {
  // gentle: cubic-bezier(0.37, 0, 0.63, 1) (sine in-out)
  gentle: { x1: 0.37, y1: 0, x2: 0.63, y2: 1 },
  // smooth: cubic-bezier(0.65, 0, 0.35, 1) (cubic in-out)
  smooth: { x1: 0.65, y1: 0, x2: 0.35, y2: 1 },
  // expoOut: cubic-bezier(0.16, 1, 0.3, 1)
  expoOut: { x1: 0.16, y1: 1, x2: 0.3, y2: 1 },
  // quintInOut: cubic-bezier(0.83, 0, 0.17, 1)
  quintInOut: { x1: 0.83, y1: 0, x2: 0.17, y2: 1 },
  // backOut: cubic-bezier(0.34, 1.30, 0.64, 1) (overshoot <= 3%)
  backOut: { x1: 0.34, y1: 1.3, x2: 0.64, y2: 1 },
  // slide: cubic-bezier(0.40, 0, 0.05, 1), fitted to the reference slider steps
  // (docs/presets-plan/reference.md, max error 0.017). Short ease-in, long soft settle.
  slide: { x1: 0.4, y1: 0, x2: 0.05, y2: 1 },
};

function sampleBezierX(t: number, x1: number, x2: number): number {
  const oneMinusT = 1 - t;
  return 3 * oneMinusT * oneMinusT * t * x1 + 3 * oneMinusT * t * t * x2 + t * t * t;
}

function sampleBezierY(t: number, y1: number, y2: number): number {
  const oneMinusT = 1 - t;
  return 3 * oneMinusT * oneMinusT * t * y1 + 3 * oneMinusT * t * t * y2 + t * t * t;
}

function sampleBezierDerivativeX(t: number, x1: number, x2: number): number {
  const oneMinusT = 1 - t;
  return 3 * oneMinusT * oneMinusT * x1 + 6 * oneMinusT * t * (x2 - x1) + 3 * t * t * (1 - x2);
}

function solveCubicBezier(x: number, curve: BezierCurve): number {
  const { x1, y1, x2, y2 } = curve;

  // 8 Newton-Raphson iterations achieves machine epsilon precision (< 1e-15)
  // on smooth monotonic cubic bezier curves without branching.
  let t = x;
  for (let i = 0; i < 8; i++) {
    const currentX = sampleBezierX(t, x1, x2);
    const dX = sampleBezierDerivativeX(t, x1, x2);
    t -= (currentX - x) / dX;
  }

  return sampleBezierY(t, y1, y2);
}

// Analytic damped spring parameters (zeta = 0.85, settles at p = 1 in 0.9 s)
const ZETA = 0.85;
const OMEGA_D = 2 * Math.PI;
const SQRT_1_MINUS_ZETA_SQ = Math.sqrt(1 - ZETA * ZETA);
const OMEGA_N = OMEGA_D / SQRT_1_MINUS_ZETA_SQ;
const ZETA_OMEGA_N = ZETA * OMEGA_N;
const SIN_COEFF = ZETA / SQRT_1_MINUS_ZETA_SQ;
// Value of unnormalized response at p = 1:
const F_ONE = 1 - Math.exp(-ZETA_OMEGA_N) * (Math.cos(OMEGA_D) + SIN_COEFF * Math.sin(OMEGA_D));

function springEase(p: number): number {
  const decay = Math.exp(-ZETA_OMEGA_N * p);
  const osc = Math.cos(OMEGA_D * p) + SIN_COEFF * Math.sin(OMEGA_D * p);
  const raw = 1 - decay * osc;
  return raw / F_ONE;
}

/**
 * Evaluate an easing function at normalized progress p (0..1).
 * Guarantees ease(0) = 0 and ease(1) = 1 for all curves.
 */
export function ease(id: EasingId, p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;

  switch (id) {
    case "linear":
      return p;
    case "spring":
      return springEase(p);
    case "gentle":
    case "smooth":
    case "expoOut":
    case "quintInOut":
    case "backOut":
    case "slide":
      return solveCubicBezier(p, BEZIER_PRESETS[id]);
  }
}
