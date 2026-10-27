import { keptRows } from "./sizing";

/**
 * For an asset provider: the top rows of a bitmap it decoded and owns that `rows` keeps
 * (textureRows). Returns a copy of those rows and closes `bitmap`, or `bitmap` itself when it
 * keeps every row; `held` is `rows`, or null when the result is the whole image. The copy is the
 * decode's own pixels, not resampled, so the rows kept look exactly as in the whole decode.
 */
export async function keepTopRows(
  bitmap: ImageBitmap,
  rows: number | null,
): Promise<{ bitmap: ImageBitmap; held: number | null }> {
  const kept = keptRows(rows, bitmap.width, bitmap.height);
  if (kept < bitmap.height) {
    const top = await createImageBitmap(bitmap, 0, 0, bitmap.width, kept);
    bitmap.close();
    return { bitmap: top, held: rows };
  }
  return { bitmap, held: null };
}

/** A new bitmap of the rows of `bitmap` that `rows` keeps (textureRows). `bitmap` stays open. */
export function copyTopRows(bitmap: ImageBitmap, rows: number | null): Promise<ImageBitmap> {
  const kept = keptRows(rows, bitmap.width, bitmap.height);
  if (kept < bitmap.height) return createImageBitmap(bitmap, 0, 0, bitmap.width, kept);
  return createImageBitmap(bitmap);
}
