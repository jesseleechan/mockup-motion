import type { AspectRatio, Composition, UploadedImage } from "../types";
export const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
export const smooth = (p: number) => p * p * (3 - 2 * p);
export function outputDimensions(ratio: AspectRatio, resolution = 1080) {
  switch (ratio) {
    case "16:9":
      return {
        width: Math.round((resolution * 16) / 9 / 2) * 2,
        height: resolution,
      };
    case "9:16":
      return {
        width: resolution,
        height: Math.round((resolution * 16) / 9 / 2) * 2,
      };
    case "4:5":
      return {
        width: resolution,
        height: Math.round((resolution * 5) / 4 / 2) * 2,
      };
    default:
      return { width: resolution, height: resolution };
  }
}
export function imageRect(
  iw: number,
  ih: number,
  vw: number,
  vh: number,
  fit: "cover" | "contain",
  crop: number,
) {
  const scale = fit === "contain" ? Math.min(vw / iw, vh / ih) : Math.max(vw / iw, vh / ih);
  const width = iw * scale,
    height = ih * scale;
  return {
    x: (vw - width) / 2,
    y: height > vh ? -(height - vh) * clamp(crop) : (vh - height) / 2,
    width,
    height,
  };
}
export function motionProgress(time: number, c: Composition) {
  const { duration, hold, easing, loop } = c.motion;
  const p = clamp((time - hold) / Math.max(0.1, duration - hold * 2));
  const eased = easing === "smooth" ? smooth(p) : p;
  return loop
    ? easing === "smooth"
      ? (1 - Math.cos(p * Math.PI * 2)) / 2
      : 1 - Math.abs(2 * p - 1)
    : eased;
}
export function contentProgress(time: number, c: Composition) {
  const p = clamp(
    (time - c.contentMotion.hold) / Math.max(0.1, c.motion.duration - c.contentMotion.hold * 2),
  );
  const travel = c.motion.loop ? (1 - Math.cos(p * Math.PI * 2)) / 2 : smooth(p);
  return (c.contentMotion.start + (c.contentMotion.end - c.contentMotion.start) * travel) / 100;
}
export function chooseImages(c: Composition, images: UploadedImage[]) {
  const primary =
    images.find((i) => i.id === c.assetIds.primary) ??
    images.find((i) =>
      c.frame.type === "phone" ? i.category === "mobile" : i.category !== "mobile",
    ) ??
    images[0];
  const mobile =
    images.find((i) => i.id === c.assetIds.mobile) ?? images.find((i) => i.category === "mobile");
  return { primary, mobile };
}
export function canScroll(c: Composition, images: UploadedImage[]) {
  if (c.layout !== "hero" || c.image.fit === "contain") return false;
  const { primary } = chooseImages(c, images);
  const frameRatio = c.frame.type === "phone" ? 0.48 : 16 / 10;
  return !!primary && primary.aspectRatio < frameRatio - 0.02;
}
