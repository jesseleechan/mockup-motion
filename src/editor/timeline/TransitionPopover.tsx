import React from "react";
import type { EasingId, Transition } from "../../doc/types";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Slider,
  Select,
  Icon,
} from "../../ui";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Scissors,
  Layers,
  Eye,
  MoveRight,
  Maximize2,
  Paintbrush,
} from "lucide-react";

export interface TransitionPopoverProps {
  transition: Transition;
  onChange: (transition: Transition) => void;
  children: React.ReactNode;
  align?: "center" | "start" | "end";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TRANSITION_KINDS: Array<{
  id: Transition["kind"];
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  desc: string;
}> = [
  { id: "cut", label: "Cut", icon: Scissors, desc: "Instant cut" },
  { id: "fade", label: "Fade", icon: Layers, desc: "Smooth crossfade" },
  { id: "blur", label: "Blur", icon: Eye, desc: "Lens blur peak" },
  { id: "push", label: "Push", icon: MoveRight, desc: "Slide along direction" },
  { id: "zoom", label: "Zoom", icon: Maximize2, desc: "Scale into view" },
  { id: "wipe", label: "Wipe", icon: Paintbrush, desc: "Diagonal feather wipe" },
];

const EASING_OPTIONS: Array<{ value: EasingId; label: string }> = [
  { value: "quintInOut", label: "Quintic (Smooth In/Out)" },
  { value: "smooth", label: "Smooth" },
  { value: "gentle", label: "Gentle" },
  { value: "linear", label: "Linear" },
  { value: "expoOut", label: "Exponential Out" },
  { value: "backOut", label: "Back Out (Overshoot)" },
  { value: "spring", label: "Spring (Elastic)" },
];

export const TransitionPopover: React.FC<TransitionPopoverProps> = ({
  transition,
  onChange,
  children,
  align = "center",
  open,
  onOpenChange,
}) => {
  const currentKind = transition.kind;
  const currentDuration = transition.duration;
  const currentEasing = transition.easing;
  const currentDirection = transition.direction ?? "left";

  const handleKindSelect = (kind: Transition["kind"]) => {
    onChange({
      ...transition,
      kind,
      duration: kind === "cut" ? 0 : transition.duration || 0.7,
      direction: kind === "push" || kind === "wipe" ? currentDirection : undefined,
    });
  };

  const handleDurationChange = (duration: number) => {
    onChange({
      ...transition,
      duration: Number(duration.toFixed(2)),
    });
  };

  const handleEasingChange = (easing: EasingId) => {
    onChange({
      ...transition,
      easing,
    });
  };

  const handleDirectionChange = (direction: "left" | "right" | "up" | "down") => {
    onChange({
      ...transition,
      direction,
    });
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={8}
        className="w-[280px] p-3 space-y-3 bg-[var(--color-panel)] border border-[var(--color-line)] shadow-2xl rounded-lg text-xs"
      >
        <style>{`
          @keyframes anim-preview-fade {
            0%, 100% { opacity: 0.2; }
            50% { opacity: 1; }
          }
          @keyframes anim-preview-blur {
            0%, 100% { filter: blur(0px); opacity: 0.5; }
            50% { filter: blur(2.5px); opacity: 1; }
          }
          @keyframes anim-preview-push {
            0% { transform: translateX(50%); opacity: 0.2; }
            50% { transform: translateX(0); opacity: 1; }
            100% { transform: translateX(-50%); opacity: 0.2; }
          }
          @keyframes anim-preview-zoom {
            0% { transform: scale(0.85); opacity: 0.3; }
            50% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(0.85); opacity: 0.3; }
          }
          @keyframes anim-preview-wipe {
            0% { clip-path: polygon(0 0, 0 0, 0 100%, 0 100%); }
            50% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
            100% { clip-path: polygon(100% 0, 100% 0, 100% 100%, 100% 100%); }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-2">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--color-text)]">
            <Icon icon={Sparkles} size={13} className="text-[var(--color-accent)]" />
            <span>Transition</span>
          </div>
          <span className="text-[10px] text-[var(--color-text-3)] font-mono uppercase tracking-wider">
            {currentKind}
          </span>
        </div>

        {/* Kind Grid */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-[var(--color-text-2)]">Style</span>
          <div className="grid grid-cols-3 gap-1.5">
            {TRANSITION_KINDS.map((k) => {
              const active = currentKind === k.id;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => handleKindSelect(k.id)}
                  title={k.desc}
                  className={`flex flex-col items-center gap-1 p-2 rounded-md border text-center transition-all ${
                    active
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]/25 text-[var(--color-text)] shadow-xs"
                      : "border-[var(--color-line)] bg-[var(--color-raised)] text-[var(--color-text-2)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {/* Miniature animated visual preview */}
                  <div className="w-6 h-4 rounded-xs bg-[var(--color-bg)] border border-[var(--color-line)] overflow-hidden flex items-center justify-center relative">
                    {k.id === "fade" && (
                      <div
                        className="w-full h-full bg-[var(--color-accent)] rounded-xs"
                        style={{ animation: "anim-preview-fade 1.8s infinite ease-in-out" }}
                      />
                    )}
                    {k.id === "blur" && (
                      <div
                        className="w-full h-full bg-[var(--color-accent)] rounded-xs"
                        style={{ animation: "anim-preview-blur 1.8s infinite ease-in-out" }}
                      />
                    )}
                    {k.id === "push" && (
                      <div
                        className="w-full h-full bg-[var(--color-accent)] rounded-xs"
                        style={{ animation: "anim-preview-push 1.8s infinite ease-in-out" }}
                      />
                    )}
                    {k.id === "zoom" && (
                      <div
                        className="w-full h-full bg-[var(--color-accent)] rounded-xs"
                        style={{ animation: "anim-preview-zoom 1.8s infinite ease-in-out" }}
                      />
                    )}
                    {k.id === "wipe" && (
                      <div
                        className="w-full h-full bg-[var(--color-accent)] rounded-xs"
                        style={{ animation: "anim-preview-wipe 1.8s infinite ease-in-out" }}
                      />
                    )}
                    {k.id === "cut" && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-3)]" />
                    )}
                  </div>
                  <span className="text-[10px] font-medium leading-none">{k.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Controls when not cut */}
        {currentKind !== "cut" && (
          <div className="space-y-3 pt-1 border-t border-[var(--color-line)]">
            {/* Duration slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-[var(--color-text-2)]">Duration</span>
                <span className="font-mono text-[var(--color-text)] font-semibold">
                  {currentDuration.toFixed(2)}s
                </span>
              </div>
              <Slider
                value={currentDuration}
                min={0.2}
                max={1.5}
                step={0.05}
                onChange={handleDurationChange}
                aria-label="Transition duration"
              />
            </div>

            {/* Easing selector */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-[var(--color-text-2)]">Easing</span>
              <Select<EasingId>
                value={currentEasing}
                onChange={handleEasingChange}
                options={EASING_OPTIONS}
                aria-label="Transition easing"
                size="sm"
              />
            </div>

            {/* Direction buttons for push and wipe */}
            {(currentKind === "push" || currentKind === "wipe") && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-[var(--color-text-2)]">Direction</span>
                <div className="grid grid-cols-4 gap-1">
                  {(["left", "right", "up", "down"] as const).map((dir) => {
                    const isDirActive = currentDirection === dir;
                    return (
                      <button
                        key={dir}
                        type="button"
                        onClick={() => handleDirectionChange(dir)}
                        className={`p-1.5 rounded-md border flex items-center justify-center transition-all ${
                          isDirActive
                            ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]/20 text-[var(--color-text)]"
                            : "border-[var(--color-line)] bg-[var(--color-raised)] text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:border-[var(--color-line-strong)]"
                        }`}
                        title={`Slide ${dir}`}
                      >
                        {dir === "left" && <Icon icon={ArrowLeft} size={13} />}
                        {dir === "right" && <Icon icon={ArrowRight} size={13} />}
                        {dir === "up" && <Icon icon={ArrowUp} size={13} />}
                        {dir === "down" && <Icon icon={ArrowDown} size={13} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
