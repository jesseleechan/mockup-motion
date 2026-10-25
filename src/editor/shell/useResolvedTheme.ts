import { useSyncExternalStore } from "react";
import { resolveTheme, type Theme, type ThemePreference } from "./theme-preference";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** The theme the editor shows. System follows the system's setting as it changes. */
export function useResolvedTheme(preference: ThemePreference): Theme {
  return resolveTheme(preference, useSyncExternalStore(subscribe, systemPrefersDark));
}
