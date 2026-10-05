import React, { useEffect, useRef, useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import clsx from "clsx";
import { calculateScrubValue } from "./scrub";

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}) => {
  return (
    <SliderPrimitive.Root
      value={[value]}
      onValueChange={(val) => onChange(val[0])}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={ariaLabel}
      className={clsx(
        "relative flex items-center select-none touch-none w-full h-5 cursor-pointer",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
    >
      <SliderPrimitive.Track className="relative grow h-1 rounded-full bg-[var(--color-line)] overflow-hidden">
        <SliderPrimitive.Range className="absolute h-full bg-[var(--color-accent)] rounded-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel ?? "Slider"}
        className={clsx(
          "block w-3.5 h-3.5 bg-[var(--color-text)] rounded-full shadow-md border border-[var(--color-line-strong)]",
          "transition-transform hover:scale-110 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
        )}
      />
    </SliderPrimitive.Root>
  );
};

export interface ScrubLabelProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  precision?: number;
  disabled?: boolean;
  className?: string;
}

export const ScrubLabel: React.FC<ScrubLabelProps> = ({
  label,
  value,
  onChange,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  precision,
  disabled = false,
  className,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  const startState = useRef<{ startX: number; startVal: number } | null>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handlePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (disabled || isEditing) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startState.current = {
      startX: e.clientX,
      startVal: value,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!startState.current) return;
    const deltaX = e.clientX - startState.current.startX;
    const nextVal = calculateScrubValue({
      startValue: startState.current.startVal,
      deltaX,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      step,
      min,
      max,
    });
    onChange(nextVal);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (startState.current) {
      const target = e.target as HTMLElement;
      if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
      startState.current = null;
    }
  };

  const handleDoubleClick = () => {
    if (disabled) return;
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    }
  };

  const commitEdit = () => {
    setIsEditing(false);
    const num = parseFloat(editValue);
    if (!isNaN(num)) {
      const clamped = Math.min(max, Math.max(min, num));
      onChange(clamped);
    }
  };

  const formatDisplay = (val: number) => {
    if (precision !== undefined) return val.toFixed(precision);
    if (step < 1) {
      const dec = -Math.floor(Math.log10(step));
      return val.toFixed(Math.max(1, dec));
    }
    return String(Math.round(val * 100) / 100);
  };

  return (
    <div
      className={clsx(
        "flex items-center justify-between text-[12px] select-none py-0.5",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
    >
      <span
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        title="Drag horizontally to scrub value. Double-click to reset."
        className="cursor-ew-resize font-medium text-[var(--color-text-2)] hover:text-[var(--color-text)] transition-colors"
      >
        {label}
      </span>

      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setIsEditing(false);
          }}
          step={step}
          min={min}
          max={max}
          className="w-16 h-5 px-1 text-right text-[11px] font-mono bg-[var(--color-panel)] text-[var(--color-text)] border border-[var(--color-accent)] rounded-xs outline-none"
        />
      ) : (
        <span
          onClick={() => {
            if (disabled) return;
            setEditValue(String(value));
            setIsEditing(true);
          }}
          title="Click to type value"
          className="ui-tabular text-[12px] font-mono text-[var(--color-text)] hover:text-[var(--color-accent)] cursor-text px-1 py-0.5 rounded-xs hover:bg-[var(--color-raised)] transition-colors"
        >
          {formatDisplay(value)}
          {unit && <span className="text-[var(--color-text-3)] ml-0.5">{unit}</span>}
        </span>
      )}
    </div>
  );
};
