import React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { Icon } from "./Icon";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

export function Select<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: SelectProps<T>) {
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(val) => onChange(val as T)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        aria-label={ariaLabel ?? placeholder ?? "Select option"}
        className={clsx(
          "inline-flex items-center justify-between w-full font-medium select-none cursor-pointer",
          "bg-[var(--color-panel)] text-[var(--color-text)] border border-[var(--color-line)] shadow-xs rounded-sm transition-colors",
          "hover:bg-[var(--color-hover)] hover:border-[var(--color-line-strong)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
          "disabled:opacity-40 disabled:pointer-events-none",
          size === "sm" && "h-7 px-2 text-[12px]",
          size === "md" && "h-8 px-2.5 text-[13px]",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <Icon
            icon={ChevronDown}
            size={14}
            className="text-[var(--color-text-3)] shrink-0 ml-1.5"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={clsx(
            "z-50 min-w-[120px] max-h-72 overflow-y-auto p-1 rounded-md shadow-xl",
            "bg-[var(--color-panel)] border border-[var(--color-line)] text-[var(--color-text)] select-none",
            "animate-in fade-in-0 zoom-in-95",
          )}
        >
          <SelectPrimitive.Viewport>
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className={clsx(
                  "relative flex items-center justify-between px-2.5 py-1.5 text-[12px] font-medium rounded-xs cursor-pointer outline-none select-none",
                  "data-[highlighted]:bg-[var(--color-hover)] data-[highlighted]:text-[var(--color-text)]",
                  "data-[state=checked]:font-semibold",
                  "data-[disabled]:opacity-40 data-[disabled]:pointer-events-none",
                )}
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <Icon
                    icon={Check}
                    size={14}
                    className="text-[var(--color-accent)] shrink-0 ml-2"
                  />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
