/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { StyleSelector } from './components/StyleSelector';
import { UploadSection } from './components/UploadSection';
import { PreviewStage } from './components/PreviewStage';
import { TweakControls } from './components/TweakControls';
import { ExportModal } from './components/ExportModal';
import { MockupConfig, UploadedImage, ExportProgress, AnimationStyle, AspectRatio } from './types';
import { loadDefaultDesktopImages, loadDefaultMobileImages } from './utils/sampleImages';
import { exportMockupVideo } from './utils/videoExporter';
import { Download, Sparkles, ChevronLeft, Upload as UploadIcon, Layers } from 'lucide-react';

export default function App() {
  // Step 1: Style -> Step 2: Upload -> Step 3: Preview & Tweak
  const [activeStep, setActiveStep] = useState<number>(1);
  const [desktopImages, setDesktopImages] = useState<UploadedImage[]>([]);
  const [mobileImages, setMobileImages] = useState<UploadedImage[]>([]);

  const [config, setConfig] = useState<MockupConfig>({
    style: 'iphone-mockups',
    aspectRatio: '16:9',
    durationSeconds: 6,
    backgroundColor: '#0A0D14',
    backgroundStyle: 'spotlight',
    deviceFinish: 'titanium',
    showShadows: true,
    showGlare: true,
    scrollSpeed: 'slow',
    easing: 'smooth',
  });

  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    isExporting: false,
    currentFrame: 0,
    totalFrames: 0,
    percentage: 0,
    stage: 'preparing',
  });

  // Preload high-res sample images for both Mobile (9:16) and Desktop
  useEffect(() => {
    let isMounted = true;
    Promise.all([loadDefaultDesktopImages(), loadDefaultMobileImages()]).then(
      ([desktops, mobiles]) => {
        if (isMounted) {
          setDesktopImages(desktops);
          setMobileImages(mobiles);
        }
      }
    );
    return () => {
      isMounted = false;
    };
  }, []);

  const handleConfigChange = (changes: Partial<MockupConfig>) => {
    setConfig((prev) => ({ ...prev, ...changes }));
  };

  // Determine which image set to render based on selected style
  const activeImages =
    config.style === 'iphone-mockups'
      ? (mobileImages.length > 0 ? mobileImages : desktopImages)
      : (desktopImages.length > 0 ? desktopImages : mobileImages);

  const handleExport = async () => {
    if (activeImages.length === 0) {
      setActiveStep(2);
      return;
    }

    try {
      await exportMockupVideo({
        config,
        images: activeImages,
        onProgress: setExportProgress,
      });
    } catch (err) {
      console.error('Export error:', err);
      setExportProgress((prev) => ({
        ...prev,
        isExporting: false,
        stage: 'error',
        errorMessage: err instanceof Error ? err.message : 'Export failed.',
      }));
    }
  };

  const handleCloseExportModal = () => {
    setExportProgress((prev) => ({
      ...prev,
      isExporting: false,
      stage: 'preparing',
    }));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-blue-600/30 selection:text-white">
      {/* 3-Zone Top Navigation Bar */}
      <Header
        onExportClick={handleExport}
        isExporting={exportProgress.isExporting}
        activeStep={activeStep}
        onStepClick={setActiveStep}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Step 1: Pick Style First */}
        {activeStep === 1 && (
          <div className="max-w-4xl mx-auto animate-in fade-in duration-200">
            <StyleSelector
              selectedStyle={config.style}
              onStyleSelect={(style: AnimationStyle) =>
                handleConfigChange({ style })
              }
              onContinue={() => setActiveStep(2)}
            />
          </div>
        )}

        {/* Step 2: Upload Screenshots (Separate Mobile & Desktop sections) */}
        {activeStep === 2 && (
          <div className="max-w-4xl mx-auto animate-in fade-in duration-200">
            <UploadSection
              activeStyle={config.style}
              desktopImages={desktopImages}
              mobileImages={mobileImages}
              onDesktopImagesChange={setDesktopImages}
              onMobileImagesChange={setMobileImages}
              onNext={() => setActiveStep(3)}
              onBack={() => setActiveStep(1)}
            />
          </div>
        )}

        {/* Step 3: Preview & Tweak */}
        {activeStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Quick breadcrumb navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-800/60">
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Style: <strong className="text-zinc-200 capitalize">{config.style.replace('-', ' ')}</strong></span>
                </button>
                <span className="text-zinc-600">·</span>
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                >
                  <UploadIcon className="w-3.5 h-3.5" />
                  <span>
                    Screenshots (
                    {config.style === 'iphone-mockups'
                      ? `${mobileImages.length} mobile`
                      : `${desktopImages.length} desktop`}
                    )
                  </span>
                </button>
              </div>

              {/* Style quick pill switcher */}
              <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800 text-xs">
                <button
                  type="button"
                  onClick={() => handleConfigChange({ style: 'screenshot-rows' })}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    config.style === 'screenshot-rows'
                      ? 'bg-blue-600 text-white font-medium shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Screenshot Rows
                </button>
                <button
                  type="button"
                  onClick={() => handleConfigChange({ style: 'iphone-mockups' })}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    config.style === 'iphone-mockups'
                      ? 'bg-blue-600 text-white font-medium shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  iPhone Mockups
                </button>
              </div>
            </div>

            {/* Main Stage Grid: Canvas on Left/Center, Tweaks on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left / Center: Interactive Preview Canvas */}
              <div className="lg:col-span-8 flex flex-col items-center">
                <PreviewStage
                  config={config}
                  images={activeImages}
                  onAspectRatioChange={(aspectRatio: AspectRatio) =>
                    handleConfigChange({ aspectRatio })
                  }
                />
              </div>

              {/* Right: Tweak Basics Controls */}
              <div className="lg:col-span-4 space-y-4">
                <TweakControls
                  config={config}
                  onConfigChange={handleConfigChange}
                />

                {/* Primary Export CTA */}
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exportProgress.isExporting || activeImages.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/25 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  {exportProgress.isExporting ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      <span>Exporting MP4...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Export High-Quality MP4</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-center text-zinc-500 leading-relaxed">
                  Renders at 60 FPS in {config.aspectRatio} resolution. No watermark. No accounts required.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Export Progress Modal */}
      {exportProgress.stage !== 'preparing' && (
        <ExportModal
          progress={exportProgress}
          onClose={handleCloseExportModal}
          onRetry={handleExport}
        />
      )}
    </div>
  );
}
