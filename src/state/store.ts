import { create } from "zustand";
import { produce, current } from "immer";
import { createDoc, defaultShot } from "../doc/defaults";
import { sanitizeDoc } from "../doc/validate";
import type {
  AssetRef,
  AssetRole,
  AudioTrack,
  Layout,
  ProjectDoc,
  Shot,
  Style,
  Transition,
} from "../doc/types";
import { clampAudioTrack, defaultAudioTrack } from "../audio/mix";
import {
  clampSliderStep,
  fixedShotDuration,
  minShotDuration,
  SLIDER_MAX_SCREENSHOTS,
  sliderDuration,
} from "../motion";
import { deleteBlob, getBlob, putBlob, saveProject } from "../storage";
import type { BrandKit } from "../storage/brand-kits";

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
  duplicateAsset: (id: string) => Promise<string>;
  reorderAssets: (orderedIds: string[]) => void;
  assignAssetToSlot: (shotIndex: number, slotKeyOrNodeId: string, assetId: string) => void;
  /** Adds a screenshot to a layout that shows a list of them (rows, columns, wall, stack, slider). */
  addAssetToShot: (shotIndex: number, assetId: string) => void;
  /** Takes a screenshot out of a list layout. */
  removeAssetFromShot: (shotIndex: number, assetId: string) => void;
  applyBrandKit: (kit: BrandKit) => void;

  // Music track (WP-17)
  setMusic: (ref: AssetRef, blob: Blob) => Promise<void>;
  updateMusic: (
    patch: Partial<Omit<AudioTrack, "assetId">>,
    opts?: { coalesceKey?: string },
  ) => void;
  removeMusic: () => void;

  // Timeline / storyboard actions
  addShot: (layout?: Layout, insertAfterIndex?: number) => void;
  duplicateShot: (index: number) => void;
  removeShot: (index: number) => void;
  moveShot: (fromIndex: number, toIndex: number) => void;
  setShotDuration: (index: number, duration: number) => void;
  setTransition: (shotIndex: number, transition: Transition) => void;
  splitShot: (index: number, splitLocalT: number) => void;
  setTextLayerDelay: (shotIndex: number, textLayerId: string, delay: number) => void;

  setSaveStatus: (status: SaveStatus, error?: string) => void;
}

const MAX_HISTORY = 100;
const COALESCE_WINDOW_MS = 800;

/**
 * Keeps every slider shot loop-safe after any edit: the step fits the screenshot count in a
 * 30 s shot, and the shot lasts one step per shown screenshot (contracts.md §5). Edits that
 * set a slider's duration directly (the timeline handle, the duration control) are undone here.
 */
