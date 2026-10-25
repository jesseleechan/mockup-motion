import React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { Icon } from "./Icon";
import { MENU_ITEM, MENU_ITEM_TONE, MENU_SURFACE } from "./menu-styles";

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
  "aria-describedby"?: string;
  /**
   * The options are user content (file names): the value may truncate with an ellipsis.
   * Our own option labels must fit, so the overflow guard (F08) flags them if they don't.
   */
  userContent?: boolean;
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
  "aria-describedby": ariaDescribedBy,
  userContent = false,
}: SelectProps<T>) {
  const selectedLabel = options.find((opt) => opt.value === value)?.label;
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(val) => onChange(val as T)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        aria-label={ariaLabel ?? placeholder ?? "Select option"}
        aria-describedby={ariaDescribedBy}
        // Layout Stage's select: paper with the hairline lift, radius 9, 32 px (28 px at sm).
        className={clsx(
          "inline-flex items-center justify-between w-full min-w-0 whitespace-nowrap font-medium select-none cursor-pointer",
          "bg-paper text-text shadow-lift-sm rounded-[9px] transition-shadow duration-120",
          "hover:shadow-lift-sm-hover data-[state=open]:shadow-lift-sm-hover",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          "disabled:opacity-40 disabled:pointer-events-none",
          size === "sm" && "h-7 pl-2 pr-1.5 text-[12px]",
          size === "md" && "h-8 pl-2.5 pr-2 text-[13px]",
          className,
        )}
      >
        <span
          className="min-w-0 flex-1 truncate text-left"
          title={selectedLabel}
          data-truncate={userContent ? "" : undefined}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <Icon icon={ChevronDown} size={14} className="text-text-2 shrink-0 ml-1.5" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          // At least as wide as the trigger, as a menu that hangs from it.
          className={clsx(
            "z-50 min-w-[max(120px,var(--radix-select-trigger-width))] max-h-72 overflow-y-auto p-1",
            MENU_SURFACE,
            "animate-in fade-in-0 zoom-in-95",
          )}
        >
          <SelectPrimitive.Viewport>
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className={clsx(MENU_ITEM, MENU_ITEM_TONE, "data-[state=checked]:font-semibold")}
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <Icon icon={Check} size={14} className="text-accent shrink-0" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
