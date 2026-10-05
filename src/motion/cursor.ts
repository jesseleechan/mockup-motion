import type { CursorSpec } from "../doc/types";
import { ease } from "./easing";

export interface EvaluatedCursor {
  x: number;
  y: number;
  scale: number;
  pressed: number;
  style: "arrow" | "pointer" | "dot";
  ripple?: {
    x: number;
    y: number;
    radius: number; // 0..0.032 as fraction of screen width
    opacity: number; // 0..0.35
  };
}

interface Point2D {
  x: number;
  y: number;
}

/**
 * Evaluates Catmull-Rom centripetal spline (alpha = 0.5) between P1 and P2.
 */
function catmullRomCentripetal(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  u: number,
): Point2D {
  if (u <= 0) return { x: p1.x, y: p1.y };
  if (u >= 1) return { x: p2.x, y: p2.y };

  const alpha = 0.5;

  function dist(a: Point2D, b: Point2D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.max(1e-4, Math.sqrt(dx * dx + dy * dy));
  }

  const d01 = Math.pow(dist(p0, p1), alpha);
  const d12 = Math.pow(dist(p1, p2), alpha);
  const d23 = Math.pow(dist(p2, p3), alpha);

  const t0 = 0;
  const t1 = t0 + d01;
  const t2 = t1 + d12;
  const t3 = t2 + d23;

  const t = t1 + u * (t2 - t1);

  // Barry and Goldman pyramidal formulation
  const a1x = ((t1 - t) * p0.x + (t - t0) * p1.x) / (t1 - t0);
  const a1y = ((t1 - t) * p0.y + (t - t0) * p1.y) / (t1 - t0);

  const a2x = ((t2 - t) * p1.x + (t - t1) * p2.x) / (t2 - t1);
  const a2y = ((t2 - t) * p1.y + (t - t1) * p2.y) / (t2 - t1);

  const a3x = ((t3 - t) * p2.x + (t - t2) * p3.x) / (t3 - t2);
  const a3y = ((t3 - t) * p2.y + (t - t2) * p3.y) / (t3 - t2);

  const b1x = ((t2 - t) * a1x + (t - t0) * a2x) / (t2 - t0);
  const b1y = ((t2 - t) * a1y + (t - t0) * a2y) / (t2 - t0);

  const b2x = ((t3 - t) * a2x + (t - t1) * a3x) / (t3 - t1);
  const b2y = ((t3 - t) * a2y + (t - t1) * a3y) / (t3 - t1);

  const cx = ((t2 - t) * b1x + (t - t1) * b2x) / (t2 - t1);
  const cy = ((t2 - t) * b1y + (t - t1) * b2y) / (t2 - t1);

  return { x: cx, y: cy };
}

/**
 * Pure evaluator for cursor position, press state, and click ripples.
 * Follows WP-15:
 * - Centripetal Catmull-Rom path through keys
 * - Arrival easing is expoOut
 * - Minimum travel time between keys is 0.45s
 * - Cursor rests at keys
 * - Click is 0.12s press (scale 0.9) with backOut
 * - Ripple: radius 0 -> 3.2% screen width, opacity 0.35 -> 0, duration 0.5s
 */
export function evaluateCursorMotion(
  spec: CursorSpec | undefined,
  localT: number,
): EvaluatedCursor | undefined {
  if (!spec || !spec.enabled || !spec.keys || spec.keys.length === 0) {
    return undefined;
  }

  const keys = [...spec.keys].sort((a, b) => a.t - b.t);
  const n = keys.length;
  const style = spec.style ?? "arrow";

  let pos: Point2D;

  if (n === 1) {
    pos = { x: keys[0].x, y: keys[0].y };
  } else if (localT <= keys[0].t) {
    pos = { x: keys[0].x, y: keys[0].y };
  } else if (localT >= keys[n - 1].t) {
    pos = { x: keys[n - 1].x, y: keys[n - 1].y };
  } else {
    // Find active segment [i, i+1]
    let segIdx = 0;
    for (let i = 0; i < n - 1; i++) {
      if (localT >= keys[i].t && localT < keys[i + 1].t) {
        segIdx = i;
        break;
      }
    }

    const k0 = segIdx > 0 ? keys[segIdx - 1] : { x: 2 * keys[0].x - keys[1].x, y: 2 * keys[0].y - keys[1].y };
    const k1 = keys[segIdx];
    const k2 = keys[segIdx + 1];
    const k3 = segIdx + 2 < n ? keys[segIdx + 2] : { x: 2 * k2.x - k1.x, y: 2 * k2.y - k1.y };

    const totalSegTime = k2.t - k1.t;
    // Minimum travel time is 0.45s; if segment is longer, travel takes 0.45s or 70% of segment, then cursor rests
    const travelTime = Math.min(totalSegTime, Math.max(0.45, totalSegTime * 0.7));

    const elapsed = localT - k1.t;
    if (elapsed >= travelTime) {
      // Cursor has arrived and is resting at k2
      pos = { x: k2.x, y: k2.y };
    } else {
      const linearP = Math.max(0, Math.min(1, elapsed / travelTime));
      const easedU = ease("expoOut", linearP);
      pos = catmullRomCentripetal(k0, k1, k2, k3, easedU);
    }
  }

  // Calculate click press and ripple
  let scale = 1.0;
  let pressed = 0;
  let activeRipple: EvaluatedCursor["ripple"] | undefined;

  for (const k of keys) {
    if (!k.click) continue;

    // Press animation (0.12s duration, scale drops to 0.90)
    if (localT >= k.t && localT < k.t + 0.12) {
      const pressP = (localT - k.t) / 0.12;
      const wave = Math.sin(pressP * Math.PI);
      const easedWave = ease("backOut", wave);
      scale = Math.min(scale, 1.0 - 0.1 * Math.max(0, Math.min(1.2, easedWave)));
      pressed = Math.max(pressed, easedWave);
    }

    // Ripple animation (0.5s duration, radius 0 -> 0.032, opacity 0.35 -> 0)
    if (localT >= k.t && localT < k.t + 0.5) {
      const ripP = (localT - k.t) / 0.5;
      const radius = 0.032 * ease("smooth", Math.max(0, Math.min(1, ripP)));
      const opacity = 0.35 * (1 - ripP);

      if (!activeRipple || opacity > activeRipple.opacity) {
        activeRipple = {
          x: k.x,
          y: k.y,
          radius,
          opacity,
        };
      }
    }
  }

  return {
    x: Math.max(0, Math.min(1, pos.x)),
    y: Math.max(0, Math.min(1, pos.y)),
    scale,
    pressed,
    style,
    ripple: activeRipple,
  };
}
