import React, { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { schedule } from "../../motion";
import { TimeRuler } from "./TimeRuler";
import { ShotCard } from "./ShotCard";
import { TransitionChip } from "./TransitionChip";
import { AddShotMenu } from "./AddShotMenu";
import { BUILTIN_TEMPLATES } from "../../templates/registry";
import { Icon, Tooltip, useToast } from "../../ui";
import { AudioLane, LANE_HEIGHT, MusicControls } from "./AudioLane";
import { AUDIO_ACCEPT, validateAndDecodeAudio } from "../../audio/decode";
import { Maximize, Music2, Pause, Play, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { AssetRef, Layout, Transition } from "../../doc/types";

export const TimelineContainer: React.FC = () => {
  const doc = useEditorStore((s) => s.doc);
  const apply = useEditorStore((s) => s.apply);
  const addShot = useEditorStore((s) => s.addShot);
  const duplicateShot = useEditorStore((s) => s.duplicateShot);
  const removeShot = useEditorStore((s) => s.removeShot);
  const moveShot = useEditorStore((s) => s.moveShot);
  const setShotDuration = useEditorStore((s) => s.setShotDuration);
  const setTransition = useEditorStore((s) => s.setTransition);
  const splitShot = useEditorStore((s) => s.splitShot);
  const setTextLayerDelay = useEditorStore((s) => s.setTextLayerDelay);
  const setMusic = useEditorStore((s) => s.setMusic);
  const removeMusic = useEditorStore((s) => s.removeMusic);
  const { toast } = useToast();
  const musicInputRef = useRef<HTMLInputElement>(null);

  const selection = useUIStore((s) => s.selection);
  const playhead = useUIStore((s) => s.playhead);
  const playing = useUIStore((s) => s.playing);
  const setSelection = useUIStore((s) => s.setSelection);
  const setPlayhead = useUIStore((s) => s.setPlayhead);
  const setPlaying = useUIStore((s) => s.setPlaying);

  // Zoom state: "fit" or manual multiplier
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [containerWidth, setContainerWidth] = useState<number>(800);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trackWrapperRef = useRef<HTMLDivElement>(null);

  // Measure container width
  useEffect(() => {
    const el = trackWrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compute timing schedule
  const { total, shots: scheduledShots } = useMemo(() => schedule(doc), [doc]);

  // Pixels per second
  const pxPerSecond = useMemo(() => {
    if (total <= 0) return 60;
    if (zoomMode === "fit") {
      // Fit all shots nicely in available width with padding for add button (~100px)
      const availableWidth = Math.max(200, containerWidth - 120);
      return Math.max(25, availableWidth / total);
    }
    return Math.max(25, (containerWidth / total) * zoomLevel);
  }, [containerWidth, total, zoomMode, zoomLevel]);

  // Shot boundaries for Shift-snap
  const shotBoundaries = useMemo(() => {
    const list: number[] = [0];
    for (const s of scheduledShots) {
      if (!list.includes(s.start)) list.push(s.start);
      if (!list.includes(s.end)) list.push(s.end);
    }
    if (!list.includes(total)) list.push(total);
    return list.sort((a, b) => a - b);
  }, [scheduledShots, total]);

  // Selected shot index
  const selectedShotIndex = useMemo(() => {
    if (selection.kind === "shot") {
      return doc.shots.findIndex((s) => s.id === selection.id);
    }
    if (selection.kind === "text") {
      return doc.shots.findIndex((s) => s.id === selection.shotId);
    }
    return -1;
  }, [doc.shots, selection]);

  // Time format helper (00:00.0)
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms}`;
  };

  // Keyboard navigation between shots
  const handleNavigateShot = (direction: -1 | 1) => {
    const currentIndex = selectedShotIndex !== -1 ? selectedShotIndex : 0;
    const nextIndex = Math.max(0, Math.min(doc.shots.length - 1, currentIndex + direction));
    const targetShot = doc.shots[nextIndex];
    if (targetShot) {
      setSelection({ kind: "shot", id: targetShot.id });
    }
  };

  // Add shot from template helper
  const handleAddFromTemplate = (templateId: string, insertAfterIndex?: number) => {
    const tmpl = BUILTIN_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;

    const slots: Record<string, AssetRef> = {};
    for (const slot of tmpl.slots) {
      const images = doc.assets.filter((a) => a.kind === "image");
      const match = images.find((a) => a.role === slot.role) || images[0];
      if (match) slots[slot.key] = match;
    }

    const res = tmpl.build({
      style: doc.style,
      aspect: doc.aspect,
      projectName: doc.name,
      slots,
    });

    if (res.shots.length > 0) {
      apply(
        (draft) => {
          const newS = structuredClone(res.shots[0]);
          newS.id = `shot-${crypto.randomUUID().slice(0, 8)}`;
          if (
            insertAfterIndex !== undefined &&
            insertAfterIndex >= 0 &&
            insertAfterIndex < draft.shots.length
          ) {
            draft.shots.splice(insertAfterIndex + 1, 0, newS);
          } else {
            draft.shots.push(newS);
          }
        },
        { label: `Add shot from template "${tmpl.name}"` },
      );
    }
  };

  // Wheel zoom with Ctrl / trackpad pinch
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoomMode("manual");
      setZoomLevel((prev) => {
        const delta = -e.deltaY * 0.005;
        return Math.max(0.5, Math.min(4.0, prev + delta));
      });
    }
  };

  const playheadX = playhead * pxPerSecond;

  const handleMusicFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { ref, blob } = await validateAndDecodeAudio(file);
      await setMusic(ref, blob);
    } catch (err) {
      toast(err instanceof Error ? err.message : "That audio file couldn't be added.");
    }
  };

  return (
    <div
      onWheel={handleWheel}
      data-testid="timeline"
      data-panel="timeline"
      style={{ height: 148 + (doc.audio ? LANE_HEIGHT : 0) }}
      className="bg-[var(--color-panel)] border-t border-[var(--color-line)] flex flex-col select-none shrink-0 z-20 overflow-hidden"
    >
      <input
        ref={musicInputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        aria-label="Music file"
        data-testid="music-input"
        className="hidden"
        onChange={async (e) => {
          await handleMusicFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {/* Top Toolbar: Time & Zoom controls (28px) */}
      <div className="h-7 px-3 bg-[var(--color-panel)] border-b border-[var(--color-line)] flex items-center justify-between shrink-0 text-xs">
        {/* Playback Controls & Time Display */}
        <div className="flex items-center gap-2">
          <Tooltip content={playing ? "Pause (Space)" : "Play (Space)"}>
            <button
              type="button"
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => setPlaying(!playing)}
              className="p-1 rounded text-[var(--color-text-2)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors"
            >
              <Icon icon={playing ? Pause : Play} size={14} />
            </button>
          </Tooltip>

          <Tooltip content="Rewind to start (Home)">
            <button
              type="button"
              aria-label="Rewind to start"
              onClick={() => {
                setPlaying(false);
                setPlayhead(0);
              }}
              className="p-1 rounded text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors"
            >
              <Icon icon={RotateCcw} size={13} />
            </button>
          </Tooltip>

          <div className="font-mono text-[11px] text-[var(--color-text-2)] pl-1">
            <span className="text-[var(--color-text)] font-semibold">{formatTime(playhead)}</span>
            <span className="text-[var(--color-text-3)]"> / {formatTime(total)}</span>
          </div>
        </div>

        {/* Music */}
        {doc.audio ? (
          <MusicControls onRemove={removeMusic} />
        ) : (
          <button
            type="button"
            onClick={() => musicInputRef.current?.click()}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors"
          >
            <Icon icon={Music2} size={11} />
            Add music
          </button>
        )}

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <Tooltip content="Fit timeline to view">
            <button
              type="button"
              aria-label="Fit timeline"
              onClick={() => {
                setZoomMode("fit");
                setZoomLevel(1.0);
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                zoomMode === "fit"
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-semibold"
                  : "text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]"
              }`}
            >
              <Icon icon={Maximize} size={11} className="inline mr-1" />
              Fit
            </button>
          </Tooltip>

          <Tooltip content="Zoom out (Ctrl + -)">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => {
                setZoomMode("manual");
                setZoomLevel((z) => Math.max(0.5, z * 0.8));
              }}
              className="p-1 rounded text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]"
            >
              <Icon icon={ZoomOut} size={13} />
            </button>
          </Tooltip>

          <Tooltip content="Zoom in (Ctrl + +)">
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => {
                setZoomMode("manual");
                setZoomLevel((z) => Math.min(4.0, z * 1.25));
              }}
              className="p-1 rounded text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]"
            >
              <Icon icon={ZoomIn} size={13} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main Track & Ruler Area */}
      <div
        ref={trackWrapperRef}
        data-scroll-x
        className="flex-1 flex flex-col min-h-0 overflow-x-auto overflow-y-hidden"
      >
        {/* Time Ruler (24px) */}
        <TimeRuler
          totalDuration={total}
          playhead={playhead}
          pxPerSecond={pxPerSecond}
          shotBoundaries={shotBoundaries}
          onSeek={setPlayhead}
          onScrubStart={() => setPlaying(false)}
        />

        {/* Shot Cards Track (flex-1, relative) */}
        <div
          ref={scrollContainerRef}
          className="relative flex-1 px-3 py-1.5 flex items-center gap-1 min-w-max"
        >
          {/* Continuous Playhead Needle spanning through the cards track */}
          <div
            style={{ left: `${playheadX + 12}px` }}
            className="absolute top-0 bottom-0 w-[2px] bg-[var(--color-accent)] pointer-events-none z-30 opacity-80"
          />

          {doc.shots.map((shot, idx) => {
            const isSelected = selectedShotIndex === idx;
            const scheduled = scheduledShots[idx];
            const startSec = scheduled ? scheduled.start : 0;
            const endSec = scheduled ? scheduled.end : shot.duration;
            const cardWidth = shot.duration * pxPerSecond;

            // Transition chip before this shot (for shot > 0)
            const showTransitionBefore = idx > 0;
            const transitionBefore = shot.transitionIn;

            return (
              <React.Fragment key={shot.id}>
                {showTransitionBefore && (
                  <TransitionChip
                    transition={transitionBefore}
                    onChange={(newTrans: Transition) => setTransition(idx, newTrans)}
                  />
                )}

                <ShotCard
                  shot={shot}
                  index={idx}
                  isSelected={isSelected}
                  widthPx={cardWidth}
                  startSec={startSec}
                  endSec={endSec}
                  pxPerSecond={pxPerSecond}
                  playhead={playhead}
                  canDelete={doc.shots.length > 1}
                  onSelect={() => setSelection({ kind: "shot", id: shot.id })}
                  onDurationChange={(newDuration) => setShotDuration(idx, newDuration)}
                  onReorder={moveShot}
                  onDuplicate={() => duplicateShot(idx)}
                  onDelete={() => removeShot(idx)}
                  onSplit={(splitT) => splitShot(idx, splitT)}
                  onChangeLayout={(newLayout: Layout) => {
                    apply(
                      (draft) => {
                        const target = draft.shots[idx];
                        if (target) {
                          target.layout = newLayout;
                        }
                      },
                      { label: "Change layout" },
                    );
                  }}
                  onSelectText={(textId) =>
                    setSelection({ kind: "text", shotId: shot.id, id: textId })
                  }
                  onTextDelayChange={(textId, delay) => setTextLayerDelay(idx, textId, delay)}
                  onNavigateLeft={() => handleNavigateShot(-1)}
                  onNavigateRight={() => handleNavigateShot(1)}
                />
              </React.Fragment>
            );
          })}

          {/* Loop Wrap Transition Chip at the end when loop is enabled */}
          {doc.loop && doc.shots.length > 1 && (
            <TransitionChip
              isLoopWrap
              transition={doc.shots[0].transitionIn}
              onChange={(newTrans: Transition) => setTransition(0, newTrans)}
            />
          )}

          {/* Add Shot Menu Button */}
          <div className="h-full py-0.5">
            <AddShotMenu
              doc={doc}
              insertAfterIndex={selectedShotIndex !== -1 ? selectedShotIndex : undefined}
              onAddShot={addShot}
              onAddFromTemplate={handleAddFromTemplate}
            />
          </div>
        </div>

        {/* Music lane */}
        <AudioLane total={total} pxPerSecond={pxPerSecond} />
      </div>
    </div>
  );
};
