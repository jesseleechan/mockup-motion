import type { ExportSettings } from "../doc/types";
import { sanitizeExport } from "../doc/validate";

/** This browser's last export settings, which a new project starts from. */
export const LAST_EXPORT_KEY = "mockupmotion.lastExport";

/**
 * Local storage, or null where there is none (Node, or a browser that blocks site data, where
 * merely reading `localStorage` throws a SecurityError).
 */
function browserStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch (err) {
    if (err instanceof DOMException) return null;
    throw err;
  }
}

/** The last export settings saved in this browser, or null if there are none. */
export function readLastExport(storage = browserStorage()): ExportSettings | null {
  const raw = storage?.getItem(LAST_EXPORT_KEY);
  if (!raw) return null;
  try {
    return sanitizeExport(JSON.parse(raw));
  } catch (err) {
    // A value another version wrote badly is the same as none.
    if (err instanceof SyntaxError) return null;
    throw err;
  }
}

export function writeLastExport(settings: ExportSettings, storage = browserStorage()): void {
  try {
    storage?.setItem(LAST_EXPORT_KEY, JSON.stringify(settings));
  } catch (err) {
    // A full or blocked storage only costs the next new project its starting settings.
    if (err instanceof DOMException) return;
    throw err;
  }
}
