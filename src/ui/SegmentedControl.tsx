import React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import clsx from "clsx";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
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
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(val) => {
        if (val) onChange(val as T);
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      className={clsx(
        "inline-flex items-center p-0.5 bg-[var(--color-raised)] border border-[var(--color-line)] rounded-sm select-none",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <ToggleGroupPrimitive.Item
            key={opt.value}
            value={opt.value}
            disabled={opt.disabled}
            className={clsx(
              "inline-flex items-center justify-center font-medium rounded-xs transition-all duration-120 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
              size === "sm" && "h-6 px-2 text-[11px] gap-1",
              size === "md" && "h-7 px-2.5 text-[12px] gap-1.5",
              isSelected
                ? "bg-[var(--color-panel)] text-[var(--color-text)] shadow-xs font-semibold"
                : "text-[var(--color-text-2)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]",
            )}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
          </ToggleGroupPrimitive.Item>
        );
      })}
    </ToggleGroupPrimitive.Root>
  );
}
