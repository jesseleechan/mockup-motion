import type { UploadedImage } from "../types";
const urls = new Set<string>();
export async function decodeImage(
  blob: Blob,
  name: string,
  id: string = crypto.randomUUID(),
): Promise<UploadedImage> {
  const url = URL.createObjectURL(blob);
  urls.add(url);
  const imageElement = new Image();
  imageElement.src = url;
  try {
    await imageElement.decode();
    const width = imageElement.naturalWidth,
      height = imageElement.naturalHeight;
    if (!width || !height || width * height > 80_000_000)
      throw new Error("This image is too large. Use an image below 80 megapixels.");
    return {
      id,
      name,
      url,
      blob,
      imageElement,
      width,
      height,
      aspectRatio: width / height,
      category: width / height < 0.8 ? "mobile" : "desktop",
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    urls.delete(url);
    throw error instanceof Error ? error : new Error(`Could not open ${name}.`);
  }
}
export async function loadFiles(files: File[]) {
  const results = await Promise.allSettled(
    files.map(async (file) => {
      if (!["image/png", "image/jpeg", "image/webp", "image/avif"].includes(file.type))
        throw new Error(`${file.name}: use PNG, JPG, WebP, or AVIF.`);
      if (file.size > 35 * 1024 * 1024)
        throw new Error(`${file.name}: images must be below 35 MB.`);
      return decodeImage(file, file.name);
    }),
  );
  return {
    images: results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
    errors: results.flatMap((r) =>
      r.status === "rejected" ? [String(r.reason.message ?? r.reason)] : [],
    ),
  };
}
export function releaseUnusedImages(retained: UploadedImage[]) {
  const live = new Set(retained.map((i) => i.url));
  for (const url of urls)
    if (!live.has(url)) {
      URL.revokeObjectURL(url);
      urls.delete(url);
    }
}
export async function loadDemoImages(): Promise<UploadedImage[]> {
  const response = await fetch("/demo/aurelia.png");
  if (response.ok) {
    const hero = await decodeImage(await response.blob(), "Aurelia — Lake House.png", "demo-hero");
    const { loadDefaultDesktopImages, loadDefaultMobileImages } =
      await import("../utils/sampleImages");
    const [desktop, mobile] = await Promise.all([
      loadDefaultDesktopImages(),
      loadDefaultMobileImages(),
    ]);
    const others = await Promise.all(
      [desktop[1], desktop[2], mobile[0], mobile[1]].map(async (i) => ({
        ...i,
        blob: await (await fetch(i.url)).blob(),
      })),
    );
    return [hero, ...others];
  }
  const { loadDefaultDesktopImages, loadDefaultMobileImages } =
    await import("../utils/sampleImages");
  const [desktop, mobile] = await Promise.all([
    loadDefaultDesktopImages(),
    loadDefaultMobileImages(),
  ]);
  return Promise.all(
    [...desktop, ...mobile].map(async (i) => ({
      ...i,
      blob: await (await fetch(i.url)).blob(),
    })),
  );
}
