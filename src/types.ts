export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";
export type Layout = "hero" | "rows" | "grid" | "columns" | "pair";
export type Frame = "browser" | "rounded" | "none" | "phone";
export type DeviceFrameFinish = "midnight" | "titanium" | "silver" | "gold";
export interface UploadedImage {
  id: string;
  name: string;
  url: string;
  imageElement?: HTMLImageElement | ImageBitmap;
  blob?: Blob;
  width: number;
  height: number;
  aspectRatio: number;
  category?: "desktop" | "mobile";
  crop?: number;
}
export interface Composition {
  layout: Layout;
  scale: number;
  spacing: number;
  rotation: number;
  count: number;
  alignment: "center" | "left" | "right";
  assetIds: { primary: string; mobile: string };
  frame: {
    type: Frame;
    appearance: "light" | "dark";
    radius: number;
    border: number;
    finish: DeviceFrameFinish;
    title: string;
    status: boolean;
  };
  image: { fit: "cover" | "contain"; crop: number };
  background: {
    type: "solid" | "gradient" | "spotlight" | "image";
    color: string;
    secondColor: string;
    angle: number;
    intensity: number;
    imageId: string;
  };
  motion: {
    type: "still" | "drift" | "glide" | "zoom";
    duration: number;
    amount: number;
    direction: "forward" | "reverse";
    easing: "smooth" | "linear";
    loop: boolean;
    hold: number;
  };
  contentMotion: { enabled: boolean; start: number; end: number; hold: number };
  effects: { shadow: number; blur: number; offset: number; reflection: number };
  brand: {
    title: string;
    subtitle: string;
    color: string;
    size: number;
    position: "top" | "bottom";
    logoId: string;
  };
}
export interface ExportSettings {
  resolution: 720 | 1080;
  fps: 30 | 60;
  quality: "standard" | "high";
  format: "mp4" | "webm";
}
export interface Project {
  version: 1;
  name: string;
  presetId: string;
  customized: boolean;
  aspectRatio: AspectRatio;
  composition: Composition;
  images: UploadedImage[];
  exportSettings: ExportSettings;
}
export interface Preset {
  id: string;
  name: string;
  description: string;
  category: "desktop" | "mobile" | "mixed";
  composition: Composition;
  custom?: boolean;
}
export interface ExportResult {
  url: string;
  mimeType: string;
  extension: "mp4" | "webm" | "png";
  filename: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  size: number;
}
export interface ExportProgress {
  stage: "preparing" | "rendering" | "finishing";
  percentage: number;
  currentFrame: number;
  totalFrames: number;
}
