import React from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { Kbd } from "./Kbd";

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuGroup = DropdownPrimitive.Group;
export const DropdownMenuSub = DropdownPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownPrimitive.RadioGroup;

export const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  DropdownPrimitive.DropdownMenuContentProps
>(({ className, sideOffset = 4, children, ...props }, ref) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={clsx(
        "z-50 min-w-[160px] p-1 rounded-md shadow-xl outline-none select-none",
        "bg-[var(--color-panel)] border border-[var(--color-line)] text-[var(--color-text)]",
        "animate-in fade-in-0 zoom-in-95",
        className,
      )}
      {...props}
    >
      {children}
    </DropdownPrimitive.Content>
  </DropdownPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export interface DropdownMenuItemProps extends DropdownPrimitive.DropdownMenuItemProps {
  shortcut?: string;
  icon?: React.ReactNode;
  danger?: boolean;
}

export const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ className, shortcut, icon, danger, children, ...props }, ref) => (
    <DropdownPrimitive.Item
      ref={ref}
      className={clsx(
        "relative flex items-center justify-between px-2.5 py-1.5 text-[12px] font-medium rounded-xs cursor-pointer outline-none select-none transition-colors",
        "data-[highlighted]:bg-[var(--color-hover)]",
        danger
          ? "text-[var(--color-danger)] data-[highlighted]:bg-[var(--color-danger)]/10"
          : "text-[var(--color-text)]",
        "data-[disabled]:opacity-40 data-[disabled]:pointer-events-none",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="shrink-0 text-[var(--color-text-2)]">{icon}</span>}
        <span>{children}</span>
      </div>
      {shortcut && <Kbd className="ml-auto">{shortcut}</Kbd>}
    </DropdownPrimitive.Item>
  ),
);
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  DropdownPrimitive.DropdownMenuSeparatorProps
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.Separator
    ref={ref}
    className={clsx("h-[1px] bg-[var(--color-line)] my-1 -mx-1", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";
