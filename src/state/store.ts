import { create } from "zustand";
import { produce } from "immer";
import { newProjectDoc } from "../doc/defaults";
import { sanitizeDoc } from "../doc/validate";
import { replaceLayoutAssetIds } from "../doc/assets";
import { readLastExport, writeLastExport } from "../export/last-settings";
import type {
  AssetMeta,
  AssetRef,
  AssetRole,
  DeviceKind,
  ExportSettings,
  ProjectDoc,
  Shot,
  Style,
} from "../doc/types";
import {
  fitPace,
  fixedShotCamera,
  fixedShotDuration,
  isPacedShot,
  isSteppedLayout,
  minShotDuration,
  minShotScreenshots,
  setPace,
  steppedAssetIds,
  type Pace,
} from "../motion";
import { deleteBlob, getBlob, putBlob, saveProject } from "../storage";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface TemplateResult {
  style: Style;
  shots: Shot[];
  loop: boolean;
}

export interface EditorStoreState {
  doc: ProjectDoc;
  past: ProjectDoc[];
  future: ProjectDoc[];
  saveStatus: SaveStatus;
  saveError?: string;

  // Actions
  apply: (
    recipe: (draft: ProjectDoc) => void,
    opts?: { label?: string; coalesceKey?: string },
  ) => void;
  begin: () => void;
  end: () => void;
  undo: () => void;
  redo: () => void;
  loadDoc: (doc: ProjectDoc) => void;
  newDoc: () => void;
  /**
   * Saves the settings of an export that was started, with the project and as this browser's
   * starting point for new projects. Not an undo step: it doesn't change the video.
   */
  rememberExport: (settings: ExportSettings) => void;
  applyTemplateResult: (result: TemplateResult, templateId?: string) => void;
  /**
   * Adds assets. `replace` swaps screen asset ids in every shot (old id to new id) in the same
   * undo step, such as a full-page screenshot taking a short one's place in Scroll Story.
   */
  addAssets: (
    refs: AssetRef[],
    blobs?: Record<string, Blob>,
    replace?: Record<string, string>,
  ) => Promise<void>;
  /**
   * Adds assets and applies a template in one undo step. `build` receives the document with
   * the new assets already in it, so the template's slots can fill from them.
   */
  addAssetsAndApplyTemplate: (
    refs: AssetRef[],
    templateId: string,
    build: (doc: ProjectDoc) => TemplateResult,
    blobs?: Record<string, Blob>,
  ) => Promise<TemplateResult>;
  replaceAsset: (id: string, ref: AssetRef, blob?: Blob) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  setAssetRole: (id: string, role: AssetRole) => void;
  /** Merges capture section data into library screenshots (Responsive Scroll). */
  setAssetCaptures: (updates: { id: string; meta: Pick<AssetMeta, "sections" | "page"> }[]) => void;
  duplicateAsset: (id: string) => Promise<string>;
  reorderAssets: (orderedIds: string[]) => void;
  assignAssetToSlot: (shotIndex: number, slotKeyOrNodeId: string, assetId: string) => void;
  /** Adds a screenshot to a layout that shows a list of them (rows, columns, slider, orbit). */
  addAssetToShot: (shotIndex: number, assetId: string) => void;
  /**
   * Adds new screenshots to the project and to a list layout's shot in one undo step (the
   * screenshot list's Upload).
   */
  addScreenshotsToShot: (
    shotIndex: number,
    refs: AssetRef[],
    blobs: Record<string, Blob>,
  ) => Promise<void>;
  /** Takes a screenshot out of a list layout; not below the layout's minimum (quality-bar §4). */
  removeAssetFromShot: (shotIndex: number, assetId: string) => void;
  /** Moves a screenshot of a list layout to `toIndex` (clamped), in one undo step. */
  moveAssetInShot: (shotIndex: number, assetId: string, toIndex: number) => void;
  /** Swaps a Before & After shot's old and new designs, in one undo step. */
  swapBeforeAfter: (shotIndex: number) => void;

  // Timeline actions
  setShotDuration: (index: number, duration: number) => void;
  /** Sets a looping shot's pace (src/motion/pace.ts); its timing follows. One undo step. */
  setShotPace: (index: number, pace: Pace) => void;

  setSaveStatus: (status: SaveStatus, error?: string) => void;
}

