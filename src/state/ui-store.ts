import { create } from "zustand";

export type UISelection =
  { kind: "video" } | { kind: "shot"; id: string } | { kind: "text"; shotId: string; id: string };

export interface UIState {
  selection: UISelection;
  playhead: number;
  playing: boolean;
  stageZoom: number;
  panels: {
    library: boolean;
    inspector: boolean;
    timeline: boolean;
  };
  theme: "dark" | "light";
  /** The template gallery is rendered once, in EditorShell; anything may open it (F06). */
  templateGalleryOpen: boolean;

  // Actions
  setSelection: (selection: UISelection) => void;
  setPlayhead: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setStageZoom: (zoom: number) => void;
  togglePanel: (panel: "library" | "inspector" | "timeline") => void;
  setTheme: (theme: "dark" | "light") => void;
  openTemplateGallery: () => void;
  closeTemplateGallery: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selection: { kind: "video" },
  playhead: 0,
  playing: false,
  stageZoom: 1,
  panels: {
    library: true,
    inspector: true,
    timeline: true,
  },
  theme: "dark",
  templateGalleryOpen: false,

  setSelection: (selection) => set({ selection }),
  setPlayhead: (playhead) => set({ playhead }),
  setPlaying: (playing) => set({ playing }),
  setStageZoom: (stageZoom) => set({ stageZoom }),
  togglePanel: (panel) =>
    set((state) => ({
      panels: {
        ...state.panels,
        [panel]: !state.panels[panel],
      },
    })),
  setTheme: (theme) => set({ theme }),
  openTemplateGallery: () => set({ templateGalleryOpen: true }),
  closeTemplateGallery: () => set({ templateGalleryOpen: false }),
}));
