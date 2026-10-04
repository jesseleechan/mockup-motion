import React, { useRef, useState } from 'react';
import { Upload, Trash2, Plus, Sparkles, CheckCircle2, Smartphone, Monitor } from 'lucide-react';
import { UploadedImage, AnimationStyle } from '../types';
import { loadImageFromFile, loadDefaultMobileImages, loadDefaultDesktopImages } from '../utils/sampleImages';

interface UploadSectionProps {
  activeStyle: AnimationStyle;
  desktopImages: UploadedImage[];
  mobileImages: UploadedImage[];
  onDesktopImagesChange: (images: UploadedImage[]) => void;
  onMobileImagesChange: (images: UploadedImage[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  activeStyle,
  desktopImages,
  mobileImages,
  onDesktopImagesChange,
  onMobileImagesChange,
  onNext,
  onBack,
}) => {
  // Default active tab based on selected animation style
  const [activeTab, setActiveTab] = useState<'mobile' | 'desktop'>(
    activeStyle === 'iphone-mockups' ? 'mobile' : 'desktop'
  );

  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentList = activeTab === 'mobile' ? mobileImages : desktopImages;
  const updateCurrentList = activeTab === 'mobile' ? onMobileImagesChange : onDesktopImagesChange;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newImages: UploadedImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        try {
          const uploaded = await loadImageFromFile(file, activeTab);
          newImages.push(uploaded);
        } catch (e) {
          console.error('Failed to load image:', file.name, e);
        }
      }
    }

    if (newImages.length > 0) {
      updateCurrentList([...currentList, ...newImages]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemoveImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateCurrentList(currentList.filter((img) => img.id !== id));
  };

  const handleLoadSamples = async () => {
    setIsLoadingSamples(true);
    try {
      if (activeTab === 'mobile') {
        const samples = await loadDefaultMobileImages();
        onMobileImagesChange(samples);
      } else {
        const samples = await loadDefaultDesktopImages();
        onDesktopImagesChange(samples);
      }
    } catch (e) {
      console.error('Failed to load samples:', e);
    } finally {
      setIsLoadingSamples(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100">
            Upload Screenshots
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Separate sections for 9:16 mobile mockups and landscape desktop rows.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLoadSamples}
          disabled={isLoadingSamples}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-zinc-800/90 hover:bg-zinc-700/80 text-zinc-200 border border-zinc-700/60 shadow-xs transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>
            {isLoadingSamples
              ? 'Loading...'
              : `Load ${activeTab === 'mobile' ? 'Mobile (9:16)' : 'Desktop'} Samples`}
          </span>
        </button>
      </div>

      {/* Two-Section Tabs: Mobile (9:16) vs Landscape */}
      <div className="flex items-center gap-2 p-1.5 bg-zinc-900/90 rounded-2xl border border-zinc-800">
        <button
          type="button"
          onClick={() => setActiveTab('mobile')}
          className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'mobile'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Mobile Screenshots (9:16)</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              activeTab === 'mobile' ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {mobileImages.length}
          </span>
          {activeStyle === 'iphone-mockups' && (
            <span className="text-[10px] font-normal opacity-90 hidden md:inline">
              (Active for iPhone Mockups)
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('desktop')}
          className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'desktop'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          <Monitor className="w-4 h-4" />
          <span>Landscape / Desktop (16:9)</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              activeTab === 'desktop' ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {desktopImages.length}
          </span>
          {activeStyle === 'screenshot-rows' && (
            <span className="text-[10px] font-normal opacity-90 hidden md:inline">
              (Active for Screenshot Rows)
            </span>
          )}
        </button>
      </div>

      {/* Upload Drop Zone for Active Tab */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative group border-2 border-dashed rounded-2xl p-8 sm:p-10 transition-all cursor-pointer text-center ${
          isDragging
            ? 'border-blue-500 bg-blue-950/20'
            : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="mx-auto w-12 h-12 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-300 group-hover:scale-105 group-hover:text-blue-400 transition-all shadow-md">
          <Upload className="w-5 h-5" />
        </div>

        <h3 className="text-base font-semibold text-zinc-200 mt-4">
          Drop {activeTab === 'mobile' ? '9:16 mobile' : 'landscape desktop'} screenshots here, or{' '}
          <span className="text-blue-400 underline underline-offset-4 decoration-blue-500/40">
            browse files
          </span>
        </h3>
        <p className="text-xs text-zinc-500 mt-1">
          {activeTab === 'mobile'
            ? 'Ideal for iPhone Mockups. Vertical full-length or 9:16 mobile captures.'
            : 'Ideal for Screenshot Rows. Wide desktop browser captures (16:9 or 4:3).'}
        </p>
      </div>

      {/* Gallery of Uploaded Screenshots for current tab */}
      {currentList.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>
              {currentList.length} {activeTab === 'mobile' ? 'mobile' : 'desktop'}{' '}
              {currentList.length === 1 ? 'screenshot' : 'screenshots'} loaded
            </span>
            <span className="text-zinc-500">
              {activeTab === 'mobile'
                ? 'Populates the 2 iPhone columns'
                : 'Glides across the horizontal rows'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {currentList.map((img, idx) => (
              <div
                key={img.id}
                className="relative group flex flex-col p-2.5 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900/70 transition-all"
              >
                {/* Thumbnail */}
                <div
                  className={`w-full rounded-lg bg-zinc-950 overflow-hidden relative border border-zinc-800/80 ${
                    activeTab === 'mobile' ? 'aspect-[9/16]' : 'aspect-[16/9]'
                  }`}
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute top-1.5 left-1.5 bg-zinc-900/80 backdrop-blur-xs px-1.5 py-0.5 rounded-xs text-[10px] text-zinc-300 font-mono">
                    #{idx + 1}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveImage(img.id, e)}
                    className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-red-500 text-white rounded-md transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Details */}
                <div className="mt-2 text-left">
                  <p className="text-xs font-medium text-zinc-200 truncate">
                    {img.name}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {img.width} × {img.height}
                  </p>
                </div>
              </div>
            ))}

            {/* Add More button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 bg-zinc-900/20 hover:bg-zinc-900/40 text-xs font-medium transition-all ${
                activeTab === 'mobile' ? 'aspect-[9/16]' : 'aspect-[16/9]'
              }`}
            >
              <Plus className="w-5 h-5" />
              <span>Add screenshot</span>
            </button>
          </div>
        </div>
      )}

      {/* Navigation Buttons: Back to Style / Continue to Preview */}
      <div className="pt-4 flex items-center justify-between border-t border-zinc-800/60">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          ← Back to Style
        </button>

        <button
          type="button"
          onClick={onNext}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-600/25 transition-all cursor-pointer"
        >
          Continue to Preview & Tweak →
        </button>
      </div>
    </div>
  );
};
