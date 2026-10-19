import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { TopBar } from "./shell/TopBar";
import { PanelResizer } from "./shell/PanelResizer";
import { CollapsedRail } from "./shell/CollapsedRail";
import {
  COLLAPSED_RAIL_WIDTH,
  libraryAfterResize,
  loadPanelWidths,
  maxPanelWidth,
  renderedPanelWidths,
} from "./shell/panel-layout";
import { LibraryPanel } from "./library/LibraryPanel";
import { Stage } from "./stage/Stage";
import { TransportBar } from "./transport/TransportBar";
import { TimelineContainer } from "./timeline/TimelineContainer";
import { InspectorPanel } from "./inspector/InspectorPanel";
import { ShortcutsModal } from "./dialogs/ShortcutsModal";
import { ProjectsModal } from "./dialogs/ProjectsModal";
import { TemplateGalleryModal } from "./dialogs/TemplateGalleryModal";
import { useEditorStore, setupAutosave } from "../state/store";
import { useUIStore } from "../state/ui-store";
import { checkAndMigrateV1 } from "../storage/projects";
import { schedule } from "../motion";
import { ToastProvider, TooltipProvider } from "../ui";
import { ThumbnailProvider } from "./thumbnails/ThumbnailProvider";
import { ProjectThumbnailWriter } from "./thumbnails/ProjectThumbnailWriter";
import { Monitor } from "lucide-react";

const ExportModal = lazy(() =>
  import("./export/ExportModal").then((m) => ({ default: m.ExportModal })),
);

