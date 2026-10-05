import type { AssetRef } from "../doc/types";

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/avif"]);

const MAX_BYTES = 35 * 1024 * 1024; // 35 MB
const MAX_MEGAPIXELS = 80_000_000; // 80 MP

export async function validateAndDecodeAsset(
  blob: Blob,
  name: string,
  id = crypto.randomUUID(),
): Promise<{ ref: AssetRef; blob: Blob }> {
  if (!ALLOWED_MIME_TYPES.has(blob.type)) {
    throw new Error(`${name}: use PNG, JPG, WebP, or AVIF.`);
  }

  if (blob.size > MAX_BYTES) {
    throw new Error(`${name}: images must be below 35 MB.`);
  }

  let width = 0;
  let height = 0;

  if (typeof createImageBitmap !== "undefined") {
    const bitmap = await createImageBitmap(blob);
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
  } else if (typeof Image !== "undefined") {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      width = img.naturalWidth;
      height = img.naturalHeight;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  if (!width || !height || width * height > MAX_MEGAPIXELS) {
    throw new Error(`${name}: image is too large. Use an image below 80 megapixels.`);
  }

  const aspect = width / height;
  const role = aspect < 0.75 ? "mobile" : "desktop";
  const tall = height > width * 1.5;

  const ref: AssetRef = {
    id,
    kind: "image",
    name,
    mime: blob.type,
    bytes: blob.size,
    width,
    height,
    role,
    meta: { tall },
  };

  return { ref, blob };
}
