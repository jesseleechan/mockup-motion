import React from "react";
import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Icon } from "./Icon";

export interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export const NumberField: React.FC<NumberFieldProps> = ({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  unit,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}) => {
  const clamp = (val: number) => Math.min(max, Math.max(min, val));

  const handleStep = (direction: 1 | -1) => {
    if (disabled) return;
    onChange(clamp(value + direction * step));
  };

  return (
    <div
      className={clsx(
        "relative inline-flex items-center h-7 bg-[var(--color-panel)] border border-[var(--color-line)] rounded-sm overflow-hidden",
        "focus-within:border-[var(--color-accent)] focus-within:ring-1 focus-within:ring-[var(--color-accent)]",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
    >
      <input
        type="number"
        value={isNaN(value) ? "" : value}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          if (!isNaN(val)) onChange(clamp(val));
        }}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        className="w-full h-full px-2 text-[12px] font-mono ui-tabular bg-transparent text-[var(--color-text)] outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {unit && (
        <span className="text-[11px] text-[var(--color-text-3)] pr-1.5 select-none">{unit}</span>
      )}
      <div className="flex flex-col border-l border-[var(--color-line)] shrink-0">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => handleStep(1)}
          className="h-3.5 px-1 flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]"
        >
          <Icon icon={ChevronUp} size={10} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => handleStep(-1)}
          className="h-3.5 px-1 flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] border-t border-[var(--color-line)]"
        >
          <Icon icon={ChevronDown} size={10} />
        </button>
      </div>
    </div>
  );
};
