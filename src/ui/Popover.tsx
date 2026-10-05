import React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import clsx from "clsx";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export interface PopoverContentProps extends PopoverPrimitive.PopoverContentProps {
  className?: string;
  children: React.ReactNode;
}

export const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, align = "center", sideOffset = 6, children, ...props }, ref) => {
    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          className={clsx(
            "z-50 min-w-[200px] p-3 rounded-md shadow-2xl outline-none select-none",
            "bg-[var(--color-panel)] border border-[var(--color-line)] text-[var(--color-text)]",
            "animate-in fade-in-0 zoom-in-95",
            className,
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    );
  },
);

PopoverContent.displayName = "PopoverContent";