/** Appends a screenshot to a list layout's shot. fitFixedShots refits a Frames shot's duration. */
function pushShotAsset(draft: ProjectDoc, shotIndex: number, assetId: string): void {
  const shot = draft.shots[shotIndex];
  if (!shot || !("assetIds" in shot.layout)) return;
  if (shot.layout.assetIds.includes(assetId)) return;
  shot.layout.assetIds.push(assetId);
}

const MAX_HISTORY = 100;
const COALESCE_WINDOW_MS = 800;

/**
 * Keeps every looping shot loop-safe after any edit. Its pace sets its timing (src/motion/pace.ts):
 * a slider's or orbit's step, which fits the shown screenshots in a 30 s shot, a Frames shot's
 * duration, which keeps it under its speed limit, and Responsive Scroll's hold. A slider or orbit
 * lasts one step per shown screenshot and keeps a still camera (contracts.md §5). Edits that set
 * such a shot's duration or camera directly are undone here. A responsive shot keeps a still
 * camera and, while it scrolls, lasts its holds plus moves. A Before & After shot keeps a still
 * camera and lasts its pace's loop plus the wrap crossfade. A Page Columns shot keeps a still
 * camera, and its pace sets its length from its pages.
 */
function fitFixedShots(draft: ProjectDoc): void {
  for (const shot of draft.shots) {
    fitPace(shot, draft.aspect, draft.assets);
    if (shot.layout.kind === "responsive") {
      const duration = fixedShotDuration(shot.layout, shot.scroll, draft.assets);
      if (duration !== null && duration !== shot.duration) shot.duration = duration;
      const camera = fixedShotCamera(shot.layout, shot.camera);
      if (camera !== shot.camera) shot.camera = camera;
      continue;
    }
    if (
      !isSteppedLayout(shot.layout) &&
      shot.layout.kind !== "compare" &&
      shot.layout.kind !== "pageColumns"
    ) {
      continue;
    }
    // Reassigned only when it changes, so an edit that leaves it still stays a no-op.
    const camera = fixedShotCamera(shot.layout, shot.camera);
    if (camera !== shot.camera) shot.camera = camera;
  }
}

/** The screenshot role each single device shows. */
const DEVICE_ROLE: Partial<Record<DeviceKind, AssetRole>> = {
  browser: "desktop",
  phone: "mobile",
};

/**
 * Puts the first added screenshot of the device's role on every single-device shot whose screen
 * is empty, such as a new project's browser, so an upload shows at once. A browser takes a
 * desktop screenshot and a phone a mobile one; other screenshots only join the library.
 */
function fillEmptyScreens(draft: ProjectDoc, refs: AssetRef[]): void {
  for (const shot of draft.shots) {
    if (shot.layout.kind !== "single" || shot.layout.assetId) continue;
    const role = DEVICE_ROLE[shot.layout.device];
    const match = refs.find((ref) => ref.kind === "image" && ref.role === role);
    if (match) shot.layout.assetId = match.id;
  }
}

/**
 * A new project: the preset look (`newProjectDoc`), with the last export settings used in this
 * browser, if any.
 */
function createNewProjectDoc(): ProjectDoc {
  const doc = newProjectDoc();
  const lastExport = readLastExport();
  return lastExport ? { ...doc, export: { ...doc.export, ...lastExport } } : doc;
}

