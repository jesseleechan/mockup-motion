/** The parts of a focused element the shortcut rules read. Every HTMLElement has them. */
export interface KeyTarget {
  tagName: string;
  isContentEditable: boolean;
  getAttribute(name: string): string | null;
}

/** The parts of a keydown the shortcut rules read. */
export interface ShortcutKeyEvent {
  code: string;
  defaultPrevented: boolean;
  target: EventTarget | KeyTarget | null;
}

/**
 * Roles whose element acts on Space itself: it presses, toggles or selects. Radix renders
 * switches, tabs and segmented items as buttons with these roles. A slider is left out: Radix's
 * thumb and the timeline scrubber don't act on Space, so it still plays there.
 */
const SPACE_ROLES = new Set([
  "button",
  "checkbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "switch",
  "tab",
]);

/** The target as an element, or null for the window, the document or a text node. */
function asKeyTarget(target: EventTarget | KeyTarget | null): KeyTarget | null {
  if (!target || typeof (target as Partial<KeyTarget>).tagName !== "string") return null;
  if (typeof (target as Partial<KeyTarget>).getAttribute !== "function") return null;
  return target as KeyTarget;
}

function takesText(el: KeyTarget): boolean {
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable === true;
}

function actsOnSpace(el: KeyTarget): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "button" || tag === "summary") return true;
  const role = el.getAttribute("role");
  return role !== null && SPACE_ROLES.has(role);
}

/** Whether an event target takes typed text, so editor shortcuts and paste leave it alone. */
export function isTypingTarget(el: EventTarget | KeyTarget | null): boolean {
  const target = asKeyTarget(el);
  return target !== null && takesText(target);
}

/**
 * Whether the editor's global shortcuts leave a keydown to the focused element:
 * - a control already handled it (it called preventDefault), as a segmented control, a slider
 *   or a tab list does with the arrows, Home and End;
 * - the element takes typed text;
 * - it is Space, and the element acts on Space itself (a button, switch, chip, tab or
 *   segmented item), so Space presses it instead of playing.
 */
export function leavesKeyToFocus(e: ShortcutKeyEvent): boolean {
  if (e.defaultPrevented) return true;
  const el = asKeyTarget(e.target);
  if (!el) return false;
  if (takesText(el)) return true;
  return e.code === "Space" && actsOnSpace(el);
}
