import React, { useEffect } from 'react';
import { Download, CheckCircle2, AlertCircle, X, Sparkles, Film } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ExportProgress } from '../types';

interface ExportModalProps {
  progress: ExportProgress;
  onClose: () => void;
  onRetry: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  progress,
  onClose,
  onRetry,
}) => {
  // Fire confetti upon successful completion
  useEffect(() => {
    if (progress.stage === 'complete') {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // Ignore confetti errors if any
      }
    }
  }, [progress.stage]);

  if (!progress.isExporting && progress.stage === 'preparing') {
    return null;
  }

  const getStageTitle = () => {
    switch (progress.stage) {
      case 'preparing':
        return 'Initializing Video Engine...';
      case 'rendering':
        return `Rendering Video Frames (${progress.percentage}%)`;
      case 'muxing':
        return 'Encoding High-Definition MP4...';
      case 'complete':
        return 'Export Complete!';
      case 'error':
        return 'Export Failed';
      default:
        return 'Generating Video...';
    }
  };

  const getStageDescription = () => {
    switch (progress.stage) {
      case 'preparing':
        return 'Configuring hardware acceleration and render canvas...';
      case 'rendering':
        return `Processing frame ${progress.currentFrame} of ${progress.totalFrames} at 60 FPS...`;
      case 'muxing':
        return 'Muxing H.264 video track into standalone MP4 container...';
      case 'complete':
        return 'Your MP4 video has been downloaded to your computer!';
      case 'error':
        return progress.errorMessage || 'An error occurred during video encoding.';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
        {/* Close Button when finished or errored */}
        {(progress.stage === 'complete' || progress.stage === 'error') && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center space-y-4">
          {/* Status Icon */}
          <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center">
            {progress.stage === 'complete' ? (
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <CheckCircle2 className="w-7 h-7" />
              </div>
            ) : progress.stage === 'error' ? (
              <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
                <AlertCircle className="w-7 h-7" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Film className="w-7 h-7 animate-pulse" />
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-bold text-zinc-100">{getStageTitle()}</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              {getStageDescription()}
            </p>
          </div>

          {/* Progress Bar (during rendering / muxing) */}
          {progress.stage !== 'complete' && progress.stage !== 'error' && (
            <div className="space-y-2 pt-2">
              <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-150 rounded-full"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                <span>{progress.currentFrame} / {progress.totalFrames} frames</span>
                <span>{progress.percentage}%</span>
              </div>
            </div>
          )}

          {/* Video Preview on Complete */}
          {progress.stage === 'complete' && progress.videoUrl && (
            <div className="pt-2 space-y-4">
              <div className="rounded-xl overflow-hidden border border-zinc-800 max-h-60 bg-black flex items-center justify-center shadow-lg">
                <video
                  src={progress.videoUrl}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="max-h-60 w-auto object-contain"
                />
              </div>

              <div className="flex items-center justify-center gap-3">
                <a
                  href={progress.videoUrl}
                  download={`animated-mockup-${Date.now()}.mp4`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download MP4 Again</span>
                </a>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs rounded-xl transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Error Retry Button */}
          {progress.stage === 'error' && (
            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={onRetry}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl"
              >
                Retry Export
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 font-semibold text-xs rounded-xl"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
