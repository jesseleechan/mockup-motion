/**
 * The editor's theme preference (docs/restyle-plan/README.md, R1). System follows the operating
 * system; Light and Dark override it. `<html data-theme>` holds a picked Light or Dark, and System
 * sets none, so the prefers-color-scheme tokens in src/ui/theme.css apply. The script in
 * index.html applies a saved choice before first paint by the same rule.
 */
export type ThemePreference = "system" | "light" | "dark";

/** The theme the editor shows. */
export type Theme = "light" | "dark";

/** This browser's saved preference. It held "light" or "dark" before System existed. */
export const THEME_STORAGE_KEY = "mockupmotion_theme";

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

const NEXT: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

/** The toggle cycles System → Light → Dark → System. */
export function nextThemePreference(preference: ThemePreference): ThemePreference {
  return NEXT[preference];
}

/** A saved value: "light" and "dark" stay; anything else, nothing saved included, is System. */
export function parseThemePreference(saved: string | null): ThemePreference {
  return saved === "light" || saved === "dark" ? saved : "system";
}

/** The theme a preference shows: System takes the system's setting. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Theme {
  if (preference !== "system") return preference;
  return systemPrefersDark ? "dark" : "light";
}

/** The saved preference, or System when there is none or storage can't be read. */
export function loadThemePreference(storage: Pick<Storage, "getItem"> | null): ThemePreference {
  if (!storage) return "system";
  try {
    return parseThemePreference(storage.getItem(THEME_STORAGE_KEY));
  } catch (err) {
    if (!(err instanceof DOMException)) throw err;
    console.warn("[Theme] could not read the saved theme:", err);
    return "system";
  }
}

/**
 * Saves the preference for this browser. System removes the key, as on a first visit. Storage
 * can be full or blocked; the choice then lasts for this session.
 */
export function saveThemePreference(
  storage: Pick<Storage, "setItem" | "removeItem"> | null,
  preference: ThemePreference,
): void {
  if (!storage) return;
  try {
    if (preference === "system") storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, preference);
  } catch (err) {
    if (!(err instanceof DOMException)) throw err;
    console.warn("[Theme] could not save the theme:", err);
  }
}

/** Sets `data-theme` for a picked Light or Dark, and removes it for System. */
export function applyThemePreference(
  root: Pick<Element, "setAttribute" | "removeAttribute">,
  preference: ThemePreference,
): void {
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
}
