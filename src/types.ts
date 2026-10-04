export type AnimationStyle = 'screenshot-rows' | 'iphone-mockups';

export type AspectRatio = '16:9' | '9:16' | '1:1';

export type DeviceFrameFinish = 'midnight' | 'titanium' | 'silver' | 'gold';

export type ScrollSpeed = 'very-slow' | 'slow' | 'normal' | 'fast';

export interface MockupConfig {
  style: AnimationStyle;
  aspectRatio: AspectRatio;
  durationSeconds: number; // e.g. 4 to 12
  backgroundColor: string; // e.g. '#0A0D14'
  backgroundStyle: 'gradient' | 'solid' | 'spotlight';
  deviceFinish: DeviceFrameFinish;
  showShadows: boolean;
  showGlare: boolean;
  scrollSpeed: ScrollSpeed;
}

export interface UploadedImage {
  id: string;
  name: string;
  url: string;
  imageElement?: HTMLImageElement;
  width: number;
  height: number;
  aspectRatio: number;
  category?: 'desktop' | 'mobile';
}

export interface ExportProgress {
  isExporting: boolean;
  currentFrame: number;
  totalFrames: number;
  percentage: number;
  stage: 'preparing' | 'rendering' | 'muxing' | 'complete' | 'error';
  errorMessage?: string;
  videoUrl?: string;
}
