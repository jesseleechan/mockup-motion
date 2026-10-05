export function calculateScrubValue({
  startValue,
  deltaX,
  shiftKey,
  altKey,
  step = 1,
  min = -Infinity,
  max = Infinity,
  pixelsPerStep = 2,
}: {
  startValue: number;
  deltaX: number;
  shiftKey: boolean;
  altKey: boolean;
  step?: number;
  min?: number;
  max?: number;
  pixelsPerStep?: number;
}): number {
  let multiplier = 1;
  if (shiftKey) multiplier = 10;
  else if (altKey) multiplier = 0.1;

  const stepsMoved = (deltaX / pixelsPerStep) * multiplier;
  let raw = startValue + stepsMoved * step;

  // Round to step precision
  const decimals = Math.max(0, -Math.floor(Math.log10(step * multiplier)));
  const factor = Math.pow(10, Math.min(6, decimals + 1));
  raw = Math.round(raw * factor) / factor;

  // Clamping
  return Math.min(max, Math.max(min, raw));
}
