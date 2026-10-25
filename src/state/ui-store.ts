import { create } from "zustand";
import {
  PANEL_DEFAULT_WIDTHS,
  clampPanelWidth,
  type PanelWidths,
  type SidePanel,
} from "../editor/shell/panel-layout";
import { loadThemePreference, type ThemePreference } from "../editor/shell/theme-preference";
import { browserStorage } from "../export/last-settings";

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
  /** System, Light or Dark (`theme-preference.ts`); System follows the operating system. */
  theme: ThemePreference;
  /** The template gallery is rendered once, in EditorShell; anything may open it (F06). */
  templateGalleryOpen: boolean;
  /** The gallery was opened by the editor on start, not by the user (`first-run-gallery.ts`). */
  firstRunGallery: boolean;
  /**
   * True until the editor has decided what to open on start: the last project or the gallery
   * (`openOnStart`). The stage shows no empty state meanwhile, so it doesn't flash.
   */
  starting: boolean;
  /** Counts requests for the stage's screenshot file picker (the gallery's Choose screenshots). */
  screenshotPickerRequests: number;

  // Actions
  setSelection: (selection: UISelection) => void;
  setPlayhead: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setStageZoom: (zoom: number) => void;
  togglePanel: (panel: "library" | "inspector" | "timeline") => void;
  setLibraryCollapse: (state: { open: boolean; autoCollapsed: boolean }) => void;
  setPanelWidth: (panel: SidePanel, width: number) => void;
  setPanelWidths: (widths: PanelWidths) => void;
  setTheme: (theme: ThemePreference) => void;
  openTemplateGallery: () => void;
  openFirstRunGallery: () => void;
  closeTemplateGallery: () => void;
  requestScreenshotPicker: () => void;
  finishStarting: () => void;
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
  // The saved choice, read before the first render, as index.html applied it before first paint.
  theme: loadThemePreference(browserStorage()),
  templateGalleryOpen: false,
  firstRunGallery: false,
  starting: true,
  screenshotPickerRequests: 0,

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
  openTemplateGallery: () => set({ templateGalleryOpen: true, firstRunGallery: false }),
  openFirstRunGallery: () => set({ templateGalleryOpen: true, firstRunGallery: true }),
  closeTemplateGallery: () => set({ templateGalleryOpen: false, firstRunGallery: false }),
  finishStarting: () => set({ starting: false }),
  requestScreenshotPicker: () =>
    set((state) => ({ screenshotPickerRequests: state.screenshotPickerRequests + 1 })),
}));
