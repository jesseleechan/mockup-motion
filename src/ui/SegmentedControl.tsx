import React, { useId } from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import clsx from "clsx";
import { Tooltip } from "./Tooltip";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  /**
   * Why the option can't be picked. The option stays focusable (aria-disabled), so the reason
   * shows on hover and focus and reaches screen readers.
   */
  reason?: string;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  disabled = false,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  const reasonPrefix = useId();
  const reasonId = (opt: SegmentedOption<T>) => `${reasonPrefix}-${opt.value}`;

  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(val) => {
        if (!val || options.find((opt) => opt.value === val)?.reason) return;
        onChange(val as T);
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      className={clsx(
        // Layout Stage's .seg: a paper pill over a field track at radius 12, inset 3 px.
        "inline-flex items-center gap-0.5 max-w-full min-w-0 p-[3px] bg-field rounded-[12px] select-none",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const unavailable = opt.reason !== undefined;
        const item = (
          <ToggleGroupPrimitive.Item
            key={opt.value}
            value={opt.value}
            disabled={opt.disabled}
            aria-disabled={unavailable || undefined}
            aria-describedby={unavailable ? reasonId(opt) : undefined}
            className={clsx(
              "inline-flex items-center justify-center min-w-0 whitespace-nowrap font-semibold rounded-[9px]",
              "transition-[background-color,box-shadow,color] duration-120",
              // A ring, not an outline, so it stays inside the track (frames.spec.ts reads it).
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              // sm makes a 32 px control, the height of a select; md 36 px.
              size === "sm" && "h-[26px] px-2.5 text-[11.5px] gap-1",
              size === "md" && "h-[30px] px-3 text-[12px] gap-1.5",
              isSelected ? "bg-paper text-text shadow-lift-sm" : "text-text-2",
              unavailable
                ? "opacity-40 cursor-not-allowed"
                : clsx("cursor-pointer", !isSelected && "hover:text-text"),
            )}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span className="truncate">{opt.label}</span>
          </ToggleGroupPrimitive.Item>
        );
        return unavailable ? (
          <Tooltip key={opt.value} content={opt.reason}>
            {item}
          </Tooltip>
        ) : (
          item
        );
      })}
      {/* Outside the items, so a reason describes its option without joining its name. */}
      {options.map(
        (opt) =>
          opt.reason !== undefined && (
            <span key={opt.value} id={reasonId(opt)} className="sr-only">
              {opt.reason}
            </span>
          ),
      )}
    </ToggleGroupPrimitive.Root>
  );
}
