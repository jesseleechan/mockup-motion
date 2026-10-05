import { create } from "zustand";
import { produce } from "immer";
import { createDoc } from "../doc/defaults";
import { sanitizeDoc } from "../doc/validate";
import type { AssetRef, ProjectDoc, Shot, Style } from "../doc/types";
import { putBlob, saveProject } from "../storage";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

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
  applyTemplateResult: (
    result: { style: Style; shots: Shot[]; loop: boolean },
    templateId?: string,
  ) => void;
  addAssets: (refs: AssetRef[], blobs?: Record<string, Blob>) => Promise<void>;
  replaceAsset: (id: string, ref: AssetRef, blob?: Blob) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  setSaveStatus: (status: SaveStatus, error?: string) => void;
}

const MAX_HISTORY = 100;
const COALESCE_WINDOW_MS = 800;

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
      const next = produce(current, recipe);

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
      get().apply(
        (draft) => {
          draft.assets = draft.assets.filter((a) => a.id !== id);
          // Sanitize references to removed asset across layouts/texts
          const { doc } = sanitizeDoc(draft);
          draft.style = doc.style;
          draft.shots = doc.shots;
        },
        { label: "Remove asset" },
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
      const msg = err instanceof Error ? err.message : "Storage error";
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
