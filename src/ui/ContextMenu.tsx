import React from "react";
import * as ContextPrimitive from "@radix-ui/react-context-menu";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { Icon } from "./Icon";
import { Kbd } from "./Kbd";
import {
  MENU_CONTENT,
  MENU_ICON,
  MENU_ITEM,
  MENU_ITEM_DANGER,
  MENU_ITEM_TONE,
  MENU_SEPARATOR,
} from "./menu-styles";

export const ContextMenu = ContextPrimitive.Root;
export const ContextMenuTrigger = ContextPrimitive.Trigger;
export const ContextMenuGroup = ContextPrimitive.Group;

export const ContextMenuContent = React.forwardRef<
  HTMLDivElement,
  ContextPrimitive.ContextMenuContentProps
>(({ className, children, ...props }, ref) => (
  <ContextPrimitive.Portal>
    <ContextPrimitive.Content ref={ref} className={clsx(MENU_CONTENT, className)} {...props}>
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
      className={clsx(MENU_ITEM, danger ? MENU_ITEM_DANGER : MENU_ITEM_TONE, className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        {icon && <span className={MENU_ICON}>{icon}</span>}
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
  <ContextPrimitive.Separator ref={ref} className={clsx(MENU_SEPARATOR, className)} {...props} />
));
ContextMenuSeparator.displayName = "ContextMenuSeparator";

export const ContextMenuSub = ContextPrimitive.Sub;

export const ContextMenuSubTrigger = React.forwardRef<
  HTMLDivElement,
  ContextPrimitive.ContextMenuSubTriggerProps & { icon?: React.ReactNode }
>(({ className, children, icon, ...props }, ref) => (
  <ContextPrimitive.SubTrigger
    ref={ref}
    className={clsx(MENU_ITEM, MENU_ITEM_TONE, "data-[state=open]:bg-field", className)}
    {...props}
  >
    <div className="flex items-center gap-2">
      {icon && <span className={MENU_ICON}>{icon}</span>}
      <span>{children}</span>
    </div>
    <Icon icon={ChevronRight} size={12} className={clsx(MENU_ICON, "ml-auto")} />
  </ContextPrimitive.SubTrigger>
));
ContextMenuSubTrigger.displayName = "ContextMenuSubTrigger";

export const ContextMenuSubContent = React.forwardRef<
  HTMLDivElement,
  ContextPrimitive.ContextMenuSubContentProps
>(({ className, children, ...props }, ref) => (
  <ContextPrimitive.Portal>
    <ContextPrimitive.SubContent ref={ref} className={clsx(MENU_CONTENT, className)} {...props}>
      {children}
    </ContextPrimitive.SubContent>
  </ContextPrimitive.Portal>
));
ContextMenuSubContent.displayName = "ContextMenuSubContent";
