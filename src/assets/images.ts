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
  const demoList = [
    { file: "/demo/aurelia/desktop-hero.webp", name: "Aurelia — Lake House", id: "demo-aurelia" },
    {
      file: "/demo/northwind/desktop-hero.webp",
      name: "Northwind — Edge Infrastructure",
      id: "demo-northwind",
    },
    {
      file: "/demo/studio-kova/desktop-hero.webp",
      name: "Studio Kova — Digital Engineering",
      id: "demo-kova",
    },
    {
      file: "/demo/maison-oak/mobile-hero.webp",
      name: "Maison Oak — Atelier Furniture",
      id: "demo-maison",
    },
    {
      file: "/demo/field-notes/mobile-hero.webp",
      name: "Field Notes — High Alpine Journal",
      id: "demo-field-notes",
    },
  ];

  return Promise.all(
    demoList.map(async (item) => {
      const res = await fetch(item.file);
      if (!res.ok) {
        const fallback = await fetch("/demo/aurelia.png");
        const blob = await fallback.blob();
        return decodeImage(blob, item.name, item.id);
      }
      const blob = await res.blob();
      return decodeImage(blob, item.name, item.id);
    }),
  );
}
