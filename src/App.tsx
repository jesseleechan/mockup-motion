import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clapperboard,
  Upload,
  Undo2,
  Redo2,
  Check,
  LoaderCircle,
  ChevronRight,
  SlidersHorizontal,
  PanelsTopLeft,
  X,
  RotateCcw,
} from "lucide-react";
import { useEditor } from "./editor/useEditor";
import { PRESETS, applyPreset } from "./presets/presets";
import { loadFiles, loadDemoImages } from "./assets/images";
import type { AspectRatio, Preset } from "./types";
import { PresetsPanel } from "./editor/Presets";
import { MediaPanel, MediaStrip } from "./editor/Media";
import { Inspector } from "./editor/Inspector";
import { Preview, type PreviewHandle } from "./editor/Preview";
import { ExportDialog } from "./editor/ExportDialog";
import { Modal } from "./editor/Modal";

export default function App() {
  const editor = useEditor(),
    { project, update, changeComposition } = editor;
  const [tab, setTab] = useState<"presets" | "media">("presets"),
    [mobilePanel, setMobilePanel] = useState<"library" | "settings" | null>(null),
    [exportOpen, setExportOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [dragging, setDragging] = useState(false),
    [message, setMessage] = useState(""),
    [presetModal, setPresetModal] = useState(false),
    [presetName, setPresetName] = useState(""),
    [startOver, setStartOver] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    replaceId = useRef<string | null>(null),
    preview = useRef<PreviewHandle>(null),
    dragDepth = useRef(0);
  const allPresets = [...PRESETS, ...editor.presets],
    selected = allPresets.find((p) => p.id === project.presetId) ?? PRESETS[0];
  const notify = useCallback((text: string) => setMessage(text), []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  const addFiles = useCallback(
    async (files: File[]) => {
      if (!files.length || !editor.ready) return;
      const target = replaceId.current;
      replaceId.current = null;
      setLoading(true);
      try {
        const result = await loadFiles(files);
        if (result.images.length)
          update((p) => {
            const images = target
              ? p.images.map((i) =>
                  i.id === target ? { ...result.images[0], id: i.id, category: i.category } : i,
                )
              : [
                  ...p.images.filter(
                    (i) => !i.id.startsWith("sample-") && !i.id.startsWith("demo-"),
                  ),
                  ...result.images,
                ];
            return { ...p, images };
          });
        if (result.errors.length) notify(result.errors.join(" "));
        else if (result.images.length)
          notify(
            `${result.images.length} screenshot${result.images.length === 1 ? "" : "s"} added.`,
          );
      } catch (error) {
        notify(error instanceof Error ? error.message : "Could not load the screenshots.");
      } finally {
        setLoading(false);
      }
    },
    [editor.ready, update, notify],
  );
  const onUpload = () => {
    replaceId.current = null;
    input.current?.click();
  };
  const onReplace = (id: string) => {
    replaceId.current = id;
    input.current?.click();
  };
  const onDemo = async () => {
    if (loading || !editor.ready) return;
    setLoading(true);
    try {
      const images = await loadDemoImages();
      update((p) => (p.images.length ? p : { ...p, images }));
      notify("Demo loaded. Your first upload replaces these samples.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not load the demo.");
    } finally {
      setLoading(false);
    }
  };
  const onSelect = (id: string) =>
    changeComposition({
      assetIds: { ...project.composition.assetIds, primary: id },
    });
  const onRemove = (id: string) =>
    update((p) => ({
      ...p,
      images: p.images.filter((i) => i.id !== id),
      composition: {
        ...p.composition,
        assetIds: {
          primary: p.composition.assetIds.primary === id ? "" : p.composition.assetIds.primary,
          mobile: p.composition.assetIds.mobile === id ? "" : p.composition.assetIds.mobile,
        },
        background: {
          ...p.composition.background,
          imageId: p.composition.background.imageId === id ? "" : p.composition.background.imageId,
        },
        brand: {
          ...p.composition.brand,
          logoId: p.composition.brand.logoId === id ? "" : p.composition.brand.logoId,
        },
      },
    }));
  const onReorder = (id: string, direction: number) =>
    update((p) => {
      const images = [...p.images],
        index = images.findIndex((i) => i.id === id),
        next = index + direction;
      if (index < 0 || next < 0 || next >= images.length) return p;
      [images[index], images[next]] = [images[next], images[index]];
      return { ...p, images };
    });
  const onCategory = (id: string, category: "desktop" | "mobile") =>
    update((p) => ({
      ...p,
      images: p.images.map((i) => (i.id === id ? { ...i, category } : i)),
    }));
  const mediaProps = {
    project,
    onUpload,
    onDemo,
    onSelect,
    onRemove,
    onReplace,
    onReorder,
    onCategory,
  };
  const selectPreset = (p: Preset) => {
    update((current) => applyPreset(current, p));
    setMobilePanel(null);
  };
  useEffect(() => {
    const listener = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener("paste", listener);
    return () => window.removeEventListener("paste", listener);
  }, [addFiles]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable ||
        document.querySelector("dialog[open]")
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          editor.redo();
        } else {
          editor.undo();
        }
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [editor]);
  const finishSavePreset = () => {
    if (!presetName.trim()) return;
    try {
      editor.savePreset(presetName.trim());
      setPresetModal(false);
      notify("Your preset is saved.");
    } catch {
      notify("Could not save this preset. Device storage may be full.");
    }
  };
  return (
    <div
      className={`app-shell ${dragging ? "drag-over" : ""}`}
      aria-busy={!editor.ready || loading}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current--;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          replaceId.current = null;
          addFiles(Array.from(e.dataTransfer.files));
        }
      }}
    >
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="MockupMotion home">
          <span className="brand-mark">
            <Clapperboard size={19} />
          </span>
          <strong>MockupMotion</strong>
        </a>
        <div className="project-title">
          <input
            aria-label="Project name"
            value={project.name}
            maxLength={80}
            disabled={!editor.ready}
            onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
          />
          <span className="save-state" role="status">
            {editor.saveStatus === "Saving…" || !editor.ready ? (
              <LoaderCircle size={13} className="spin" />
            ) : (
              <Check size={13} />
            )}
            <span>{editor.saveStatus}</span>
          </span>
        </div>
        <div className="toolbar-actions">
          <button
            className="toolbar-button"
            aria-label="Undo"
            title="Undo (⌘Z)"
            disabled={!editor.canUndo}
            onClick={editor.undo}
          >
            <Undo2 size={16} />
            <span>Undo</span>
          </button>
          <button
            className="toolbar-button"
            aria-label="Redo"
            title="Redo (⇧⌘Z)"
            disabled={!editor.canRedo}
            onClick={editor.redo}
          >
            <Redo2 size={16} />
            <span>Redo</span>
          </button>
          <label className="ratio-control">
            <span className="sr-only">Output aspect ratio</span>
            <select
              aria-label="Output aspect ratio"
              value={project.aspectRatio}
              onChange={(e) =>
                update((p) => ({
                  ...p,
                  aspectRatio: e.target.value as AspectRatio,
                }))
              }
            >
              {(["16:9", "9:16", "1:1", "4:5"] as const).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary-button"
            disabled={!project.images.length || busy || !editor.ready}
            onClick={() => {
              preview.current?.pause();
              setExportOpen(true);
            }}
          >
            <Upload size={16} />
            <span>Export video</span>
          </button>
        </div>
      </header>
      <main className="editor-grid">
        <aside
          className={`library ${mobilePanel === "library" ? "mobile-open" : ""}`}
          aria-label="Presets and media"
        >
          <div className="library-tabs" role="tablist" aria-label="Library">
            <button role="tab" aria-selected={tab === "presets"} onClick={() => setTab("presets")}>
              Presets
            </button>
            <button role="tab" aria-selected={tab === "media"} onClick={() => setTab("media")}>
              Media
              {project.images.length > 0 && (
                <span className="media-count">{project.images.length}</span>
              )}
            </button>
            <button
              className="mobile-close icon-button"
              aria-label="Close library"
              onClick={() => setMobilePanel(null)}
            >
              <X size={16} />
            </button>
          </div>
          {tab === "presets" ? (
            <PresetsPanel
              selectedId={project.presetId}
              onApply={selectPreset}
              custom={editor.presets}
              favorites={editor.favorites}
              onFavorite={(id) => {
                try {
                  editor.toggleFavorite(id);
                } catch {
                  notify("Could not save favorites.");
                }
              }}
              onSave={() => {
                setPresetName(`${selected.name} — My edit`);
                setPresetModal(true);
              }}
              onDelete={(id) => {
                try {
                  editor.removePreset(id);
                } catch {
                  notify("Could not remove the preset.");
                }
              }}
            />
          ) : (
            <MediaPanel {...mediaProps} />
          )}
        </aside>
        <section className="studio" aria-label="Presentation workspace">
          <div className="workspace-toolbar">
            <div className="breadcrumb">
              <span>{selected.name}</span>
              {project.customized && <span className="modified-dot" title="Customized" />}
              <ChevronRight size={13} />
              <span>Preview</span>
            </div>
            <button className="toolbar-button start-over" onClick={() => setStartOver(true)}>
              <RotateCcw size={13} />
              Start over
            </button>
          </div>
          <Preview
            ref={preview}
            project={project}
            busy={busy}
            onUpload={onUpload}
            onDemo={onDemo}
            onLoop={(v) =>
              changeComposition({
                motion: { ...project.composition.motion, loop: v },
              })
            }
          />
          <MediaStrip {...mediaProps} />
          <div className="mobile-tools">
            <button onClick={() => setMobilePanel(mobilePanel === "library" ? null : "library")}>
              <PanelsTopLeft size={17} />
              Presets & media
            </button>
            <button onClick={() => setMobilePanel(mobilePanel === "settings" ? null : "settings")}>
              <SlidersHorizontal size={17} />
              Settings
            </button>
          </div>
        </section>
        <div className={`inspector-wrapper ${mobilePanel === "settings" ? "mobile-open" : ""}`}>
          <button
            className="mobile-close close-settings icon-button"
            aria-label="Close settings"
            onClick={() => setMobilePanel(null)}
          >
            <X size={18} />
          </button>
          <Inspector
            project={project}
            change={changeComposition}
            onImageCrop={(id, value) =>
              update((p) => ({
                ...p,
                images: p.images.map((i) => (i.id === id ? { ...i, crop: value } : i)),
              }))
            }
            begin={editor.begin}
            end={editor.end}
            reset={() => update((p) => applyPreset(p, selected))}
          />
        </div>
      </main>
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload screenshot files"
        accept="image/png,image/jpeg,image/webp,image/avif"
        multiple
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {dragging && (
        <div className="drop-overlay">
          <Upload size={34} />
          <h2>Drop your screenshots</h2>
          <p>Let’s make something beautiful.</p>
        </div>
      )}
      {loading && (
        <div className="loading-pill" role="status">
          <LoaderCircle size={15} className="spin" />
          Opening screenshots…
        </div>
      )}
      {message && (
        <div className="toast" role="status">
          <span>{message}</span>
          <button aria-label="Dismiss notification" onClick={() => setMessage("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {exportOpen && (
        <ExportDialog
          project={project}
          // eslint-disable-next-line react-hooks/refs -- legacy: preview ref accessed to read current playback time on dialog open
          time={preview.current?.time() ?? 0}
          onSettings={(settings) => update((p) => ({ ...p, exportSettings: settings }))}
          onClose={() => setExportOpen(false)}
          onBusy={setBusy}
        />
      )}
      {presetModal && (
        <Modal title="Save your look" onClose={() => setPresetModal(false)}>
          <p className="modal-description">
            Keep these settings as a starting point for your next project.
          </p>
          <label className="text-field">
            <span>Preset name</span>
            <input
              autoFocus
              aria-label="Preset name"
              value={presetName}
              maxLength={50}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") finishSavePreset();
              }}
            />
          </label>
          <button
            className="primary-button export-start"
            onClick={finishSavePreset}
            disabled={!presetName.trim()}
          >
            Save preset
          </button>
        </Modal>
      )}
      {startOver && (
        <Modal title="Start a fresh presentation?" onClose={() => setStartOver(false)}>
          <p className="modal-description">
            Clear the screenshots and reset this composition. You can undo this change.
          </p>
          <button
            className="primary-button export-start"
            onClick={() => {
              update((p) => ({
                ...applyPreset(p, PRESETS[0]),
                images: [],
                name: "Untitled project",
                composition: structuredClone(PRESETS[0].composition),
              }));
              setStartOver(false);
            }}
          >
            Start over
          </button>
        </Modal>
      )}
    </div>
  );
}
