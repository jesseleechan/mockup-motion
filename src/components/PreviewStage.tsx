import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Maximize2, Monitor, Smartphone, Square } from 'lucide-react';
import { MockupConfig, UploadedImage, AspectRatio } from '../types';
import { renderMockupScene } from '../utils/canvasRenderer';

interface PreviewStageProps {
  config: MockupConfig;
  images: UploadedImage[];
  onAspectRatioChange: (aspectRatio: AspectRatio) => void;
}

export const PreviewStage: React.FC<PreviewStageProps> = ({
  config,
  images,
  onAspectRatioChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Timekeeping ref
  const animFrameId = useRef<number | null>(null);
  const lastTimestamp = useRef<number>(performance.now());
  const currentTimeRef = useRef<number>(0);

  // Keep ref in sync
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Canvas internal dimensions
  const getCanvasDimensions = useCallback(() => {
    switch (config.aspectRatio) {
      case '9:16':
        return { width: 720, height: 1280 };
      case '1:1':
        return { width: 900, height: 900 };
      case '16:9':
      default:
        return { width: 1280, height: 720 };
    }
  }, [config.aspectRatio]);

  // Main animation frame loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = getCanvasDimensions();
    canvas.width = width;
    canvas.height = height;

    lastTimestamp.current = performance.now();

    const loop = (now: number) => {
      const delta = (now - lastTimestamp.current) / 1000;
      lastTimestamp.current = now;

      if (isPlaying && !isScrubbing) {
        let nextTime = currentTimeRef.current + delta;
        if (nextTime >= config.durationSeconds) {
          nextTime = nextTime % config.durationSeconds;
        }
        currentTimeRef.current = nextTime;
        setCurrentTime(nextTime);
      }

      // Render scene
      renderMockupScene({
        ctx,
        width,
        height,
        time: currentTimeRef.current,
        duration: config.durationSeconds,
        config,
        images,
      });

      animFrameId.current = requestAnimationFrame(loop);
    };

    animFrameId.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [config, images, isPlaying, isScrubbing, getCanvasDimensions]);

  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleRestart = () => {
    currentTimeRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    currentTimeRef.current = val;
    setCurrentTime(val);
  };

  // Keyboard shortcut: Space to toggle play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const formatTime = (secs: number) => {
    const s = Math.floor(secs);
    const ms = Math.floor((secs % 1) * 10);
    return `00:0${s}.${ms}`.slice(-7);
  };

  // CSS aspect ratio class
  const getContainerAspectClass = () => {
    switch (config.aspectRatio) {
      case '9:16':
        return 'aspect-[9/16] max-h-[580px]';
      case '1:1':
        return 'aspect-square max-h-[520px]';
      case '16:9':
      default:
        return 'aspect-[16/9] max-h-[520px]';
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Aspect Ratio Selector Bar */}
      <div className="w-full flex items-center justify-between pb-3 text-xs text-zinc-400">
        <div className="flex items-center gap-1.5 font-medium">
          <span>Aspect Ratio:</span>
        </div>

        <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => onAspectRatioChange('16:9')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
              config.aspectRatio === '16:9'
                ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>16:9 Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => onAspectRatioChange('9:16')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
              config.aspectRatio === '9:16'
                ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>9:16 Reel/Story</span>
          </button>
          <button
            type="button"
            onClick={() => onAspectRatioChange('1:1')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
              config.aspectRatio === '1:1'
                ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>1:1 Square</span>
          </button>
        </div>
      </div>

      {/* Canvas Viewport Frame */}
      <div className="relative w-full flex items-center justify-center p-3 sm:p-5 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 shadow-2xl overflow-hidden group">
        <div
          className={`w-full ${getContainerAspectClass()} flex items-center justify-center relative overflow-hidden rounded-xl shadow-inner transition-all duration-300`}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain rounded-xl select-none"
          />

          {/* Quick Play/Pause Center Overlay on Hover when paused */}
          {!isPlaying && (
            <button
              onClick={togglePlayPause}
              className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-xs"
            >
              <Play className="w-6 h-6 ml-0.5 fill-white" />
            </button>
          )}
        </div>
      </div>

      {/* Video Playback Controls Bar */}
      <div className="w-full mt-3 p-3 bg-zinc-900/90 rounded-xl border border-zinc-800 flex flex-col gap-2 shadow-md">
        {/* Scrubber timeline slider */}
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={config.durationSeconds}
            step={0.01}
            value={currentTime}
            onMouseDown={() => setIsScrubbing(true)}
            onMouseUp={() => setIsScrubbing(false)}
            onTouchStart={() => setIsScrubbing(true)}
            onTouchEnd={() => setIsScrubbing(false)}
            onChange={handleScrubberChange}
            className="flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
          />
        </div>

        {/* Control buttons & timecode */}
        <div className="flex items-center justify-between text-xs text-zinc-300">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlayPause}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleRestart}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Replay from start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <span className="font-mono text-zinc-400 text-[11px] tabular-nums ml-1">
              {formatTime(currentTime)} / {formatTime(config.durationSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span>60 FPS</span>
            <span>·</span>
            <span className="capitalize">{config.style.replace('-', ' ')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
