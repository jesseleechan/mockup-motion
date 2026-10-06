/** Space kept around the preview on every side of the stage, in CSS px (F05). */
export const STAGE_PADDING = 32;

/** Stage zoom options as a fraction of the fitted size. 1 is "Fit". */
export const STAGE_ZOOMS = [
  { value: 1, label: "Fit" },
  { value: 0.75, label: "75%" },
  { value: 0.5, label: "50%" },
] as const;

export interface PreviewSize {
  width: number;
  height: number;
}

/**
 * Largest box of the given aspect ratio that fits inside the stage after
 * padding, scaled by zoom. Whole CSS pixels, so the canvas is never blurred
 * by a fractional layout size.
 */
export function fitPreview(
  stageWidth: number,
  stageHeight: number,
  ratio: number,
  zoom = 1,
): PreviewSize {
  const availWidth = Math.max(0, stageWidth - 2 * STAGE_PADDING);
  const availHeight = Math.max(0, stageHeight - 2 * STAGE_PADDING);
  const fitWidth = Math.min(availWidth, availHeight * ratio);
  const width = Math.floor(fitWidth * zoom);
  return { width, height: Math.floor(width / ratio) };
}
