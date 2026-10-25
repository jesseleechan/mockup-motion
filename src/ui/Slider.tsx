import React, { useEffect, useRef, useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import clsx from "clsx";
import { calculateScrubValue } from "./scrub";
import { formatStepValue } from "./slider-value";

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  /** Read with the value by screen readers; set on the thumb, which takes focus. */
  "aria-describedby"?: string;
}

/**
 * Layout Stage's pill slider (.prow): the whole 32 px pill is the track, filled with paper up to
 * the value, and the thumb is a thin line. Radix keeps the keyboard steps (arrows, Page Up and
 * Down, Home, End), min, max and step, and the slider role on the thumb. Clicking or dragging
 * anywhere on the pill sets the value.
 */
const PillSlider: React.FC<SliderProps & { children?: React.ReactNode }> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  children,
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
        "relative flex items-center w-full min-w-0 h-8 rounded-[10px] bg-field overflow-hidden select-none touch-none cursor-pointer",
        // The thumb is too thin to carry a focus ring, so the pill does, as in Layout Stage.
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
    >
      <SliderPrimitive.Track className="absolute inset-0">
        <SliderPrimitive.Range className="absolute inset-y-0 bg-paper" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel ?? "Slider"}
        aria-describedby={ariaDescribedBy}
        // 2 × 14 px. Layout Stage draws it in ink-3; text-2 keeps 3:1 on paper and field.
        className="block w-0.5 h-3.5 rounded-[1px] bg-text-2 focus-visible:outline-none"
      />
      {children}
    </SliderPrimitive.Root>
  );
};

/** The pill alone, for a Field that shows the label and value beside it. */
export const Slider: React.FC<SliderProps> = (props) => <PillSlider {...props} />;

export interface SliderRowProps extends SliderProps {
  /** Shown inside the pill on the left, and the slider's name unless `aria-label` is set. */
  label: string;
  /** The value as shown on the right, e.g. "25%". Defaults to the value at the step's precision. */
  output?: string;
}

/**
 * The pill slider as one row that carries its own label and value, as in Layout Stage's panels.
 * It replaces a Field around a Slider in one line:
 *
 *   <Field label="Grain" value="25%"><Slider aria-label="Grain" {...rest} /></Field>
 *   <SliderRow label="Grain" output="25%" {...rest} />
 *
 * Keep `aria-label` only where the slider's name differs from the visible label, e.g. label
 * "Hold" with aria-label "Hold at each stop".
 */
export const SliderRow: React.FC<SliderRowProps> = ({
  label,
  output,
  "aria-label": ariaLabel,
  ...slider
}) => (
  <PillSlider {...slider} aria-label={ariaLabel ?? label}>
    {/* Over the track, but clicks pass through to it. */}
    <span className="pointer-events-none absolute inset-0 flex items-center justify-between gap-3 px-[11px]">
      <span className="whitespace-nowrap text-[12px] font-medium text-text-2">{label}</span>
      <span className="whitespace-nowrap font-num text-[11.5px] tabular-nums text-text-2">
        {output ?? formatStepValue(slider.value, slider.step)}
      </span>
    </span>
  </PillSlider>
);

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
        className="cursor-ew-resize font-medium text-text-2 hover:text-text transition-colors"
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
          className="w-16 h-6 px-1.5 text-right text-[11.5px] font-num tabular-nums bg-paper text-text shadow-[0_0_0_1.5px_var(--color-accent)] rounded-[6px] outline-none"
        />
      ) : (
        <span
          onClick={() => {
            if (disabled) return;
            setEditValue(String(value));
            setIsEditing(true);
          }}
          title="Click to type value"
          className="ui-tabular text-[11.5px] text-text cursor-text px-1 py-0.5 rounded-[5px] hover:bg-field transition-colors"
        >
          {formatDisplay(value)}
          {unit && <span className="text-text-2 ml-0.5">{unit}</span>}
        </span>
      )}
    </div>
  );
};
