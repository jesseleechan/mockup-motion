import React from 'react';
import { Download, Film, Sparkles } from 'lucide-react';

interface HeaderProps {
  onExportClick: () => void;
  isExporting: boolean;
  activeStep: number;
  onStepClick: (step: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onExportClick,
  isExporting,
  activeStep,
  onStepClick,
}) => {
  return (
    <header className="w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-500 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Film className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-zinc-100 font-sans">
            MockupMotion
          </span>
        </div>

        {/* Zone 2: Clean 3-step workflow indicator */}
        <nav className="hidden md:flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800/60 text-xs font-medium">
          <button
            onClick={() => onStepClick(1)}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeStep === 1
                ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            1. Style
          </button>
          <span className="text-zinc-600">/</span>
          <button
            onClick={() => onStepClick(2)}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeStep === 2
                ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            2. Upload
          </button>
          <span className="text-zinc-600">/</span>
          <button
            onClick={() => onStepClick(3)}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeStep === 3
                ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            3. Preview & Tweak
          </button>
        </nav>

        {/* Zone 3: Primary action button */}
        <div className="flex items-center gap-3">
          <button
            onClick={onExportClick}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-md shadow-blue-600/25 transition-all whitespace-nowrap cursor-pointer"
          >
            {isExporting ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export MP4</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
