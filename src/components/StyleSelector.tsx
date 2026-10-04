import React from 'react';
import { Smartphone, LayoutGrid, Check, Eye } from 'lucide-react';
import { AnimationStyle } from '../types';

interface StyleSelectorProps {
  selectedStyle: AnimationStyle;
  onStyleSelect: (style: AnimationStyle) => void;
  onContinue: () => void;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  selectedStyle,
  onStyleSelect,
  onContinue,
}) => {
  const styles = [
    {
      id: 'screenshot-rows' as AnimationStyle,
      title: 'Screenshot Rows',
      tagline: 'Horizontal rows of screenshots with smooth gliding motion',
      description:
        'Multiple rows of desktop and tablet website screenshots inside sleek rounded frames, gliding horizontally in alternating directions on a dark background.',
      idealFor: 'Full web design showcases, agency portfolios, multi-page platforms',
      icon: LayoutGrid,
      previewGraphic: (
        <div className="w-full h-40 bg-zinc-950 rounded-xl relative overflow-hidden flex flex-col justify-center p-2.5 gap-2 border border-zinc-800/80">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.12)_0%,transparent_75%)]" />

          {/* Row 1 (top) */}
          <div className="flex gap-2 -translate-x-8 opacity-75">
            <div className="w-32 h-10 rounded-md bg-zinc-800 border border-zinc-700/60 p-1 flex gap-1 items-center shrink-0">
              <div className="w-8 h-8 rounded bg-zinc-700 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="w-3/4 h-1.5 bg-zinc-600 rounded-xs" />
                <div className="w-1/2 h-1 bg-zinc-600 rounded-xs" />
              </div>
            </div>
            <div className="w-32 h-10 rounded-md bg-zinc-800 border border-zinc-700/60 p-1 flex gap-1 items-center shrink-0">
              <div className="w-8 h-8 rounded bg-zinc-700 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="w-3/4 h-1.5 bg-zinc-600 rounded-xs" />
                <div className="w-1/2 h-1 bg-zinc-600 rounded-xs" />
              </div>
            </div>
            <div className="w-32 h-10 rounded-md bg-zinc-800 border border-zinc-700/60 p-1 shrink-0" />
          </div>

          {/* Row 2 (middle - prominent) */}
          <div className="flex gap-2.5 translate-x-2">
            <div className="w-36 h-12 rounded-lg bg-zinc-800/90 border border-zinc-600/80 p-1.5 flex gap-1.5 items-center shrink-0 shadow-lg">
              <div className="w-9 h-9 rounded bg-blue-900/60 border border-blue-500/30 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="w-4/5 h-2 bg-zinc-400 rounded-xs" />
                <div className="w-3/5 h-1.5 bg-zinc-500 rounded-xs" />
              </div>
            </div>
            <div className="w-36 h-12 rounded-lg bg-zinc-800/90 border border-zinc-600/80 p-1.5 flex gap-1.5 items-center shrink-0 shadow-lg">
              <div className="w-9 h-9 rounded bg-indigo-900/60 border border-indigo-500/30 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="w-4/5 h-2 bg-zinc-400 rounded-xs" />
                <div className="w-3/5 h-1.5 bg-zinc-500 rounded-xs" />
              </div>
            </div>
          </div>

          {/* Row 3 (bottom) */}
          <div className="flex gap-2 -translate-x-12 opacity-75">
            <div className="w-32 h-10 rounded-md bg-zinc-800 border border-zinc-700/60 p-1 flex gap-1 items-center shrink-0">
              <div className="w-8 h-8 rounded bg-zinc-700 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="w-3/4 h-1.5 bg-zinc-600 rounded-xs" />
                <div className="w-1/2 h-1 bg-zinc-600 rounded-xs" />
              </div>
            </div>
            <div className="w-32 h-10 rounded-md bg-zinc-800 border border-zinc-700/60 p-1 flex gap-1 items-center shrink-0">
              <div className="w-8 h-8 rounded bg-zinc-700 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="w-3/4 h-1.5 bg-zinc-600 rounded-xs" />
                <div className="w-1/2 h-1 bg-zinc-600 rounded-xs" />
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'iphone-mockups' as AnimationStyle,
      title: 'iPhone Mockups',
      tagline: 'Two moving columns of iPhones with static screenshots',
      description:
        'Two sleek columns of iPhones gliding vertically in opposite directions with your static screenshots, featuring Dynamic Island cutouts and glass sheen on a dark background.',
      idealFor: 'Mobile websites, responsive design, app showcases, portfolio galleries',
      icon: Smartphone,
      previewGraphic: (
        <div className="w-full h-40 bg-zinc-950 rounded-xl relative overflow-hidden flex items-center justify-center p-2.5 gap-6 border border-zinc-800/80">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.12)_0%,transparent_75%)]" />

          {/* Left Column of Phones */}
          <div className="flex flex-col gap-2.5 translate-y-2">
            <div className="w-18 h-24 rounded-xl bg-zinc-900 border-2 border-zinc-600 p-1 flex flex-col overflow-hidden shadow-xl">
              <div className="w-full h-2.5 bg-zinc-950 flex items-center justify-center shrink-0">
                <div className="w-3.5 h-1 bg-black rounded-full" />
              </div>
              <div className="flex-1 bg-zinc-900 p-1 space-y-1">
                <div className="h-1.5 w-3/4 bg-rose-500/60 rounded-xs" />
                <div className="h-8 w-full bg-zinc-800 rounded-xs" />
              </div>
            </div>
            <div className="w-18 h-12 rounded-xl bg-zinc-900 border-2 border-zinc-700 p-1 flex flex-col overflow-hidden opacity-60">
              <div className="w-full h-2 bg-zinc-950 flex items-center justify-center shrink-0">
                <div className="w-3.5 h-1 bg-black rounded-full" />
              </div>
            </div>
          </div>

          {/* Right Column of Phones */}
          <div className="flex flex-col gap-2.5 -translate-y-3">
            <div className="w-18 h-12 rounded-xl bg-zinc-900 border-2 border-zinc-700 p-1 flex flex-col overflow-hidden opacity-60">
              <div className="w-full h-2 bg-zinc-950 flex items-center justify-center shrink-0">
                <div className="w-3.5 h-1 bg-black rounded-full" />
              </div>
            </div>
            <div className="w-18 h-24 rounded-xl bg-zinc-900 border-2 border-zinc-600 p-1 flex flex-col overflow-hidden shadow-xl">
              <div className="w-full h-2.5 bg-zinc-950 flex items-center justify-center shrink-0">
                <div className="w-3.5 h-1 bg-black rounded-full" />
              </div>
              <div className="flex-1 bg-zinc-900 p-1 space-y-1">
                <div className="h-1.5 w-3/4 bg-blue-500/60 rounded-xs" />
                <div className="h-8 w-full bg-zinc-800 rounded-xs" />
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-zinc-100">
          Pick Animation Style
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Choose between horizontal screenshot rows or multi-iPhone mockups.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {styles.map((style) => {
          const isSelected = selectedStyle === style.id;
          const Icon = style.icon;

          return (
            <div
              key={style.id}
              onClick={() => onStyleSelect(style.id)}
              className={`relative rounded-2xl p-5 border text-left cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-zinc-900/90 border-blue-500 ring-2 ring-blue-500/25 shadow-xl shadow-blue-500/10'
                  : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/70'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-zinc-100">
                        {style.title}
                      </h3>
                      <p className="text-xs text-zinc-400">{style.tagline}</p>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                      isSelected
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'border-zinc-700 bg-zinc-800/40 text-transparent'
                    }`}
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                </div>

                <div className="my-3">{style.previewGraphic}</div>

                <p className="text-xs leading-relaxed text-zinc-300 mt-2">
                  {style.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-500">
                <span className="font-semibold text-zinc-400">Best for: </span>
                <span>{style.idealFor}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
        >
          <span>Continue to Upload Screenshots →</span>
        </button>
      </div>
    </div>
  );
};
