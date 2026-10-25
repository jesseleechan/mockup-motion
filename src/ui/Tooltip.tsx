import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import clsx from "clsx";
import { Kbd } from "./Kbd";

export interface TooltipProps {
  content: React.ReactNode;
  shortcut?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  delayDuration?: number;
  children: React.ReactElement;
  className?: string;
}

export const TooltipProvider = TooltipPrimitive.Provider;

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  shortcut,
  side = "top",
  align = "center",
  sideOffset = 6,
  delayDuration = 300,
  children,
  className,
}) => {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          // The menu's surface (menu-styles.ts), at a tooltip's size.
          className={clsx(
            "z-50 flex items-center gap-2 px-2 py-1.5 text-[11.5px] font-medium leading-none rounded-[8px]",
            "border border-line bg-paper text-text shadow-menu select-none",
            "animate-in fade-in-0 zoom-in-95",
            className,
          )}
        >
          <span>{content}</span>
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
};
