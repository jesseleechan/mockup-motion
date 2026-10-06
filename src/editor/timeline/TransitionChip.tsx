import React, { useState } from "react";
import type { Transition } from "../../doc/types";
import { TransitionPopover } from "./TransitionPopover";
import { Icon } from "../../ui";
import { Scissors, Layers, Eye, MoveRight, Maximize2, Paintbrush, Repeat } from "lucide-react";
import { TRANSITION_LABELS } from "../labels";

export interface TransitionChipProps {
  transition: Transition;
  onChange: (transition: Transition) => void;
  isLoopWrap?: boolean;
  align?: "center" | "start" | "end";
}

export const TransitionChip: React.FC<TransitionChipProps> = ({
  transition,
  onChange,
  isLoopWrap = false,
  align = "center",
}) => {
  const [open, setOpen] = useState(false);

  const getIcon = () => {
    switch (transition.kind) {
      case "cut":
        return Scissors;
      case "fade":
        return Layers;
      case "blur":
        return Eye;
      case "push":
        return MoveRight;
      case "zoom":
        return Maximize2;
      case "wipe":
        return Paintbrush;
      default:
        return Layers;
    }
  };

  const IconComp = getIcon();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  };

  return (
    <TransitionPopover
      transition={transition}
      onChange={onChange}
      align={align}
      open={open}
      onOpenChange={setOpen}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={
          isLoopWrap
            ? `Loop wrap transition: ${TRANSITION_LABELS[transition.kind]}`
            : `Transition: ${TRANSITION_LABELS[transition.kind]}`
        }
        onKeyDown={handleKeyDown}
        className={`group relative z-10 flex items-center justify-center -mx-2.5 h-6 px-1.5 rounded-full border cursor-pointer select-none transition-all outline-none ${
          open
            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)] shadow-md scale-105"
            : transition.kind === "cut"
              ? "border-[var(--color-line)] bg-[var(--color-raised)] text-[var(--color-text-3)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-text)]"
              : "border-[var(--color-line-strong)] bg-[var(--color-panel)] text-[var(--color-text-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:scale-105 shadow-xs"
        }`}
      >
        <div className="flex items-center gap-1 text-[10px] font-mono">
          <Icon icon={isLoopWrap ? Repeat : IconComp} size={11} />
          {transition.kind !== "cut" && (
            <span className="font-semibold">{transition.duration.toFixed(1)}s</span>
          )}
        </div>

        {/* Hover label */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-[var(--color-panel)] border border-[var(--color-line)] px-1.5 py-0.5 rounded text-[9px] text-[var(--color-text-2)] whitespace-nowrap shadow-sm">
          {isLoopWrap
            ? `Loop: ${TRANSITION_LABELS[transition.kind].toLowerCase()}`
            : TRANSITION_LABELS[transition.kind]}
        </div>
      </div>
    </TransitionPopover>
  );
};
