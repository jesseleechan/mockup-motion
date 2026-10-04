import React from 'react';
import { Sliders, Clock, Palette, Sparkles, Smartphone, Activity } from 'lucide-react';
import { MockupConfig, DeviceFrameFinish } from '../types';

interface TweakControlsProps {
  config: MockupConfig;
  onConfigChange: (newConfig: Partial<MockupConfig>) => void;
}

const COLOR_PRESETS = [
  { name: 'Deep Slate', hex: '#0A0D14' },
  { name: 'Obsidian', hex: '#09090B' },
  { name: 'Pure Noir', hex: '#000000' },
  { name: 'Charcoal', hex: '#18181B' },
  { name: 'Studio Mist', hex: '#1E293B' },
  { name: 'Midnight Navy', hex: '#0B132B' },
  { name: 'Warm Cream', hex: '#F8F7F4' },
];

export const TweakControls: React.FC<TweakControlsProps> = ({
  config,
  onConfigChange,
}) => {
  return (
    <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-5 space-y-6">
      <div className="flex items-center gap-2 pb-3 border-b border-zinc-800/80">
        <Sliders className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
          Animation Settings
        </h3>
      </div>

      {/* 1. Video Duration */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-1.5 font-medium text-zinc-300">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Video Length</span>
          </label>
          <span className="font-mono text-blue-400 font-bold tabular-nums">
            {config.durationSeconds} seconds
          </span>
        </div>

        <input
          type="range"
          min={3}
          max={12}
          step={1}
          value={config.durationSeconds}
          onChange={(e) =>
            onConfigChange({ durationSeconds: parseInt(e.target.value, 10) })
          }
          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />

        <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
          <span>3s (Snappy)</span>
          <span>6s (Recommended)</span>
          <span>12s (Deep Dive)</span>
        </div>
      </div>

      {/* 2. Background Color */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-1.5 font-medium text-zinc-300">
            <Palette className="w-3.5 h-3.5 text-zinc-400" />
            <span>Background Color</span>
          </label>
          <span className="font-mono text-[11px] text-zinc-400 uppercase">
            {config.backgroundColor}
          </span>
        </div>

        {/* Color Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          {COLOR_PRESETS.map((color) => {
            const isSelected =
              config.backgroundColor.toLowerCase() === color.hex.toLowerCase();
            return (
              <button
                key={color.hex}
                type="button"
                onClick={() => onConfigChange({ backgroundColor: color.hex })}
                className={`w-7 h-7 rounded-lg border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/40 scale-110'
                    : 'border-zinc-700/80 hover:border-zinc-500 hover:scale-105'
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            );
          })}

          {/* Custom color picker */}
          <label className="relative w-7 h-7 rounded-lg border border-zinc-700 hover:border-zinc-500 flex items-center justify-center cursor-pointer bg-zinc-800 overflow-hidden" title="Custom Color">
            <input
              type="color"
              value={config.backgroundColor}
              onChange={(e) => onConfigChange({ backgroundColor: e.target.value })}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <span className="text-[10px] text-zinc-400 font-bold">+</span>
          </label>
        </div>

        {/* Background Style Type (Spotlight, Gradient, Solid) */}
        <div className="grid grid-cols-3 gap-1.5 pt-1 text-xs">
          {(['spotlight', 'gradient', 'solid'] as const).map((bStyle) => (
            <button
              key={bStyle}
              type="button"
              onClick={() => onConfigChange({ backgroundStyle: bStyle })}
              className={`py-1.5 px-2 rounded-lg border text-center capitalize text-[11px] transition-all cursor-pointer ${
                config.backgroundStyle === bStyle
                  ? 'bg-zinc-800 border-zinc-600 text-white font-semibold'
                  : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {bStyle}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Device Frame Finish */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
          <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
          <span>Device Chassis Finish</span>
        </label>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { id: 'titanium' as DeviceFrameFinish, name: 'Titanium Slate' },
            { id: 'midnight' as DeviceFrameFinish, name: 'Midnight Black' },
            { id: 'silver' as DeviceFrameFinish, name: 'Silver Steel' },
            { id: 'gold' as DeviceFrameFinish, name: 'Gold Champagne' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onConfigChange({ deviceFinish: item.id })}
              className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                config.deviceFinish === item.id
                  ? 'bg-zinc-800 border-blue-500/70 text-white font-medium shadow-xs'
                  : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full border border-white/20 ${
                  item.id === 'titanium'
                    ? 'bg-zinc-600'
                    : item.id === 'midnight'
                    ? 'bg-zinc-900'
                    : item.id === 'silver'
                    ? 'bg-zinc-300'
                    : 'bg-amber-400'
                }`}
              />
              <span className="text-[11px] truncate">{item.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Gliding Speed */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-1.5 font-medium text-zinc-300">
            <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
            <span>Gliding Speed</span>
          </label>
          <span className="font-mono text-[11px] text-zinc-400 capitalize">
            {config.scrollSpeed.replace('-', ' ')}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-xs">
          {[
            { id: 'very-slow' as const, label: 'Very Slow' },
            { id: 'slow' as const, label: 'Slow' },
            { id: 'normal' as const, label: 'Normal' },
            { id: 'fast' as const, label: 'Fast' },
          ].map((spd) => (
            <button
              key={spd.id}
              type="button"
              onClick={() => onConfigChange({ scrollSpeed: spd.id })}
              className={`py-2 px-1 rounded-lg border text-center text-[11px] transition-all cursor-pointer ${
                config.scrollSpeed === spd.id
                  ? 'bg-zinc-800 border-zinc-600 text-white font-semibold'
                  : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {spd.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Motion Easing (Smooth vs Linear) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-1.5 font-medium text-zinc-300">
            <Activity className="w-3.5 h-3.5 text-zinc-400" />
            <span>Motion Easing</span>
          </label>
          <span className="text-[11px] text-zinc-400 capitalize">
            {config.easing}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => onConfigChange({ easing: 'smooth' })}
            className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
              config.easing === 'smooth'
                ? 'bg-zinc-800 border-blue-500/70 text-white font-medium shadow-xs ring-1 ring-blue-500/30'
                : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-100">Smooth</span>
              <span className={`w-2 h-2 rounded-full ${config.easing === 'smooth' ? 'bg-blue-400' : 'bg-transparent'}`} />
            </div>
            <span className="text-[10px] text-zinc-400 leading-tight">
              Natural ease-in / ease-out
            </span>
          </button>

          <button
            type="button"
            onClick={() => onConfigChange({ easing: 'linear' })}
            className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
              config.easing === 'linear'
                ? 'bg-zinc-800 border-blue-500/70 text-white font-medium shadow-xs ring-1 ring-blue-500/30'
                : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-100">Linear</span>
              <span className={`w-2 h-2 rounded-full ${config.easing === 'linear' ? 'bg-blue-400' : 'bg-transparent'}`} />
            </div>
            <span className="text-[10px] text-zinc-400 leading-tight">
              Constant continuous velocity
            </span>
          </button>
        </div>
      </div>

      {/* 5. Toggles for Shadows & Glass Glare */}
      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs">
        <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={config.showGlare}
            onChange={(e) => onConfigChange({ showGlare: e.target.checked })}
            className="rounded-sm border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-0"
          />
          <span>Glass Reflection Glare</span>
        </label>

        <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={config.showShadows}
            onChange={(e) => onConfigChange({ showShadows: e.target.checked })}
            className="rounded-sm border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-0"
          />
          <span>Deep Drop Shadows</span>
        </label>
      </div>
    </div>
  );
};
