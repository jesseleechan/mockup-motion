import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { MockupConfig, UploadedImage, ExportProgress } from '../types';
import { renderMockupScene } from './canvasRenderer';

interface ExportOptions {
  config: MockupConfig;
  images: UploadedImage[];
  onProgress: (progress: ExportProgress) => void;
}

/**
 * Returns export dimensions based on selected aspect ratio
 */
export function getExportResolution(aspectRatio: MockupConfig['aspectRatio']): { width: number; height: number } {
  switch (aspectRatio) {
    case '9:16':
      return { width: 1080, height: 1920 };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '16:9':
    default:
      return { width: 1920, height: 1080 };
  }
}

/**
 * High-performance frame-accurate MP4 exporter using WebCodecs + mp4-muxer
 * with MediaRecorder fallback.
 */
export async function exportMockupVideo({
  config,
  images,
  onProgress,
}: ExportOptions): Promise<string> {
  const { width, height } = getExportResolution(config.aspectRatio);
  const fps = 60;
  const duration = config.durationSeconds;
  const totalFrames = Math.round(duration * fps);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Could not create export canvas context.');
  }

  onProgress({
    isExporting: true,
    currentFrame: 0,
    totalFrames,
    percentage: 0,
    stage: 'preparing',
  });

  // Check if WebCodecs VideoEncoder is available
  const hasWebCodecs = typeof window !== 'undefined' && typeof window.VideoEncoder !== 'undefined';

  if (hasWebCodecs) {
    try {
      return await exportWithWebCodecs({
        canvas,
        ctx,
        width,
        height,
        fps,
        duration,
        totalFrames,
        config,
        images,
        onProgress,
      });
    } catch (err) {
      console.warn('WebCodecs export failed, falling back to MediaRecorder:', err);
    }
  }

  // Fallback to MediaRecorder
  return await exportWithMediaRecorder({
    canvas,
    ctx,
    width,
    height,
    fps,
    duration,
    config,
    images,
    onProgress,
  });
}

/**
 * Offline frame-by-frame export via WebCodecs + mp4-muxer.
 * Guarantees zero dropped frames, 60fps silky smooth motion, and true MP4 file.
 */
async function exportWithWebCodecs({
  canvas,
  ctx,
  width,
  height,
  fps,
  duration,
  totalFrames,
  config,
  images,
  onProgress,
}: {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  fps: number;
  duration: number;
  totalFrames: number;
  config: MockupConfig;
  images: UploadedImage[];
  onProgress: (progress: ExportProgress) => void;
}): Promise<string> {
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width,
      height,
    },
    fastStart: 'in-memory',
  });

  let encoderError: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encoderError = e instanceof Error ? e : new Error(String(e));
    },
  });

  // AVC / H.264 Baseline Profile
  videoEncoder.configure({
    codec: 'avc1.420034',
    width,
    height,
    bitrate: 8_000_000, // 8 Mbps high quality
    framerate: fps,
  });

  onProgress({
    isExporting: true,
    currentFrame: 0,
    totalFrames,
    percentage: 5,
    stage: 'rendering',
  });

  for (let frame = 0; frame < totalFrames; frame++) {
    if (encoderError) {
      throw encoderError;
    }

    const time = frame / fps;

    // Render the exact frame onto export canvas
    renderMockupScene({
      ctx,
      width,
      height,
      time,
      duration,
      config,
      images,
    });

    const timestampMicros = Math.round(time * 1_000_000);
    const videoFrame = new VideoFrame(canvas, {
      timestamp: timestampMicros,
      duration: Math.round((1 / fps) * 1_000_000),
    });

    const isKeyFrame = frame % (fps * 2) === 0;
    videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
    videoFrame.close();

    // Yield every 4 frames so the UI thread updates and stays responsive
    if (frame % 4 === 0) {
      const pct = Math.round(5 + (frame / totalFrames) * 85);
      onProgress({
        isExporting: true,
        currentFrame: frame,
        totalFrames,
        percentage: pct,
        stage: 'rendering',
      });
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  onProgress({
    isExporting: true,
    currentFrame: totalFrames,
    totalFrames,
    percentage: 92,
    stage: 'muxing',
  });

  await videoEncoder.flush();
  videoEncoder.close();

  muxer.finalize();
  const buffer = muxer.target.buffer;
  const blob = new Blob([buffer], { type: 'video/mp4' });
  const videoUrl = URL.createObjectURL(blob);

  // Trigger download automatically
  downloadFile(videoUrl, `mockup-${config.style}-${Date.now()}.mp4`);

  onProgress({
    isExporting: false,
    currentFrame: totalFrames,
    totalFrames,
    percentage: 100,
    stage: 'complete',
    videoUrl,
  });

  return videoUrl;
}

/**
 * Fallback real-time recorder using MediaRecorder API
 */
async function exportWithMediaRecorder({
  canvas,
  ctx,
  width,
  height,
  fps,
  duration,
  config,
  images,
  onProgress,
}: {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  fps: number;
  duration: number;
  config: MockupConfig;
  images: UploadedImage[];
  onProgress: (progress: ExportProgress) => void;
}): Promise<string> {
  const stream = canvas.captureStream(fps);
  const mimeTypes = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm',
  ];
  let selectedMime = 'video/webm';
  for (const m of mimeTypes) {
    if (MediaRecorder.isTypeSupported(m)) {
      selectedMime = m;
      break;
    }
  }

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: selectedMime,
    videoBitsPerSecond: 8_000_000,
  });

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const recordingPromise = new Promise<string>((resolve, reject) => {
    recorder.onstop = () => {
      const isMp4 = selectedMime.includes('mp4');
      const blob = new Blob(chunks, { type: selectedMime });
      const videoUrl = URL.createObjectURL(blob);
      const ext = isMp4 ? 'mp4' : 'webm';
      downloadFile(videoUrl, `mockup-${config.style}-${Date.now()}.${ext}`);

      onProgress({
        isExporting: false,
        currentFrame: 100,
        totalFrames: 100,
        percentage: 100,
        stage: 'complete',
        videoUrl,
      });

      resolve(videoUrl);
    };
    recorder.onerror = reject;
  });

  recorder.start();

  const startTime = performance.now();
  const totalMs = duration * 1000;

  return new Promise((resolve, reject) => {
    const renderLoop = () => {
      const elapsed = performance.now() - startTime;
      const t = (elapsed / 1000) % duration;

      renderMockupScene({
        ctx,
        width,
        height,
        time: t,
        duration,
        config,
        images,
      });

      const pct = Math.min(95, Math.round((elapsed / totalMs) * 95));
      onProgress({
        isExporting: true,
        currentFrame: Math.round((elapsed / totalMs) * 100),
        totalFrames: 100,
        percentage: pct,
        stage: 'rendering',
      });

      if (elapsed < totalMs) {
        requestAnimationFrame(renderLoop);
      } else {
        recorder.stop();
        recordingPromise.then(resolve).catch(reject);
      }
    };

    requestAnimationFrame(renderLoop);
  });
}

function downloadFile(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
