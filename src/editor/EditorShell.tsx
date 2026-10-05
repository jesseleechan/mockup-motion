import React, { lazy, Suspense, useEffect, useState } from "react";
import { TopBar } from "./shell/TopBar";
import { LibraryPanel } from "./library/LibraryPanel";
import { Stage } from "./stage/Stage";
import { TransportBar } from "./transport/TransportBar";
import { TimelineContainer } from "./timeline/TimelineContainer";
import { InspectorPanel } from "./inspector/InspectorPanel";
import { ShortcutsModal } from "./dialogs/ShortcutsModal";
import { ProjectsModal } from "./dialogs/ProjectsModal";
import { useEditorStore, setupAutosave } from "../state/store";
import { useUIStore } from "../state/ui-store";
import { checkAndMigrateV1 } from "../storage/projects";
import { schedule } from "../motion";
import { useAudioPreview } from "./audio/useAudioPreview";
import { ToastProvider, TooltipProvider } from "../ui";
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
  useAudioPreview();
  const togglePanel = useUIStore((s) => s.togglePanel);
  const setTheme = useUIStore((s) => s.setTheme);

  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [showSafeMargins, setShowSafeMargins] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(false);

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

    // 4. Mobile screen resize listener (< 1024px)
    const checkMobile = () => {
      setIsMobileScreen(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      cancelAutosave();
      window.removeEventListener("resize", checkMobile);
    };
  }, [loadDoc, setTheme]);

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

      // Cmd+D: Duplicate Shot
      if (cmdKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (selection.kind === "shot") {
          const target = doc.shots.find((s) => s.id === selection.id);
          if (target) {
            const copy = { ...structuredClone(target), id: crypto.randomUUID() };
            apply(
              (draft) => {
                const idx = draft.shots.findIndex((s) => s.id === selection.id);
                draft.shots.splice(idx + 1, 0, copy);
              },
              { label: "Duplicate shot" },
            );
            setSelection({ kind: "shot", id: copy.id });
          }
        }
        return;
      }

      // Delete / Backspace: Remove selected shot or text
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selection.kind === "shot" && doc.shots.length > 1) {
          e.preventDefault();
          apply(
            (draft) => {
              draft.shots = draft.shots.filter((s) => s.id !== selection.id);
            },
            { label: "Delete shot" },
          );
          setSelection({ kind: "video" });
        } else if (selection.kind === "text") {
          e.preventDefault();
          apply(
            (draft) => {
              const targetShot = draft.shots.find((s) => s.id === selection.shotId);
              if (targetShot) {
                targetShot.texts = targetShot.texts.filter((t) => t.id !== selection.id);
              }
            },
            { label: "Delete text layer" },
          );
          setSelection({ kind: "shot", id: selection.shotId });
        }
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

  return (
    <ToastProvider>
      <TooltipProvider>
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
            {!isMobileScreen && panels.library && <LibraryPanel />}

            {/* Center Stage & Transport */}
            <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--color-stage)] relative">
              <Stage
                showSafeMargins={showSafeMargins}
                onOpenTemplates={() => {
                  if (!panels.library) togglePanel("library");
                }}
              />
              <TransportBar
                showSafeMargins={showSafeMargins}
                onToggleSafeMargins={() => setShowSafeMargins(!showSafeMargins)}
              />
            </main>

            {/* Inspector Panel (Right) */}
            {!isMobileScreen && panels.inspector && <InspectorPanel />}
          </div>

          {/* Timeline Area (Bottom) */}
          {!isMobileScreen && panels.timeline && <TimelineContainer />}

          {/* Dialogs */}
          {exportOpen && (
            <Suspense fallback={null}>
              <ExportModal open={exportOpen} onOpenChange={setExportOpen} />
            </Suspense>
          )}
          <ShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
          <ProjectsModal open={projectsOpen} onOpenChange={setProjectsOpen} />
        </div>
      </TooltipProvider>
    </ToastProvider>
  );
};
