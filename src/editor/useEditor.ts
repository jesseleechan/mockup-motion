import { useCallback, useEffect, useRef, useState } from "react";
import type { Composition, Preset, Project } from "../types";
import { createProject } from "../presets/presets";
import { saveProject, restoreProject } from "../storage/projects";
import { releaseUnusedImages } from "../assets/images";
import { commit, undo, redo, type History } from "./history";
export function useEditor() {
  const [history, setHistory] = useState<History<Project>>(() => ({
    past: [],
    present: createProject(),
    future: [],
  }));
  const [ready, setReady] = useState(false),
    [saveStatus, setSaveStatus] = useState("Loading project…");
  const [presets, setPresets] = useState<Preset[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("mockupmotion-presets") ?? "[]");
    } catch {
      return [];
    }
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("mockupmotion-favorites") ?? "[]");
    } catch {
      return [];
    }
  });
  const transaction = useRef<Project | null>(null),
    saveRevision = useRef(0),
    queue = useRef(Promise.resolve());
  useEffect(() => {
    let live = true;
    restoreProject()
      .then((project) => {
        if (live && project) setHistory({ past: [], present: project, future: [] });
        if (live) setSaveStatus(project ? "Restored on this device" : "Saved on this device");
      })
      .catch(() => {
        if (live) setSaveStatus("Autosave unavailable");
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const revision = ++saveRevision.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legacy: autosave state indication
    setSaveStatus("Saving…");
    const timer = setTimeout(() => {
      queue.current = queue.current
        .catch(() => {})
        .then(() => saveProject(history.present))
        .then(() => {
          if (saveRevision.current === revision) setSaveStatus("Saved on this device");
        })
        .catch(() => {
          if (saveRevision.current === revision)
            setSaveStatus("Could not save — storage may be full");
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [history.present, ready]);
  useEffect(() => {
    releaseUnusedImages(
      [...history.past, history.present, ...history.future].flatMap((p) => p.images),
    );
  }, [history]);
  const present = useRef(history.present);
  // eslint-disable-next-line react-hooks/refs -- legacy: mutable ref keeping track of latest history present
  present.current = history.present;
  const update = useCallback((change: (p: Project) => Project) => {
    const editing = transaction.current !== null;
    setHistory((h) =>
      editing ? { ...h, present: change(h.present), future: [] } : commit(h, change(h.present)),
    );
  }, []);
  const begin = useCallback(() => {
    transaction.current ??= present.current;
  }, []);
  const end = useCallback(() => {
    const original = transaction.current;
    transaction.current = null;
    if (original)
      setHistory((h) =>
        original !== h.present ? { ...h, past: [...h.past, original].slice(-60), future: [] } : h,
      );
  }, []);
  const changeComposition = useCallback(
    (changes: Partial<Composition>) =>
      update((p) => ({
        ...p,
        composition: { ...p.composition, ...changes },
        customized: true,
      })),
    [update],
  );
  const goUndo = useCallback(() => {
    transaction.current = null;
    setHistory(undo);
  }, []);
  const goRedo = useCallback(() => {
    transaction.current = null;
    setHistory(redo);
  }, []);
  const savePreset = (name: string) => {
    const preset: Preset = {
      id: crypto.randomUUID(),
      name,
      description: "Your own starting point.",
      category: "mixed",
      custom: true,
      composition: {
        ...structuredClone(history.present.composition),
        assetIds: { primary: "", mobile: "" },
        background: { ...history.present.composition.background, imageId: "" },
        brand: { ...history.present.composition.brand, logoId: "" },
      },
    };
    const next = [...presets, preset];
    localStorage.setItem("mockupmotion-presets", JSON.stringify(next));
    setPresets(next);
  };
  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
    localStorage.setItem("mockupmotion-favorites", JSON.stringify(next));
    setFavorites(next);
  };
  const removePreset = (id: string) => {
    const next = presets.filter((p) => p.id !== id);
    localStorage.setItem("mockupmotion-presets", JSON.stringify(next));
    setPresets(next);
  };
  return {
    project: history.present,
    update,
    changeComposition,
    begin,
    end,
    undo: goUndo,
    redo: goRedo,
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
    ready,
    saveStatus,
    presets,
    savePreset,
    removePreset,
    favorites,
    toggleFavorite,
  };
}
