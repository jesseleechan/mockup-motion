import type { Background, Shot, Style } from "./types";

/** Unmarked v2 gradients used math angles. Normalize once at persistence boundaries. */
export function normalizeGradientAngle(background: Background): Background {
  if (background.kind !== "gradient") return background;
  const angle = background.angleConvention === "css" ? background.angle : 90 - background.angle;
  return { ...background, angle: ((angle % 360) + 360) % 360, angleConvention: "css" };
}

export function normalizeStyleAngles<T extends { style: Style; shots: Shot[] }>(value: T): T {
  return {
    ...value,
    style: { ...value.style, background: normalizeGradientAngle(value.style.background) },
    shots: value.shots.map((shot) => ({
      ...shot,
      ...(shot.styleOverrides?.background
        ? {
            styleOverrides: {
              ...shot.styleOverrides,
              background: normalizeGradientAngle(shot.styleOverrides.background),
            },
          }
        : {}),
    })),
  };
}
