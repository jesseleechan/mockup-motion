import { create } from "zustand";
import {
  PANEL_DEFAULT_WIDTHS,
  clampPanelWidth,
  type PanelWidths,
  type SidePanel,
} from "../editor/shell/panel-layout";

export type UISelection = { kind: "video" } | { kind: "shot"; id: string };

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
  /** Saved side panel widths, a per-browser preference (docs/polish-plan/stage-timeline.md). */
  panelWidths: PanelWidths;
  /** The Library is closed because the window got narrow, not by the user. */
  libraryAutoCollapsed: boolean;
  theme: "dark" | "light";
  /** The template gallery is rendered once, in EditorShell; anything may open it (F06). */
  templateGalleryOpen: boolean;

  // Actions
  setSelection: (selection: UISelection) => void;
  setPlayhead: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setStageZoom: (zoom: number) => void;
  togglePanel: (panel: "library" | "inspector" | "timeline") => void;
  setLibraryCollapse: (state: { open: boolean; autoCollapsed: boolean }) => void;
  setPanelWidth: (panel: SidePanel, width: number) => void;
  setPanelWidths: (widths: PanelWidths) => void;
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
  panelWidths: { ...PANEL_DEFAULT_WIDTHS },
  libraryAutoCollapsed: false,
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
      // Opening or closing the Library by hand overrides the automatic collapse.
      libraryAutoCollapsed: panel === "library" ? false : state.libraryAutoCollapsed,
    })),
  setLibraryCollapse: ({ open, autoCollapsed }) =>
    set((state) => ({
      panels: { ...state.panels, library: open },
      libraryAutoCollapsed: autoCollapsed,
    })),
  setPanelWidth: (panel, width) =>
    set((state) => ({
      panelWidths: { ...state.panelWidths, [panel]: clampPanelWidth(panel, width) },
    })),
  setPanelWidths: (panelWidths) => set({ panelWidths }),
  setTheme: (theme) => set({ theme }),
  openTemplateGallery: () => set({ templateGalleryOpen: true }),
  closeTemplateGallery: () => set({ templateGalleryOpen: false }),
}));
