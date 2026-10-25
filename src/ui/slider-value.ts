/**
 * A slider value as text, at the precision of its step: a step of 0.5 shows "10.0", a step of
 * 0.25 shows "0.25", and a whole step shows whole numbers. Fixing the decimals also hides float
 * noise such as 0.30000000000000004.
 */
export function formatStepValue(value: number, step = 1): string {
  const text = String(step);
  const dot = text.indexOf(".");
  return value.toFixed(dot < 0 ? 0 : text.length - dot - 1);
}