export function createEditorStore(initialDoc?: ProjectDoc) {
  const startDoc = initialDoc ? sanitizeDoc(initialDoc).doc : createNewProjectDoc();

  let transactionSnapshot: ProjectDoc | null = null;
  let lastCoalesceKey: string | null = null;
  let lastCoalesceTime = 0;

  return create<EditorStoreState>((set, get) => ({
    doc: startDoc,
    past: [],
    future: [],
    saveStatus: "idle",
    saveError: undefined,

    apply: (recipe, opts) => {
      const current = get().doc;
      const next = produce(current, (draft) => {
        recipe(draft);
        fitFixedShots(draft);
      });

      // No-op if doc reference didn't change (no modifications)
      if (next === current) return;

      const now = Date.now();
      const coalesceKey = opts?.coalesceKey;

      if (transactionSnapshot !== null) {
        // Inside active transaction (e.g. slider drag) - mutate present without recording undo step
        set({ doc: next });
        return;
      }

      if (
        coalesceKey &&
        lastCoalesceKey === coalesceKey &&
        now - lastCoalesceTime < COALESCE_WINDOW_MS
      ) {
        // Coalesced edit (e.g. rapid typing in name or text field) - update doc without extra undo step
        lastCoalesceTime = now;
        set({ doc: next });
        return;
      }

      // Standard commit
      lastCoalesceKey = coalesceKey ?? null;
      lastCoalesceTime = now;

      set((state) => ({
        past: [...state.past.slice(Math.max(0, state.past.length - (MAX_HISTORY - 1))), state.doc],
        future: [],
        doc: next,
      }));
    },

    begin: () => {
      if (transactionSnapshot === null) {
        transactionSnapshot = get().doc;
      }
    },

    end: () => {
      if (transactionSnapshot === null) return;
      const original = transactionSnapshot;
      transactionSnapshot = null;
      const current = get().doc;

      if (original !== current) {
        set((state) => ({
          past: [...state.past.slice(Math.max(0, state.past.length - (MAX_HISTORY - 1))), original],
          future: [],
        }));
      }
    },

    undo: () => {
      const { past, doc, future } = get();
      if (past.length === 0) return;

      const previous = past[past.length - 1];
      const newPast = past.slice(0, -1);

      lastCoalesceKey = null;
      set({
        past: newPast,
        future: [doc, ...future],
        doc: previous,
      });
    },

    redo: () => {
      const { past, doc, future } = get();
      if (future.length === 0) return;

      const next = future[0];
      const newFuture = future.slice(1);

      lastCoalesceKey = null;
      set({
        past: [...past.slice(Math.max(0, past.length - (MAX_HISTORY - 1))), doc],
        future: newFuture,
        doc: next,
      });
    },

    loadDoc: (newDoc: ProjectDoc) => {
      const { doc: sanitized } = sanitizeDoc(newDoc);
      transactionSnapshot = null;
      lastCoalesceKey = null;
      set({
        doc: sanitized,
        past: [],
        future: [],
        saveStatus: "idle",
        saveError: undefined,
      });
    },

    newDoc: () => {
      get().loadDoc(createNewProjectDoc());
    },

    rememberExport: (settings) => {
      writeLastExport(settings);
      // Undo and redo restore whole documents, so the snapshots take the settings too.
      const withExport = (d: ProjectDoc) => ({ ...d, export: { ...settings } });
      set((state) => ({
        doc: withExport(state.doc),
        past: state.past.map(withExport),
        future: state.future.map(withExport),
      }));
    },

    applyTemplateResult: ({ style, shots, loop }, templateId) => {
      get().apply(
        (draft) => {
          draft.style = style;
          draft.shots = shots;
          draft.loop = loop;
          if (templateId) draft.templateId = templateId;
        },
        { label: "Apply template" },
      );
    },

    addAssets: async (refs, blobs, replace) => {
      if (blobs) {
        for (const [id, blob] of Object.entries(blobs)) {
          await putBlob(id, blob);
        }
      }
      get().apply(
        (draft) => {
          for (const ref of refs) {
            if (!draft.assets.some((a) => a.id === ref.id)) {
              draft.assets.push(ref);
            }
          }
          if (replace) {
            for (const shot of draft.shots) replaceLayoutAssetIds(shot.layout, replace);
          }
          fillEmptyScreens(draft, refs);
        },
        { label: "Add assets" },
      );
    },

    addAssetsAndApplyTemplate: async (refs, templateId, build, blobs) => {
      if (blobs) {
        for (const [id, blob] of Object.entries(blobs)) {
          await putBlob(id, blob);
        }
      }
      const current = get().doc;
      const assets = [...current.assets];
      for (const ref of refs) {
        if (!assets.some((a) => a.id === ref.id)) assets.push(ref);
      }
      const result = build({ ...current, assets });
      get().apply(
        (draft) => {
          draft.assets = assets;
          draft.style = result.style;
          draft.shots = result.shots;
          draft.loop = result.loop;
          draft.templateId = templateId;
        },
        { label: "Fill template" },
      );
      return result;
    },

    replaceAsset: async (id: string, ref: AssetRef, blob?: Blob) => {
      if (blob) {
        await putBlob(ref.id, blob);
      }
      get().apply(
        (draft) => {
          const idx = draft.assets.findIndex((a) => a.id === id);
          if (idx !== -1) {
            draft.assets[idx] = ref;
          }
        },
        { label: "Replace asset" },
      );
    },

    removeAsset: async (id: string) => {
      try {
        await deleteBlob(id);
      } catch (error) {
        console.error(`Failed to remove stored blob ${id}:`, error);
      }
      get().apply(
        (draft) => {
          draft.assets = draft.assets.filter((a) => a.id !== id);
          // Sanitize references to the removed asset across layouts and backgrounds
          const { doc } = sanitizeDoc(draft);
          draft.style = doc.style;
          draft.shots = doc.shots;
        },
        { label: "Remove asset" },
      );
    },

    setAssetRole: (id: string, role: AssetRole) => {
      get().apply(
        (draft) => {
          const asset = draft.assets.find((a) => a.id === id);
          if (asset) {
            asset.role = role;
          }
        },
        { label: `Set role to ${role}` },
      );
    },

    setAssetCaptures: (updates) => {
      if (updates.length === 0) return;
      get().apply(
        (draft) => {
          for (const { id, meta } of updates) {
            const asset = draft.assets.find((a) => a.id === id);
            if (asset) asset.meta = { ...asset.meta, ...meta };
          }
        },
        { label: "Add page sections" },
      );
    },

    duplicateAsset: async (id: string) => {
      const current = get().doc;
      const asset = current.assets.find((a) => a.id === id);
      if (!asset) return "";

      const newId = crypto.randomUUID();
      const duplicate: AssetRef = {
        ...structuredClone(asset),
        id: newId,
        name: `${asset.name} (Copy)`,
      };

      const existingBlob = await getBlob(id);
      if (existingBlob) {
        await putBlob(newId, existingBlob);
      }

      get().apply(
        (draft) => {
          draft.assets.push(duplicate);
        },
        { label: "Duplicate asset" },
      );

      return newId;
    },

    reorderAssets: (orderedIds: string[]) => {
      get().apply(
        (draft) => {
          const idMap = new Map(draft.assets.map((a) => [a.id, a]));
          const nextAssets: AssetRef[] = [];
          for (const id of orderedIds) {
            const a = idMap.get(id);
            if (a) nextAssets.push(a);
          }
          // append any that weren't in orderedIds
          for (const a of draft.assets) {
            if (!nextAssets.includes(a)) {
              nextAssets.push(a);
            }
          }
          draft.assets = nextAssets;
        },
        { label: "Reorder media" },
      );
    },

    assignAssetToSlot: (shotIndex: number, slotKeyOrNodeId: string, assetId: string) => {
      get().apply(
        (draft) => {
          const shot = draft.shots[shotIndex];
          if (!shot) return;
          const layout = shot.layout;

          if (layout.kind === "single") {
            layout.assetId = assetId;
          } else if (layout.kind === "responsive") {
            if (slotKeyOrNodeId.includes("mobile")) {
              layout.mobileId = assetId;
            } else {
              layout.desktopId = assetId;
            }
          } else if (layout.kind === "compare") {
            // One screen shows both designs; a screenshot dropped on it becomes the new design.
            layout.afterId = assetId;
          } else if (isSteppedLayout(layout)) {
            // A slider or orbit adds the screenshot after the card it was dropped on. Its nodes
            // are a ring of the shown screenshots, so "slider:7" is shown screenshot 7 mod N.
            if (!layout.assetIds.includes(assetId)) {
              const shown = steppedAssetIds(layout).length;
              const match = slotKeyOrNodeId.match(/(\d+)/);
              const at = match && shown > 0 ? (parseInt(match[1], 10) % shown) + 1 : shown;
              layout.assetIds.splice(at, 0, assetId);
            }
          } else if (
            layout.kind === "rows" ||
            layout.kind === "columns" ||
            layout.kind === "pageColumns"
          ) {
            // Find target index in assetIds: a Page Columns card "pageColumns:1" is page 1.
            let targetIdx = -1;
            const match = slotKeyOrNodeId.match(/(\d+)/);
            if (match) {
              targetIdx = parseInt(match[1], 10);
            }
            if (targetIdx >= 0 && targetIdx < layout.assetIds.length) {
              layout.assetIds[targetIdx] = assetId;
            } else if (!layout.assetIds.includes(assetId)) {
              layout.assetIds.push(assetId);
            }
          }
          // Another screenshot lengthens a Frames period: fitFixedShots refits its duration.
        },
        { label: "Assign media to slot" },
      );
    },

    addAssetToShot: (shotIndex: number, assetId: string) => {
      get().apply((draft) => pushShotAsset(draft, shotIndex, assetId), {
        label: "Add screenshot to shot",
      });
    },

    addScreenshotsToShot: async (shotIndex, refs, blobs) => {
      for (const [id, blob] of Object.entries(blobs)) {
        await putBlob(id, blob);
      }
      get().apply(
        (draft) => {
          for (const ref of refs) {
            if (!draft.assets.some((a) => a.id === ref.id)) draft.assets.push(ref);
            pushShotAsset(draft, shotIndex, ref.id);
          }
        },
        { label: refs.length === 1 ? "Add screenshot" : "Add screenshots" },
      );
    },

    removeAssetFromShot: (shotIndex: number, assetId: string) => {
      get().apply(
        (draft) => {
          const shot = draft.shots[shotIndex];
          if (!shot || !("assetIds" in shot.layout)) return;
          if (shot.layout.assetIds.length <= minShotScreenshots(shot.layout)) return;
          shot.layout.assetIds = shot.layout.assetIds.filter((id) => id !== assetId);
        },
        { label: "Remove screenshot from shot" },
      );
    },

    moveAssetInShot: (shotIndex: number, assetId: string, toIndex: number) => {
      const shot = get().doc.shots[shotIndex];
      if (!shot || !("assetIds" in shot.layout)) return;
      const from = shot.layout.assetIds.indexOf(assetId);
      const to = Math.max(0, Math.min(shot.layout.assetIds.length - 1, toIndex));
      // A move to its own place is not an edit, so it leaves no undo step.
      if (from < 0 || from === to) return;
      get().apply(
        (draft) => {
          const target = draft.shots[shotIndex];
          if (!target || !("assetIds" in target.layout)) return;
          target.layout.assetIds.splice(from, 1);
          target.layout.assetIds.splice(to, 0, assetId);
        },
        { label: "Reorder screenshots" },
      );
    },

    swapBeforeAfter: (shotIndex: number) => {
      // Only a Before & After shot has an old and a new design; anything else leaves no undo step.
      if (get().doc.shots[shotIndex]?.layout.kind !== "compare") return;
      get().apply(
        (draft) => {
          const layout = draft.shots[shotIndex]?.layout;
          if (layout?.kind !== "compare") return;
          const { beforeId, afterId } = layout;
          layout.beforeId = afterId;
          layout.afterId = beforeId;
        },
        { label: "Swap before and after" },
      );
    },

    // Timeline actions
    setShotDuration: (index: number, duration: number) => {
      // A looping shot's pace sets its length; skip it so the edit leaves no empty undo step.
      const { doc } = get();
      const current = doc.shots[index];
      if (current && isPacedShot(current)) return;
      if (current && fixedShotDuration(current.layout, current.scroll, doc.assets) !== null) return;
      get().apply(
        (draft) => {
          const shot = draft.shots[index];
          if (shot) {
            const shortest = minShotDuration(shot.layout, draft.aspect);
            shot.duration = Math.min(30, Math.max(shortest, duration));
          }
        },
        { label: "Change shot duration" },
      );
    },

    setShotPace: (index: number, pace: Pace) => {
      get().apply(
        (draft) => {
          const shot = draft.shots[index];
          if (shot && isPacedShot(shot)) setPace(shot, pace);
        },
        { label: "Change pace" },
      );
    },

    setSaveStatus: (status, error) => {
      set({ saveStatus: status, saveError: error });
    },
  }));
}

