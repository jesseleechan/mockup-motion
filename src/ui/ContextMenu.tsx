import React from "react";
import * as ContextPrimitive from "@radix-ui/react-context-menu";
import clsx from "clsx";
import { Kbd } from "./Kbd";

export const ContextMenu = ContextPrimitive.Root;
export const ContextMenuTrigger = ContextPrimitive.Trigger;
export const ContextMenuGroup = ContextPrimitive.Group;

export const ContextMenuContent = React.forwardRef<
  HTMLDivElement,
  ContextPrimitive.ContextMenuContentProps
>(({ className, children, ...props }, ref) => (
  <ContextPrimitive.Portal>
    <ContextPrimitive.Content
      ref={ref}
      className={clsx(
        "z-50 min-w-[160px] p-1 rounded-md shadow-2xl outline-none select-none",
        "bg-[var(--color-panel)] border border-[var(--color-line)] text-[var(--color-text)]",
        "animate-in fade-in-0 zoom-in-95",
        className,
      )}
      {...props}
    >
      {children}
    </ContextPrimitive.Content>
  </ContextPrimitive.Portal>
));
ContextMenuContent.displayName = "ContextMenuContent";

export interface ContextMenuItemProps extends ContextPrimitive.ContextMenuItemProps {
  shortcut?: string;
  icon?: React.ReactNode;
  danger?: boolean;
}

export const ContextMenuItem = React.forwardRef<HTMLDivElement, ContextMenuItemProps>(
  ({ className, shortcut, icon, danger, children, ...props }, ref) => (
    <ContextPrimitive.Item
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
    </ContextPrimitive.Item>
  ),
);
ContextMenuItem.displayName = "ContextMenuItem";

export const ContextMenuSeparator = React.forwardRef<
  HTMLDivElement,
  ContextPrimitive.ContextMenuSeparatorProps
>(({ className, ...props }, ref) => (
  <ContextPrimitive.Separator
    ref={ref}
    className={clsx("h-[1px] bg-[var(--color-line)] my-1 -mx-1", className)}
    {...props}
  />
));
ContextMenuSeparator.displayName = "ContextMenuSeparator";
