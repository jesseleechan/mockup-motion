import { describe, it, expect } from "vitest";
import { evaluateCursorMotion } from "../src/motion/cursor";
import type { CursorSpec } from "../src/doc/types";

describe("WP-15: Cursor Motion Evaluator (src/motion/cursor.ts)", () => {
  it("returns undefined when cursor is disabled or has no keys", () => {
    expect(evaluateCursorMotion(undefined, 0)).toBeUndefined();
    expect(
      evaluateCursorMotion({ enabled: false, style: "arrow", keys: [{ t: 0, x: 0.5, y: 0.5 }] }, 0),
    ).toBeUndefined();
    expect(evaluateCursorMotion({ enabled: true, style: "arrow", keys: [] }, 0)).toBeUndefined();
  });

  it("holds stationary position with a single key", () => {
    const spec: CursorSpec = {
      enabled: true,
      style: "arrow",
      keys: [{ t: 1.0, x: 0.3, y: 0.7 }],
    };
    const at0 = evaluateCursorMotion(spec, 0);
    const at1 = evaluateCursorMotion(spec, 1.0);
    const at5 = evaluateCursorMotion(spec, 5.0);

    expect(at0?.x).toBeCloseTo(0.3, 3);
    expect(at0?.y).toBeCloseTo(0.7, 3);
    expect(at1?.x).toBeCloseTo(0.3, 3);
    expect(at1?.y).toBeCloseTo(0.7, 3);
    expect(at5?.x).toBeCloseTo(0.3, 3);
    expect(at5?.y).toBeCloseTo(0.7, 3);
  });

  it("passes exactly through the keyframes at their respective timestamps", () => {
    const spec: CursorSpec = {
      enabled: true,
      style: "pointer",
      keys: [
        { t: 0.0, x: 0.1, y: 0.2 },
        { t: 1.0, x: 0.5, y: 0.8 },
        { t: 2.5, x: 0.9, y: 0.3 },
      ],
    };

    const atK0 = evaluateCursorMotion(spec, 0.0)!;
    expect(atK0.x).toBeCloseTo(0.1, 2);
    expect(atK0.y).toBeCloseTo(0.2, 2);

    const atK1 = evaluateCursorMotion(spec, 1.0)!;
    expect(atK1.x).toBeCloseTo(0.5, 2);
    expect(atK1.y).toBeCloseTo(0.8, 2);

    const atK2 = evaluateCursorMotion(spec, 2.5)!;
    expect(atK2.x).toBeCloseTo(0.9, 2);
    expect(atK2.y).toBeCloseTo(0.3, 2);
  });

  it("enforces arrival and rest at target keys with expoOut curve", () => {
    const spec: CursorSpec = {
      enabled: true,
      style: "arrow",
      keys: [
        { t: 0.0, x: 0.2, y: 0.2 },
        { t: 2.0, x: 0.8, y: 0.8 },
      ],
    };

    // Travel finishes before key timestamp (e.g. 2.0 * 0.7 = 1.4s), resting for remainder
    const duringMove = evaluateCursorMotion(spec, 0.5)!;
    expect(duringMove.x).toBeGreaterThan(0.2);
    expect(duringMove.x).toBeLessThan(0.8);

    // At 1.6s cursor has already arrived at k1 and rests there
    const restingAt16 = evaluateCursorMotion(spec, 1.6)!;
    expect(restingAt16.x).toBeCloseTo(0.8, 2);
    expect(restingAt16.y).toBeCloseTo(0.8, 2);

    // At 2.0s it is still at 0.8
    const restingAt20 = evaluateCursorMotion(spec, 2.0)!;
    expect(restingAt20.x).toBeCloseTo(0.8, 2);
    expect(restingAt20.y).toBeCloseTo(0.8, 2);
  });

  it("handles click press animation and expands ripple with decay", () => {
    const spec: CursorSpec = {
      enabled: true,
      style: "dot",
      keys: [
        { t: 1.0, x: 0.5, y: 0.5, click: true },
      ],
    };

    // Before click
    const before = evaluateCursorMotion(spec, 0.9)!;
    expect(before.scale).toBe(1.0);
    expect(before.pressed).toBe(0);
    expect(before.ripple).toBeUndefined();

    // During press (0.12s duration)
    const midPress = evaluateCursorMotion(spec, 1.06)!;
    expect(midPress.scale).toBeLessThan(1.0);
    expect(midPress.scale).toBeGreaterThanOrEqual(0.88);
    expect(midPress.pressed).toBeGreaterThan(0);

    // Ripple active during 0.5s window
    const earlyRipple = evaluateCursorMotion(spec, 1.1)!;
    expect(earlyRipple.ripple).toBeDefined();
    expect(earlyRipple.ripple?.radius).toBeGreaterThan(0);
    expect(earlyRipple.ripple?.opacity).toBeGreaterThan(0.2);

    const lateRipple = evaluateCursorMotion(spec, 1.4)!;
    expect(lateRipple.ripple).toBeDefined();
    expect(lateRipple.ripple?.radius).toBeGreaterThan(earlyRipple.ripple!.radius);
    expect(lateRipple.ripple?.opacity).toBeLessThan(earlyRipple.ripple!.opacity);

    // After 0.5s ripple has vanished
    const after = evaluateCursorMotion(spec, 1.6)!;
    expect(after.ripple).toBeUndefined();
    expect(after.scale).toBe(1.0);
  });

  it("evaluation is strictly pure and deterministic", () => {
    const spec: CursorSpec = {
      enabled: true,
      style: "arrow",
      keys: [
        { t: 0.0, x: 0.1, y: 0.1 },
        { t: 1.0, x: 0.9, y: 0.5, click: true },
        { t: 2.0, x: 0.3, y: 0.8 },
      ],
    };

    for (let t = 0; t <= 2.0; t += 0.2) {
      const res1 = evaluateCursorMotion(spec, t);
      const res2 = evaluateCursorMotion(spec, t);
      expect(res1).toEqual(res2);
    }
  });
});
