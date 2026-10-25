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
      // On is the accent with a paper knob. Off is Layout Stage's: a field track with a strong
      // hairline and a text-2 knob, so the switch keeps 3:1 against the panel either way.
      className={clsx(
        "inline-flex items-center h-4 w-7 shrink-0 cursor-pointer rounded-full p-0.5 border transition-colors duration-180 select-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "data-[state=checked]:bg-accent data-[state=checked]:border-accent",
        "data-[state=unchecked]:bg-field data-[state=unchecked]:border-line-strong",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
    >
      <SwitchPrimitive.Thumb
        className={clsx(
          "pointer-events-none block h-3 w-3 rounded-full transition-[transform,background-color] duration-180",
          "data-[state=checked]:translate-x-3 data-[state=checked]:bg-paper",
          "data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-text-2",
        )}
      />
    </SwitchPrimitive.Root>
  );
};
