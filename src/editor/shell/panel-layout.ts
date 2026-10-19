/**
 * Side panel widths and auto-collapse for smaller windows (docs/polish-plan/stage-timeline.md).
 * The widths are a per-browser UI preference, never project data.
 */

export type SidePanel = "library" | "inspector";
export type PanelWidths = Record<SidePanel, number>;

export const PANEL_DEFAULT_WIDTHS: PanelWidths = { library: 280, inspector: 304 };
// The narrowest each panel's content fits without clipping (tests/e2e/ui-overflow.spec.ts):
// the library's tab row needs 272 px, and the inspector's selects clip below its 304 px.
export const PANEL_MIN_WIDTHS: PanelWidths = { library: 272, inspector: 304 };
export const PANEL_MAX_WIDTH = 420;
/** The stage never gets narrower than this because of a panel. */
export const STAGE_MIN_WIDTH = 480;
/** Below this window width the Library collapses on its own. */
export const LIBRARY_AUTO_COLLAPSE_BELOW = 1280;
/** Width of the rail a collapsed side panel leaves. */
export const COLLAPSED_RAIL_WIDTH = 40;

export const PANEL_WIDTHS_KEY = "mockupmotion_panel_widths";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Clamps a saved or dragged width to the panel's own range, ignoring the window. */
export function clampPanelWidth(panel: SidePanel, width: number): number {
  return Math.round(clamp(width, PANEL_MIN_WIDTHS[panel], PANEL_MAX_WIDTH));
}

/**
 * The widest a panel may be in this window while the stage keeps STAGE_MIN_WIDTH, given what
 * the other side takes (its width when open, the rail when collapsed). Never below the panel's
 * minimum: in a window too small for both, the stage gives way.
 */
export function maxPanelWidth(
  panel: SidePanel,
  windowWidth: number,
  otherSideWidth: number,
): number {
  const room = windowWidth - otherSideWidth - STAGE_MIN_WIDTH;
  return clamp(room, PANEL_MIN_WIDTHS[panel], PANEL_MAX_WIDTH);
}

/**
 * The widths the panels render at. The saved widths are kept as they are; a window too narrow
 * for them and STAGE_MIN_WIDTH only narrows what is drawn, each open panel by the same factor,
 * and never below its minimum.
 */
export function renderedPanelWidths(
  saved: PanelWidths,
  open: Record<SidePanel, boolean>,
  windowWidth: number,
): PanelWidths {
  const openPanels = (["library", "inspector"] as const).filter((panel) => open[panel]);
  const rails = (2 - openPanels.length) * COLLAPSED_RAIL_WIDTH;
  const available = windowWidth - STAGE_MIN_WIDTH - rails;
  const openTotal = openPanels.reduce((sum, panel) => sum + saved[panel], 0);
  if (openTotal <= available) return { ...saved };
  const result = { ...saved };
  for (const panel of openPanels) {
    result[panel] = clampPanelWidth(panel, (saved[panel] * available) / openTotal);
  }
  return result;
}

/** Reads the saved widths, falling back to the defaults for anything missing or malformed. */
export function parsePanelWidths(raw: string | null): PanelWidths {
  const widths = { ...PANEL_DEFAULT_WIDTHS };
  if (!raw) return widths;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn("[Panels] ignoring malformed saved widths:", err);
    return widths;
  }
  if (typeof parsed !== "object" || parsed === null) return widths;
  for (const panel of ["library", "inspector"] as const) {
    const value = (parsed as Record<string, unknown>)[panel];
    if (typeof value === "number" && Number.isFinite(value)) {
      widths[panel] = clampPanelWidth(panel, value);
    }
  }
  return widths;
}

export interface LibraryCollapseState {
  open: boolean;
  /** True when the Library is closed because the window got narrow, not by the user. */
  autoCollapsed: boolean;
}

/**
 * The Library's state after the window changes from `previousWidth` to `width` (null on load).
 * Crossing below the threshold closes it; crossing back opens it only if it closed on its own.
 * A Library the user opened or closed at any width stays that way until the next crossing.
 */
export function libraryAfterResize(
  state: LibraryCollapseState,
  previousWidth: number | null,
  width: number,
): LibraryCollapseState {
  const narrow = width < LIBRARY_AUTO_COLLAPSE_BELOW;
  const wasNarrow = previousWidth !== null && previousWidth < LIBRARY_AUTO_COLLAPSE_BELOW;
  if (narrow && (previousWidth === null || !wasNarrow)) {
    return state.open ? { open: false, autoCollapsed: true } : state;
  }
  if (!narrow && wasNarrow && state.autoCollapsed) {
    return { open: true, autoCollapsed: false };
  }
  return state;
}

/** Saves the widths for this browser. Storage can be full or blocked; the editor still works. */
export function savePanelWidths(storage: Pick<Storage, "setItem">, widths: PanelWidths): void {
  try {
    storage.setItem(PANEL_WIDTHS_KEY, JSON.stringify(widths));
  } catch (err) {
    console.warn("[Panels] could not save panel widths:", err);
  }
}

/** Reads the saved widths for this browser, or the defaults. */
export function loadPanelWidths(storage: Pick<Storage, "getItem">): PanelWidths {
  let raw: string | null;
  try {
    raw = storage.getItem(PANEL_WIDTHS_KEY);
  } catch (err) {
    console.warn("[Panels] could not read panel widths:", err);
    return { ...PANEL_DEFAULT_WIDTHS };
  }
  return parsePanelWidths(raw);
}
