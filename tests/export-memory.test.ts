import { afterEach, describe, expect, it, vi } from "vitest";
import { createDoc, defaultExport } from "../src/doc/defaults";
import { sanitizeDoc, sanitizeExport } from "../src/doc/validate";
import type { ExportSettings } from "../src/doc/types";
import { DESTINATION_PRESETS } from "../src/export/destinations";
import { LAST_EXPORT_KEY, readLastExport, writeLastExport } from "../src/export/last-settings";
import { createEditorStore } from "../src/state/store";

/** A minimal in-memory Storage. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

const WEB_BUNDLE: ExportSettings = {
  destination: "web-embed",
  resolution: 720,
  fps: 15,
  quality: "web",
  format: "bundle",
  supersample: 2,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("export settings in a saved project", () => {
  it("keep every value the dialog offers", () => {
    const saved = JSON.parse(JSON.stringify(createDoc({ export: WEB_BUNDLE })));
    expect(sanitizeDoc(saved).doc.export).toEqual(WEB_BUNDLE);
    expect(sanitizeExport({ ...WEB_BUNDLE, format: "png" }).format).toBe("png");
  });

  it("fall back to the MP4 default for values that no longer exist", () => {
    expect(
      sanitizeExport({ destination: "tiktok", resolution: 999, fps: 12, format: "gif" }),
    ).toEqual(defaultExport());
    expect(sanitizeExport(undefined)).toEqual(defaultExport());
  });

  it("default to the Custom preset, the dialog's MP4 at 1080p", () => {
    const { id, resolution, fps, quality, format, supersample } = DESTINATION_PRESETS.custom;
    expect(defaultExport()).toEqual({
      destination: id,
      resolution,
      fps,
      quality,
      format,
      supersample,
    });
  });
});

describe("this browser's last export", () => {
  it("round-trips through storage", () => {
    const storage = memoryStorage();
    expect(readLastExport(storage)).toBeNull();
    writeLastExport(WEB_BUNDLE, storage);
    expect(readLastExport(storage)).toEqual(WEB_BUNDLE);
  });

  it("is sanitised on read, and a corrupt value reads as none", () => {
    const old = memoryStorage({
      [LAST_EXPORT_KEY]: JSON.stringify({ ...WEB_BUNDLE, format: "gif" }),
    });
    expect(readLastExport(old)?.format).toBe("mp4");
    expect(readLastExport(memoryStorage({ [LAST_EXPORT_KEY]: "{not json" }))).toBeNull();
  });

  it("ignores a storage that refuses the write", () => {
    const full = memoryStorage();
    full.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
    expect(() => writeLastExport(WEB_BUNDLE, full)).not.toThrow();
  });
});

describe("the store", () => {
  it("starts a new project on the browser's last export, or the default", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    const store = createEditorStore();
    expect(store.getState().doc.export).toEqual(defaultExport());

    writeLastExport(WEB_BUNDLE);
    store.getState().newDoc();
    expect(store.getState().doc.export).toEqual(WEB_BUNDLE);
    expect(createEditorStore().getState().doc.export).toEqual(WEB_BUNDLE);
  });

  it("keeps an opened project's own settings", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    writeLastExport(WEB_BUNDLE);
    const saved = createDoc({ export: { ...defaultExport(), format: "webm" } });
    const store = createEditorStore(saved);
    expect(store.getState().doc.export.format).toBe("webm");
    store.getState().loadDoc(saved);
    expect(store.getState().doc.export.format).toBe("webm");
  });

  it("remembers a started export with the project and the browser, without an undo step", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    const store = createEditorStore();
    store.getState().apply((d) => {
      d.name = "Renamed";
    });
    expect(store.getState().past).toHaveLength(1);

    store.getState().rememberExport(WEB_BUNDLE);

    expect(store.getState().doc.export).toEqual(WEB_BUNDLE);
    expect(store.getState().past).toHaveLength(1);
    expect(readLastExport(storage)).toEqual(WEB_BUNDLE);
    // Undoing an edit made before the export keeps the export settings.
    store.getState().undo();
    expect(store.getState().doc.name).not.toBe("Renamed");
    expect(store.getState().doc.export).toEqual(WEB_BUNDLE);
  });
});
