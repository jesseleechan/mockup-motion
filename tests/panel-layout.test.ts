import { describe, expect, it } from "vitest";
import {
  COLLAPSED_RAIL_WIDTH,
  LIBRARY_AUTO_COLLAPSE_BELOW,
  PANEL_DEFAULT_WIDTHS,
  PANEL_MAX_WIDTH,
  PANEL_MIN_WIDTHS,
  STAGE_MIN_WIDTH,
  libraryAfterResize,
  loadPanelWidths,
  maxPanelWidth,
  parsePanelWidths,
  renderedPanelWidths,
  savePanelWidths,
} from "../src/editor/shell/panel-layout";
import { useUIStore } from "../src/state/ui-store";

const BOTH_OPEN = { library: true, inspector: true };
const NARROW = LIBRARY_AUTO_COLLAPSE_BELOW - 180; // 1100 px
const WIDE = LIBRARY_AUTO_COLLAPSE_BELOW + 160; // 1440 px

describe("side panel widths", () => {
  it("keeps the saved widths when the window has room for them and the stage", () => {
    expect(renderedPanelWidths(PANEL_DEFAULT_WIDTHS, BOTH_OPEN, WIDE)).toEqual(
      PANEL_DEFAULT_WIDTHS,
    );
  });

  it("narrows what is drawn, not what is saved, so the stage keeps its minimum", () => {
    const saved = { library: PANEL_MAX_WIDTH, inspector: PANEL_MAX_WIDTH };
    const rendered = renderedPanelWidths(saved, BOTH_OPEN, NARROW);
    expect(rendered.library + rendered.inspector).toBeLessThanOrEqual(NARROW - STAGE_MIN_WIDTH);
    expect(rendered.library).toBe(rendered.inspector);
    expect(saved).toEqual({ library: PANEL_MAX_WIDTH, inspector: PANEL_MAX_WIDTH });
  });

  it("counts a collapsed panel as its rail", () => {
    const saved = { library: 300, inspector: PANEL_MAX_WIDTH };
    const open = { library: false, inspector: true };
    const width = STAGE_MIN_WIDTH + COLLAPSED_RAIL_WIDTH + 350;
    expect(renderedPanelWidths(saved, open, width).inspector).toBe(350);
  });

  it("never draws a panel below its minimum, even in a tiny window", () => {
    const rendered = renderedPanelWidths(PANEL_DEFAULT_WIDTHS, BOTH_OPEN, 900);
    expect(rendered.library).toBe(PANEL_MIN_WIDTHS.library);
    expect(rendered.inspector).toBe(PANEL_MIN_WIDTHS.inspector);
  });

  it("limits a dragged panel to what leaves the stage its minimum", () => {
    const other = PANEL_DEFAULT_WIDTHS.inspector;
    expect(maxPanelWidth("library", NARROW, other)).toBe(NARROW - other - STAGE_MIN_WIDTH);
    expect(maxPanelWidth("library", 4000, other)).toBe(PANEL_MAX_WIDTH);
    expect(maxPanelWidth("library", 600, other)).toBe(PANEL_MIN_WIDTHS.library);
  });

  it("clamps widths set through the store to the panel's range", () => {
    const { setPanelWidth } = useUIStore.getState();
    setPanelWidth("inspector", 10);
    expect(useUIStore.getState().panelWidths.inspector).toBe(PANEL_MIN_WIDTHS.inspector);
    setPanelWidth("library", 10_000);
    expect(useUIStore.getState().panelWidths.library).toBe(PANEL_MAX_WIDTH);
  });
});

describe("saved panel widths", () => {
  function memoryStorage() {
    const items = new Map<string, string>();
    return {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
    };
  }

  it("round-trips through storage", () => {
    const storage = memoryStorage();
    savePanelWidths(storage, { library: 320, inspector: 360 });
    expect(loadPanelWidths(storage)).toEqual({ library: 320, inspector: 360 });
  });

  it("falls back to the defaults for missing, malformed or out-of-range values", () => {
    expect(parsePanelWidths(null)).toEqual(PANEL_DEFAULT_WIDTHS);
    expect(parsePanelWidths("{not json")).toEqual(PANEL_DEFAULT_WIDTHS);
    expect(parsePanelWidths(JSON.stringify({ library: "wide", inspector: 99999 }))).toEqual({
      library: PANEL_DEFAULT_WIDTHS.library,
      inspector: PANEL_MAX_WIDTH,
    });
  });

  it("uses the defaults when storage is blocked", () => {
    const blocked = {
      getItem: (key: string): string | null => {
        throw new Error(`blocked: ${key}`);
      },
    };
    expect(loadPanelWidths(blocked)).toEqual(PANEL_DEFAULT_WIDTHS);
  });
});

describe("Library auto-collapse", () => {
  const open = { open: true, autoCollapsed: false };

  it("starts collapsed in a narrow window and open in a wide one", () => {
    expect(libraryAfterResize(open, null, NARROW)).toEqual({ open: false, autoCollapsed: true });
    expect(libraryAfterResize(open, null, WIDE)).toEqual(open);
  });

  it("collapses when the window shrinks past the threshold and reopens when it grows back", () => {
    const collapsed = libraryAfterResize(open, WIDE, NARROW);
    expect(collapsed).toEqual({ open: false, autoCollapsed: true });
    expect(libraryAfterResize(collapsed, NARROW, WIDE)).toEqual({
      open: true,
      autoCollapsed: false,
    });
  });

  it("leaves a Library the user opened in a narrow window open while it stays narrow", () => {
    expect(libraryAfterResize(open, NARROW, NARROW - 50)).toEqual(open);
  });

  it("keeps a Library the user closed closed when the window grows", () => {
    const closedByUser = { open: false, autoCollapsed: false };
    expect(libraryAfterResize(closedByUser, NARROW, WIDE)).toEqual(closedByUser);
  });

  it("forgets the automatic collapse once the user toggles the Library", () => {
    const ui = useUIStore.getState();
    ui.setLibraryCollapse({ open: false, autoCollapsed: true });
    useUIStore.getState().togglePanel("library");
    expect(useUIStore.getState().panels.library).toBe(true);
    expect(useUIStore.getState().libraryAutoCollapsed).toBe(false);
  });
});
