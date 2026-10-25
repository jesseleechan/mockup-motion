import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  THEME_STORAGE_KEY,
  applyThemePreference,
  loadThemePreference,
  nextThemePreference,
  parseThemePreference,
  resolveTheme,
  saveThemePreference,
} from "../src/editor/shell/theme-preference";

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

describe("theme preference (restyle R1)", () => {
  it("cycles System → Light → Dark → System", () => {
    expect(nextThemePreference("system")).toBe("light");
    expect(nextThemePreference("light")).toBe("dark");
    expect(nextThemePreference("dark")).toBe("system");
  });

  it("reads the values saved before System existed, and anything else as System", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    for (const saved of [null, "", "system", "Dark", "auto"]) {
      expect(parseThemePreference(saved)).toBe("system");
    }
  });

  it("resolves System to the system's setting, and keeps a picked theme", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("saves Light and Dark, and System as nothing saved", () => {
    const storage = memoryStorage({ [THEME_STORAGE_KEY]: "dark" });
    expect(loadThemePreference(storage)).toBe("dark");
    saveThemePreference(storage, "light");
    expect(storage.items.get(THEME_STORAGE_KEY)).toBe("light");
    saveThemePreference(storage, "system");
    expect(storage.items.has(THEME_STORAGE_KEY)).toBe(false);
    expect(loadThemePreference(storage)).toBe("system");
    expect(loadThemePreference(null)).toBe("system");
  });

  it("keeps the choice for the session when storage refuses it, and rethrows other errors", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const full = {
      ...memoryStorage(),
      setItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
    };
    expect(() => saveThemePreference(full, "dark")).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();

    const broken = {
      ...memoryStorage(),
      setItem: () => {
        throw new TypeError("not storage");
      },
    };
    expect(() => saveThemePreference(broken, "dark")).toThrow(TypeError);
  });

  it("sets data-theme for Light and Dark and removes it for System", () => {
    const attributes = new Map<string, string>();
    const root = {
      setAttribute: (name: string, value: string) => void attributes.set(name, value),
      removeAttribute: (name: string) => void attributes.delete(name),
    };
    applyThemePreference(root, "dark");
    expect(attributes.get("data-theme")).toBe("dark");
    applyThemePreference(root, "system");
    expect(attributes.has("data-theme")).toBe(false);
  });

  it("is applied before first paint from the same key (index.html)", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    expect(html).toContain(`localStorage.getItem("${THEME_STORAGE_KEY}")`);
  });
});