function isInputElement(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

export const EditorShell: React.FC = () => {
  const doc = useEditorStore((s) => s.doc);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const apply = useEditorStore((s) => s.apply);
  const loadDoc = useEditorStore((s) => s.loadDoc);

  const selection = useUIStore((s) => s.selection);
  const playhead = useUIStore((s) => s.playhead);
  const playing = useUIStore((s) => s.playing);
  const panels = useUIStore((s) => s.panels);
  const theme = useUIStore((s) => s.theme);
  const setSelection = useUIStore((s) => s.setSelection);
  const setPlayhead = useUIStore((s) => s.setPlayhead);
  const setPlaying = useUIStore((s) => s.setPlaying);
  const togglePanel = useUIStore((s) => s.togglePanel);
  const setTheme = useUIStore((s) => s.setTheme);
  const panelWidths = useUIStore((s) => s.panelWidths);
  const setPanelWidths = useUIStore((s) => s.setPanelWidths);

  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [showSafeMargins, setShowSafeMargins] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const lastWindowWidth = useRef<number | null>(null);
  const isMobileScreen = windowWidth < 1024;

  // Setup autosave & migration on boot
  useEffect(() => {
    // 1. Theme initialization
    try {
      const savedTheme = localStorage.getItem("mockupmotion_theme") as "dark" | "light" | null;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
      }
    } catch {
      // ignore
    }

    // 2. Autosave subscription
    const cancelAutosave = setupAutosave(useEditorStore);

    // 3. V1 Database Migration
    checkAndMigrateV1()
      .then((migratedDoc) => {
        if (migratedDoc) {
          loadDoc(migratedDoc);
        }
      })
      .catch((err) => {
        console.warn("[Migration] v1 migration check encountered:", err);
      });

    if (import.meta.env.DEV) {
      (window as unknown as { __editorStore: unknown }).__editorStore = useEditorStore;
      (window as unknown as { __uiStore: unknown }).__uiStore = useUIStore;
    }

    return () => {
      cancelAutosave();
    };
  }, [loadDoc, setTheme]);

  // Side panels on smaller windows: saved widths, and the Library collapses below 1280 px
  // (docs/polish-plan/stage-timeline.md).
  useEffect(() => {
    setPanelWidths(loadPanelWidths(localStorage));
    const onResize = () => {
      const width = window.innerWidth;
      const ui = useUIStore.getState();
      const current = { open: ui.panels.library, autoCollapsed: ui.libraryAutoCollapsed };
      const next = libraryAfterResize(current, lastWindowWidth.current, width);
      if (next.open !== current.open || next.autoCollapsed !== current.autoCollapsed) {
        ui.setLibraryCollapse(next);
      }
      lastWindowWidth.current = width;
      setWindowWidth(width);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setPanelWidths]);

  // Filling a template and undoing it replace the shots, so a selected shot can vanish.
  // Move the selection to the first shot instead of leaving the inspector empty (F06).
  useEffect(() => {
    if (selection.kind === "video") return;
    if (doc.shots.some((s) => s.id === selection.id)) return;
    const first = doc.shots[0];
    setSelection(first ? { kind: "shot", id: first.id } : { kind: "video" });
  }, [doc.shots, selection, setSelection]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (isInputElement(e.target)) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;
      const { total } = schedule(doc);

      // Space: Play / Pause
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying(!playing);
        return;
      }

      // Left / Right Arrow: Step frames
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        const step = e.shiftKey ? 1.0 : 1 / 30;
        setPlayhead(Math.max(0, playhead - step));
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlaying(false);
        const step = e.shiftKey ? 1.0 : 1 / 30;
        setPlayhead(Math.min(total, playhead + step));
        return;
      }

      // Home / End
      if (e.key === "Home") {
        e.preventDefault();
        setPlaying(false);
        setPlayhead(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        setPlaying(false);
        setPlayhead(total);
        return;
      }

      // Cmd+Z / Shift+Cmd+Z: Undo / Redo
      if (cmdKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (cmdKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      // Cmd+E: Export
      if (cmdKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setExportOpen(true);
        return;
      }

      // [ / ]: Toggle Panels
      if (e.key === "[") {
        e.preventDefault();
        togglePanel("library");
        return;
      }
      if (e.key === "]") {
        e.preventDefault();
        togglePanel("inspector");
        return;
      }

      // ?: Shortcuts
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    doc,
    playing,
    playhead,
    selection,
    undo,
    redo,
    apply,
    setPlaying,
    setPlayhead,
    setSelection,
    togglePanel,
  ]);

  const widths = renderedPanelWidths(panelWidths, panels, windowWidth);
  const sideWidth = (panel: "library" | "inspector") =>
    panels[panel] ? widths[panel] : COLLAPSED_RAIL_WIDTH;

  return (
    <ToastProvider>
      <TooltipProvider>
        <ThumbnailProvider>
          <ProjectThumbnailWriter />
          <div
            id="app-root"
            data-theme={theme}
            className="flex flex-col h-screen w-screen bg-[var(--color-bg)] text-[var(--color-text)] font-sans overflow-hidden select-none"
          >
            {/* Screen size note (< 1024px) */}
            {isMobileScreen && (
              <div className="bg-[var(--color-raised)] border-b border-[var(--color-line)] px-3 py-1.5 text-center text-xs text-[var(--color-text-2)] flex items-center justify-center gap-1.5 shrink-0 z-40">
                <Monitor size={14} className="text-[var(--color-accent)]" />
                <span>Best edited on a larger screen (1280px+). Panels are collapsed.</span>
              </div>
            )}

            {/* TopBar */}
            <TopBar
              onOpenProjects={() => setProjectsOpen(true)}
              onOpenShortcuts={() => setShortcutsOpen(true)}
              onOpenExport={() => setExportOpen(true)}
            />

            {/* Workspace Body */}
            <div className="flex-1 flex min-h-0 overflow-hidden relative">
              {/* Library Panel (Left) */}
              {!isMobileScreen &&
                (panels.library ? (
                  <div className="relative flex shrink-0 z-20" style={{ width: widths.library }}>
                    <LibraryPanel />
                    <PanelResizer
                      panel="library"
                      width={widths.library}
                      max={maxPanelWidth("library", windowWidth, sideWidth("inspector"))}
                    />
                  </div>
                ) : (
                  <CollapsedRail panel="library" />
                ))}

              {/* Center Stage & Transport */}
              <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--color-stage)] relative">
                <Stage showSafeMargins={showSafeMargins} />
                <TransportBar
                  showSafeMargins={showSafeMargins}
                  onToggleSafeMargins={() => setShowSafeMargins(!showSafeMargins)}
                />
              </main>

              {/* Inspector Panel (Right) */}
              {!isMobileScreen &&
                (panels.inspector ? (
                  <div className="relative flex shrink-0 z-20" style={{ width: widths.inspector }}>
                    <InspectorPanel />
                    <PanelResizer
                      panel="inspector"
                      width={widths.inspector}
                      max={maxPanelWidth("inspector", windowWidth, sideWidth("library"))}
                    />
                  </div>
                ) : (
                  <CollapsedRail panel="inspector" />
                ))}
            </div>

            {/* Timeline Area (Bottom) */}
            {!isMobileScreen && panels.timeline && <TimelineContainer />}

            {/* Dialogs */}
            {exportOpen && (
              <Suspense fallback={null}>
                <ExportModal open={exportOpen} onOpenChange={setExportOpen} />
              </Suspense>
            )}
            <TemplateGalleryModal />
            <ShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
            <ProjectsModal open={projectsOpen} onOpenChange={setProjectsOpen} />
          </div>
        </ThumbnailProvider>
      </TooltipProvider>
    </ToastProvider>
  );
};