export const useEditorStore = createEditorStore();

/**
 * Configure debounced autosave with immediate flush on visibilitychange/pagehide
 */
export function setupAutosave(
  store: ReturnType<typeof createEditorStore>,
  debounceMs = 600,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingDoc: ProjectDoc | null = null;

  async function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pendingDoc) return;
    const docToSave = pendingDoc;
    pendingDoc = null;

    store.getState().setSaveStatus("saving");
    try {
      await saveProject(docToSave);
      store.getState().setSaveStatus("saved");
    } catch (err: unknown) {
      const quota =
        (typeof DOMException !== "undefined" &&
          err instanceof DOMException &&
          err.name === "QuotaExceededError") ||
        (err instanceof Error && /quota/i.test(err.name));
      const msg = quota
        ? "Not enough storage space."
        : err instanceof Error
          ? err.message
          : "Storage error";
      store.getState().setSaveStatus("error", msg);
    }
  }

  const unsubscribe = store.subscribe((state, prevState) => {
    if (state.doc === prevState?.doc) return;
    pendingDoc = state.doc;
    store.getState().setSaveStatus("saving");

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      flush();
    }, debounceMs);
  });

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      flush();
    }
  };

  const onPageHide = () => {
    flush();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
  }

  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
    if (typeof window !== "undefined") {
      window.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    }
  };
}
