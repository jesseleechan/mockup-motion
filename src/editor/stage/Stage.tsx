import React, { lazy, Suspense, useMemo, useRef, useState, useEffect } from "react";
import type { Engine } from "../../engine/Engine";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { createEditorAssetProvider } from "../asset-provider";
import { unfilledSlots, useTemplateActions } from "../template-actions";
import type { AssetRef } from "../../doc/types";
import { aspectRatioValue, schedule } from "../../motion";
import { Button, Icon, useToast } from "../../ui";
import { Film, LayoutTemplate, Sparkles, UploadCloud } from "lucide-react";
import { validateAndDecodeAsset } from "../../assets/decode";
import { fitPreview, STAGE_PADDING, type PreviewSize } from "./fit";
import { FillTemplateOverlay } from "./FillTemplateOverlay";

const EngineCanvas = lazy(() =>
  import("../../engine/react/EngineCanvas").then((m) => ({ default: m.EngineCanvas })),
);

declare global {
  interface Window {
    /** Dev builds only: the editor preview engine, for e2e counters (F05). */
    __editorEngine?: Engine;
  }
}

interface StageProps {
  showSafeMargins: boolean;
}

export const Stage: React.FC<StageProps> = ({ showSafeMargins }) => {
  const doc = useEditorStore((s) => s.doc);
  const apply = useEditorStore((s) => s.apply);
  const assignAssetToSlot = useEditorStore((s) => s.assignAssetToSlot);
  const openTemplateGallery = useUIStore((s) => s.openTemplateGallery);
  const { addScreenshots, fillWithDemoContent } = useTemplateActions();

  const stageZoom = useUIStore((s) => s.stageZoom);
  const selection = useUIStore((s) => s.selection);
  const playhead = useUIStore((s) => s.playhead);
  const selectedShotIndex = useMemo(() => {
    if (selection.kind === "shot") {
      const idx = doc.shots.findIndex((s) => s.id === selection.id);
      return idx !== -1 ? idx : 0;
    }
    return 0;
  }, [doc.shots, selection]);
  const provider = useMemo(() => createEditorAssetProvider(), []);

  const [isDragOver, setIsDragOver] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<PreviewSize | null>(null);
  const { toast } = useToast();

  // Measure the stage so the preview gets an explicit pixel size (F05).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      // clientWidth/Height include the padding that fitPreview subtracts.
      setStageSize({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (import.meta.env.DEV) delete window.__editorEngine;
    };
  }, []);

  const handleFiles = React.useCallback(
    async (files: File[]) => {
      const newRefs: AssetRef[] = [];
      const blobs: Record<string, Blob> = {};

      for (const file of files) {
        try {
          const result = await validateAndDecodeAsset(file, file.name);
          newRefs.push(result.ref);
          blobs[result.ref.id] = result.blob;
        } catch (err) {
          toast(err instanceof Error ? err.message : `${file.name}: this image couldn't be read.`);
        }
      }

      // Fills the template when it is waiting for screenshots (F06).
      if (newRefs.length > 0) await addScreenshots(newRefs, blobs);
    },
    [addScreenshots, toast],
  );

  // Global drag-and-drop listener
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDragOver(true);
      }
    };

    const onDragLeave = (e: DragEvent) => {
      // If leaving window
      if (!e.relatedTarget) {
        setIsDragOver(false);
      }
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        await handleFiles(Array.from(e.dataTransfer.files));
      }
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFiles]);

  const handleCanvasClick = (
    e: React.MouseEvent<HTMLCanvasElement>,
    pick: { nodeId: string; u: number; v: number } | null,
  ) => {
    const activeShot = doc.shots[selectedShotIndex];
    if (
      !pick ||
      !activeShot ||
      activeShot.layout.kind !== "single" ||
      !activeShot.cursor?.enabled
    ) {
      return;
    }

    const isClick = e.altKey;
    const { shots: schedShots } = schedule(doc);
    const sched = schedShots[selectedShotIndex];
    const localT = sched
      ? Math.max(0, Math.min(activeShot.duration, playhead - sched.start))
      : playhead;

    apply(
      (draft) => {
        const target = draft.shots.find((s) => s.id === activeShot.id);
        if (!target) return;
        if (!target.cursor) {
          target.cursor = { enabled: true, style: "arrow", keys: [] };
        }
        const newKey = {
          t: Number(localT.toFixed(2)),
          x: Number(pick.u.toFixed(3)),
          y: Number(pick.v.toFixed(3)),
          click: isClick,
        };
        target.cursor.keys = (target.cursor.keys || []).filter(
          (k) => Math.abs(k.t - newKey.t) > 0.05,
        );
        target.cursor.keys.push(newKey);
        target.cursor.keys.sort((a, b) => a.t - b.t);
      },
      { label: isClick ? "Add cursor click" : "Add cursor key" },
    );
  };

  const isVertical = doc.aspect === "9:16" || doc.aspect === "4:5";
  const showEmptyState = doc.shots.length === 0 || (doc.assets.length === 0 && !doc.templateId);
  // A template is applied but some required slot has no screenshot yet (F06).
  const showFillOverlay = !showEmptyState && unfilledSlots(doc).length > 0;
  const preview = stageSize
    ? fitPreview(stageSize.width, stageSize.height, aspectRatioValue(doc.aspect), stageZoom)
    : null;

  return (
    <div
      ref={stageRef}
      data-testid="stage"
      className="relative flex-1 w-full h-full bg-[var(--color-stage)] flex items-center justify-center overflow-hidden select-none"
      style={{ padding: STAGE_PADDING }}
    >
      {/* Hidden file input for file picker button */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          if (e.target.files) {
            await handleFiles(Array.from(e.target.files));
          }
        }}
      />

      {/* Empty State Card if no assets or shots */}
      {showEmptyState ? (
        <div className="z-10 max-w-md w-full bg-[var(--color-panel)] border border-[var(--color-line)] p-8 rounded-xl shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)] flex items-center justify-center shadow-xs">
            <Icon icon={Film} size={26} />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-[var(--color-text)] tracking-tight">
              Create a presentation
            </h2>
            <p className="text-xs text-[var(--color-text-2)] leading-relaxed">
              Upload screenshots, pick a template, and export a video.
            </p>
          </div>

          <div className="space-y-2.5">
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={openTemplateGallery}
              icon={<Icon icon={LayoutTemplate} size={15} />}
            >
              Start with a template
            </Button>

            <Button
              variant="secondary"
              className="w-full justify-center"
              onClick={() => fileInputRef.current?.click()}
              icon={<Icon icon={UploadCloud} size={15} />}
            >
              Choose screenshots
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-center text-[var(--color-accent)]"
              onClick={fillWithDemoContent}
              icon={<Icon icon={Sparkles} size={15} />}
            >
              Try with demo content
            </Button>
          </div>
        </div>
      ) : preview && preview.width > 0 && preview.height > 0 ? (
        /* Canvas Stage Output Boundary: explicit pixels, fitted to the stage */
        <div className="relative shrink-0" style={{ width: preview.width, height: preview.height }}>
          <div
            ref={canvasContainerRef}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("application/x-mockup-asset-id")) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "copy";

                const canvas = canvasContainerRef.current?.querySelector("canvas");
                if (canvas && engineRef.current) {
                  const rect = canvas.getBoundingClientRect();
                  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
                  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
                  const hit = engineRef.current.pick(x, y);
                  setHoveredNodeId(hit?.nodeId ?? null);
                }
              }
            }}
            onDragLeave={(e) => {
              if (!canvasContainerRef.current?.contains(e.relatedTarget as Node)) {
                setHoveredNodeId(null);
              }
            }}
            onDrop={(e) => {
              const assetId = e.dataTransfer.getData("application/x-mockup-asset-id");
              if (assetId) {
                e.preventDefault();
                e.stopPropagation();
                const canvas = canvasContainerRef.current?.querySelector("canvas");
                if (canvas && engineRef.current) {
                  const rect = canvas.getBoundingClientRect();
                  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
                  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
                  const hit = engineRef.current.pick(x, y);
                  if (hit) {
                    assignAssetToSlot(selectedShotIndex, hit.nodeId, assetId);
                  }
                }
                setHoveredNodeId(null);
              }
            }}
            // A ring instead of a border: the outline must not shrink the canvas below the fit.
            className={`relative w-full h-full rounded-sm overflow-hidden shadow-2xl bg-black transition-shadow ${
              hoveredNodeId
                ? "ring-2 ring-[var(--color-accent)]"
                : "ring-1 ring-[var(--color-line)]"
            }`}
          >
            <Suspense fallback={null}>
              <EngineCanvas
                doc={doc}
                assets={provider}
                onEngineReady={(engine) => {
                  engineRef.current = engine;
                  if (import.meta.env.DEV) window.__editorEngine = engine;
                }}
                onCanvasClick={handleCanvasClick}
              />
            </Suspense>

            {/* Hovered Device Drop Indicator */}
            {hoveredNodeId && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-3 py-1 rounded-full bg-[var(--color-accent)] text-black font-semibold text-xs shadow-lg animate-in fade-in zoom-in-95 duration-100 flex items-center gap-1.5">
                <span>Assign media to {hoveredNodeId}</span>
              </div>
            )}

            {/* Safe Margins Overlay */}
            {showSafeMargins && (
              <div className="absolute inset-0 pointer-events-none z-10">
                {/* 7% perimeter margin */}
                <div className="absolute inset-[7%] border border-dashed border-[var(--color-accent)]/50 rounded-xs flex items-center justify-center">
                  <span className="absolute top-1 left-1.5 text-[9px] font-mono text-[var(--color-accent)]/70 uppercase">
                    7% Safe Margin
                  </span>

                  {/* 80% central vertical safe area for 9:16 and 4:5 */}
                  {isVertical && (
                    <div className="w-full h-[80%] border border-[var(--color-danger)]/60 bg-[var(--color-danger)]/5 rounded-xs flex items-center justify-center">
                      <span className="text-[10px] font-mono text-[var(--color-danger)]/80 uppercase font-semibold">
                        80% Action Area
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {showFillOverlay && (
        <FillTemplateOverlay
          onChooseScreenshots={() => fileInputRef.current?.click()}
          onUseDemoContent={fillWithDemoContent}
        />
      )}

      {/* Global Drag-and-drop Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-[var(--color-bg)]/80 backdrop-blur-xs border-2 border-dashed border-[var(--color-accent)] flex flex-col items-center justify-center gap-3 animate-in fade-in duration-100">
          <div className="w-14 h-14 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] flex items-center justify-center animate-bounce">
            <Icon icon={UploadCloud} size={30} />
          </div>
          <div className="text-base font-semibold text-[var(--color-text)]">
            Drop screenshots anywhere to add
          </div>
          <div className="text-xs text-[var(--color-text-2)]">
            PNG, WebP, JPG up to 8K resolution
          </div>
        </div>
      )}
    </div>
  );
};
