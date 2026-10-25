/**
 * Layout Stage's menu (components/panels.css, .menu): paper at radius 10 with a hairline and the
 * menu shadow, holding 30 px items at radius 6 that turn field on hover and keyboard focus.
 * Shared by DropdownMenu, ContextMenu, Select's list and Popover.
 */
export const MENU_SURFACE =
  "rounded-[10px] border border-line bg-paper text-text shadow-menu outline-none select-none";

export const MENU_CONTENT = `z-50 min-w-[160px] p-1 ${MENU_SURFACE} animate-in fade-in-0 zoom-in-95`;

export const MENU_ITEM = [
  "relative flex items-center justify-between gap-3 h-[30px] px-[9px] rounded-[6px]",
  "text-[12.5px] font-medium cursor-pointer outline-none select-none transition-colors",
  "data-[disabled]:opacity-40 data-[disabled]:pointer-events-none",
].join(" ");

/**
 * An item's text and highlight, kept apart from MENU_ITEM: two highlight backgrounds on one item
 * would conflict, and Tailwind orders same-property utilities by name, not by class order.
 */
export const MENU_ITEM_TONE = "text-text data-[highlighted]:bg-field";
export const MENU_ITEM_DANGER = "text-danger data-[highlighted]:bg-danger/10";

/** Icons in menu items are text-2, which keeps 3:1 or more on paper and field. */
export const MENU_ICON = "shrink-0 text-text-2";

export const MENU_SEPARATOR = "h-px bg-line my-1 -mx-1";
