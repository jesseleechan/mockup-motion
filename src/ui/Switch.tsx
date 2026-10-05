import React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import clsx from "clsx";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}) => {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={clsx(
        "inline-flex items-center h-4 w-7 shrink-0 cursor-pointer rounded-full p-0.5 border border-transparent transition-colors duration-180 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
        "data-[state=checked]:bg-[var(--color-accent)] data-[state=unchecked]:bg-[var(--color-line)]",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
    >
      <SwitchPrimitive.Thumb
        className={clsx(
          "pointer-events-none block h-3 w-3 rounded-full bg-white shadow-xs transition-transform duration-180",
          "data-[state=checked]:translate-x-3 data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
};