function fitSliderShots(draft: ProjectDoc): void {
  for (const shot of draft.shots) {
    if (shot.layout.kind !== "slider") continue;
    shot.layout.step = clampSliderStep(shot.layout.step, shot.layout.assetIds.length);
    shot.duration = sliderDuration(shot.layout);
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
        fitSliderShots(draft);
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
          if (draft.audio?.assetId === id) delete draft.audio;
          // Sanitize references to removed asset across layouts/texts
          const { doc } = sanitizeDoc(draft);
          draft.style = doc.style;
          draft.shots = doc.shots;
        },
        { label: "Remove asset" },
      );
    },

    setMusic: async (ref: AssetRef, blob: Blob) => {
      const previousId = get().doc.assets.find((a) => a.kind === "audio")?.id;
      await putBlob(ref.id, blob);
      if (previousId && previousId !== ref.id) {
        try {
          await deleteBlob(previousId);
        } catch (error) {
          console.error(`Failed to remove replaced audio blob ${previousId}:`, error);
        }
      }
      get().apply(
        (draft) => {
          // One music track per project: replace any previous audio asset.
          draft.assets = draft.assets.filter((a) => a.kind !== "audio");
          draft.assets.push(ref);
          draft.audio = defaultAudioTrack(ref.id);
        },
        { label: "Add music" },
      );
    },

    updateMusic: (patch, opts) => {
      get().apply(
        (draft) => {
          if (!draft.audio) return;
          draft.audio = clampAudioTrack({ ...draft.audio, ...patch });
        },
        { label: "Edit music", coalesceKey: opts?.coalesceKey },
      );
    },

    removeMusic: () => {
      const id = get().doc.audio?.assetId;
      get().apply(
        (draft) => {
          if (!draft.audio) return;
          const assetId = draft.audio.assetId;
          delete draft.audio;
          draft.assets = draft.assets.filter((a) => a.id !== assetId);
        },
        { label: "Remove music" },
      );
      if (id) {
        void deleteBlob(id).catch((error) => {
          console.error(`Failed to remove stored audio blob ${id}:`, error);
        });
      }
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
          } else if (layout.kind === "pair") {
            if (slotKeyOrNodeId.includes("mobile")) {
              layout.mobileId = assetId;
            } else {
              layout.desktopId = assetId;
            }
          } else if (layout.kind === "trio") {
            if (slotKeyOrNodeId.includes("mobile")) {
              layout.mobileId = assetId;
            } else if (slotKeyOrNodeId.includes("tablet")) {
              layout.tabletId = assetId;
            } else {
              layout.desktopId = assetId;
            }
          } else if (layout.kind === "slider") {
            // A slider adds the screenshot after the card it was dropped on. Its nodes are a ring
            // of the shown screenshots, so "slider:7" is shown screenshot 7 mod N.
            if (!layout.assetIds.includes(assetId)) {
              const shown = Math.min(layout.assetIds.length, SLIDER_MAX_SCREENSHOTS);
              const match = slotKeyOrNodeId.match(/(\d+)/);
              const at = match && shown > 0 ? (parseInt(match[1], 10) % shown) + 1 : shown;
              layout.assetIds.splice(at, 0, assetId);
            }
          } else if (
            layout.kind === "rows" ||
            layout.kind === "columns" ||
            layout.kind === "wall" ||
            layout.kind === "stack"
          ) {
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
      get().apply(
        (draft) => {
          const shot = draft.shots[shotIndex];
          if (!shot || !("assetIds" in shot.layout)) return;
          if (shot.layout.assetIds.includes(assetId)) return;
          shot.layout.assetIds.push(assetId);
          shot.duration = Math.min(
            30,
            Math.max(shot.duration, minShotDuration(shot.layout, draft.aspect)),
          );
        },
        { label: "Add screenshot to shot" },
      );
    },

    removeAssetFromShot: (shotIndex: number, assetId: string) => {
      get().apply(
        (draft) => {
          const shot = draft.shots[shotIndex];
          if (!shot || !("assetIds" in shot.layout)) return;
          shot.layout.assetIds = shot.layout.assetIds.filter((id) => id !== assetId);
        },
        { label: "Remove screenshot from shot" },
      );
    },

    applyBrandKit: (kit: BrandKit) => {
      get().apply(
        (draft) => {
          if (kit.colors[0]) {
            draft.style.textColor = kit.colors[0];
          }
          if (kit.colors[1]) {
            draft.style.accent = kit.colors[1];
          }
          if (kit.browserUrl !== undefined) {
            draft.style.browserUrl = kit.browserUrl;
          }
          if (kit.fontDisplay) {
            draft.style.fonts.display.family = kit.fontDisplay;
          }
          if (kit.fontBody) {
            draft.style.fonts.body.family = kit.fontBody;
          }
          // Update logo on text layers if kit defines one
          const logoId = kit.logoDarkAssetId || kit.logoLightAssetId;
          if (logoId) {
            for (const shot of draft.shots) {
              if (shot.texts) {
                for (const text of shot.texts) {
                  if (text.role === "title" || text.logoAssetId) {
                    text.logoAssetId = logoId;
                  }
                }
              }
            }
          }
        },
        { label: `Apply brand kit "${kit.name}"` },
      );
    },

    // Timeline / storyboard actions
    addShot: (layout?: Layout, insertAfterIndex?: number) => {
      get().apply(
        (draft) => {
          const newS = defaultShot();
          if (layout) {
            newS.layout = layout;
          } else if (draft.shots.length > 0) {
            newS.layout = structuredClone(draft.shots[draft.shots.length - 1].layout);
          }
          newS.id = `shot-${crypto.randomUUID().slice(0, 8)}`;
          newS.duration = 4.0;

          if (
            insertAfterIndex !== undefined &&
            insertAfterIndex >= 0 &&
            insertAfterIndex < draft.shots.length
          ) {
            draft.shots.splice(insertAfterIndex + 1, 0, newS);
          } else {
            draft.shots.push(newS);
          }
        },
        { label: "Add shot" },
      );
    },

    duplicateShot: (index: number) => {
      get().apply(
        (draft) => {
          const original = draft.shots[index];
          if (!original) return;
          const copy = structuredClone(current(original));
          copy.id = `shot-${crypto.randomUUID().slice(0, 8)}`;
          draft.shots.splice(index + 1, 0, copy);
        },
        { label: "Duplicate shot" },
      );
    },

    removeShot: (index: number) => {
      get().apply(
        (draft) => {
          if (draft.shots.length <= 1) return; // Do not delete the last shot
          draft.shots.splice(index, 1);
        },
        { label: "Delete shot" },
      );
    },

    moveShot: (fromIndex: number, toIndex: number) => {
      get().apply(
        (draft) => {
          if (
            fromIndex < 0 ||
            fromIndex >= draft.shots.length ||
            toIndex < 0 ||
            toIndex >= draft.shots.length ||
            fromIndex === toIndex
          ) {
            return;
          }
          const [moved] = draft.shots.splice(fromIndex, 1);
          draft.shots.splice(toIndex, 0, moved);
        },
        { label: "Reorder shots" },
      );
    },

    setShotDuration: (index: number, duration: number) => {
      // A slider sets its own length; skip it so the edit leaves no empty undo step.
      const current = get().doc.shots[index];
      if (current && fixedShotDuration(current.layout) !== null) return;
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

    setTransition: (shotIndex: number, transition: Transition) => {
      get().apply(
        (draft) => {
          const shot = draft.shots[shotIndex];
          if (shot) {
            shot.transitionIn = structuredClone(transition);
          }
        },
        { label: "Change transition" },
      );
    },

    splitShot: (index: number, splitLocalT: number) => {
      get().apply(
        (draft) => {
          const original = draft.shots[index];
          if (!original) return;
          const totalDur = original.duration;
          const t = Math.max(0.5, Math.min(totalDur - 0.5, splitLocalT));

          // Shot A
          original.duration = t;

          // Shot B
          const shotB = structuredClone(current(original));
          shotB.id = `shot-${crypto.randomUUID().slice(0, 8)}`;
          shotB.duration = totalDur - t;
          shotB.transitionIn = { kind: "cut", duration: 0, easing: "quintInOut" };

          // Maintain camera continuity between Shot A and Shot B
          const alpha = t / totalDur;
          const [p0, p1] = original.camera.progressRange ?? [0, 1];
          const splitProgress = p0 + alpha * (p1 - p0);

          original.camera.progressRange = [p0, splitProgress];
          shotB.camera.progressRange = [splitProgress, p1];

          draft.shots.splice(index + 1, 0, shotB);
        },
        { label: "Split shot" },
      );
    },

    setTextLayerDelay: (shotIndex: number, textLayerId: string, delay: number) => {
      get().apply(
        (draft) => {
          const shot = draft.shots[shotIndex];
          if (!shot) return;
          const text = shot.texts.find((t) => t.id === textLayerId);
          if (text) {
            text.delay = Math.max(0, Math.min(shot.duration, delay));
          }
        },
        { label: "Change text delay" },
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
