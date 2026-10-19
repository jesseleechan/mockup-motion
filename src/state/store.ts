import { create } from "zustand";
import { produce } from "immer";
import { createDoc } from "../doc/defaults";
import { sanitizeDoc } from "../doc/validate";
import type { AssetMeta, AssetRef, AssetRole, ProjectDoc, Shot, Style } from "../doc/types";
import {
  clampSliderStep,
  fixedShotCamera,
  fixedShotDuration,
  minShotDuration,
  minShotScreenshots,
  isSteppedLayout,
  sliderDuration,
  steppedAssetIds,
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
  applyTemplateResult: (result: TemplateResult, templateId?: string) => void;
  addAssets: (refs: AssetRef[], blobs?: Record<string, Blob>) => Promise<void>;
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

  // Timeline actions
  setShotDuration: (index: number, duration: number) => void;

  setSaveStatus: (status: SaveStatus, error?: string) => void;
}

/** Appends a screenshot to a list layout's shot and lengthens the shot if the layout needs it. */
function pushShotAsset(draft: ProjectDoc, shotIndex: number, assetId: string): void {
  const shot = draft.shots[shotIndex];
  if (!shot || !("assetIds" in shot.layout)) return;
  if (shot.layout.assetIds.includes(assetId)) return;
  shot.layout.assetIds.push(assetId);
  shot.duration = Math.min(30, Math.max(shot.duration, minShotDuration(shot.layout, draft.aspect)));
}

const MAX_HISTORY = 100;
const COALESCE_WINDOW_MS = 800;

/**
 * Keeps every slider and orbit shot loop-safe after any edit: the step fits the screenshot count
 * in a 30 s shot, the shot lasts one step per shown screenshot, and the camera stays still
 * (contracts.md §5). Edits that set such a shot's duration or camera directly are undone here.
 * A responsive shot keeps a still camera and, while it scrolls, lasts its holds plus moves.
 */
function fitFixedShots(draft: ProjectDoc): void {
  for (const shot of draft.shots) {
    if (shot.layout.kind === "responsive") {
      const duration = fixedShotDuration(shot.layout, shot.scroll, draft.assets);
      if (duration !== null && duration !== shot.duration) shot.duration = duration;
      const camera = fixedShotCamera(shot.layout, shot.camera);
      if (camera !== shot.camera) shot.camera = camera;
      continue;
    }
    if (!isSteppedLayout(shot.layout)) continue;
    shot.layout.step = clampSliderStep(shot.layout.step, shot.layout.assetIds.length);
    shot.duration = sliderDuration(shot.layout);
    // Reassigned only when it changes, so an edit that leaves it still stays a no-op.
    const camera = fixedShotCamera(shot.layout, shot.camera);
    if (camera !== shot.camera) shot.camera = camera;
  }
}

export function createEditorStore(initialDoc?: ProjectDoc) {
  const startDoc = initialDoc ? sanitizeDoc(initialDoc).doc : createDoc();

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
      get().loadDoc(createDoc());
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

    addAssets: async (refs: AssetRef[], blobs?: Record<string, Blob>) => {
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
          } else if (isSteppedLayout(layout)) {
            // A slider or orbit adds the screenshot after the card it was dropped on. Its nodes
            // are a ring of the shown screenshots, so "slider:7" is shown screenshot 7 mod N.
            if (!layout.assetIds.includes(assetId)) {
              const shown = steppedAssetIds(layout).length;
              const match = slotKeyOrNodeId.match(/(\d+)/);
              const at = match && shown > 0 ? (parseInt(match[1], 10) % shown) + 1 : shown;
              layout.assetIds.splice(at, 0, assetId);
            }
          } else if (layout.kind === "rows" || layout.kind === "columns") {
            // Find target index in assetIds
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
          // Another screenshot lengthens a Frames period; keep it under its speed limit.
          shot.duration = Math.min(
            30,
            Math.max(shot.duration, minShotDuration(layout, draft.aspect)),
          );
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

    // Timeline actions
    setShotDuration: (index: number, duration: number) => {
      // A slider sets its own length; skip it so the edit leaves no empty undo step.
      const { doc } = get();
      const current = doc.shots[index];
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
