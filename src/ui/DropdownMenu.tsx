import React from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { Kbd } from "./Kbd";
import {
  MENU_CONTENT,
  MENU_ICON,
  MENU_ITEM,
  MENU_ITEM_DANGER,
  MENU_ITEM_TONE,
  MENU_SEPARATOR,
} from "./menu-styles";

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
      className={clsx(MENU_CONTENT, className)}
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
      className={clsx(MENU_ITEM, danger ? MENU_ITEM_DANGER : MENU_ITEM_TONE, className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        {icon && <span className={MENU_ICON}>{icon}</span>}
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
  <DropdownPrimitive.Separator ref={ref} className={clsx(MENU_SEPARATOR, className)} {...props} />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";
