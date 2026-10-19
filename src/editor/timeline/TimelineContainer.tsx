import React, { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { schedule } from "../../motion";
import { ShotThumbnail } from "../thumbnails/ShotThumbnail";
import { shotSummary } from "../labels";
import { formatSeconds } from "../loop-length";
import { timeToX, timelineMarks, xToTime } from "./marks";

// A step tick within this distance of the pointer catches a scrub, so a step is easy to land on.
const STEP_SNAP_PX = 6;

/**
 * The slim timeline: one shot that loops, so a scrubber with the loop length and, where the
 * preset has them, its steps (docs/polish-plan/stage-timeline.md, item 2). Play, the timecode
 * and loop are in the stage's transport bar; the shot's length is set in the inspector.
 */
export const TimelineContainer: React.FC = () => {
  const doc = useEditorStore((s) => s.doc);
  const selection = useUIStore((s) => s.selection);
  const playhead = useUIStore((s) => s.playhead);
  const setSelection = useUIStore((s) => s.setSelection);
  const setPlayhead = useUIStore((s) => s.setPlayhead);
  const setPlaying = useUIStore((s) => s.setPlaying);

  const trackRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);

  // The loop length: the shot, less a wrap crossfade's overlap.
  const { total } = useMemo(() => schedule(doc), [doc]);
  // A document has one shot (multi-shot reels were cut on 19 Oct 2026).
  const shot = doc.shots[0];
  const marks = useMemo(() => timelineMarks(shot.layout, total), [shot.layout, total]);
  const summary = shotSummary(shot);
  const isSelected =
    (selection.kind === "shot" && selection.id === shot.id) ||
    (selection.kind === "text" && selection.shotId === shot.id);

  const seekTo = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPlayhead(xToTime(clientX - rect.left, total, rect.width, marks.steps, STEP_SNAP_PX));
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setPlaying(false);
    setScrubbing(true);
    seekTo(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubbing) seekTo(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing) return;
    setScrubbing(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const progress = total > 0 ? Math.min(1, Math.max(0, playhead / total)) : 0;
  const stepLabel = marks.steps.length > 1 ? `${marks.steps.length} steps` : null;

  return (
    <div
      data-testid="timeline"
      data-panel="timeline"
      className="h-11 px-3 bg-[var(--color-panel)] border-t border-[var(--color-line)] flex items-center gap-3 select-none shrink-0 z-20"
    >
      {/* The shot: selects it for the inspector. */}
      <button
        type="button"
        data-testid="shot-card"
        aria-pressed={isSelected}
        aria-label={`Shot: ${summary}`}
        onClick={() => setSelection({ kind: "shot", id: shot.id })}
        className={clsx(
          "h-8 max-w-[220px] pl-1 pr-2.5 flex items-center gap-2 rounded-[var(--radius-sm)] border shrink-0 transition-colors",
          isSelected
            ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text)]"
            : "border-[var(--color-line)] text-[var(--color-text-2)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
        )}
      >
        <ShotThumbnail
          shot={shot}
          className="h-6 rounded-[3px] overflow-hidden bg-black shrink-0"
        />
        <span data-truncate className="text-[11px] font-medium truncate">
          {summary}
        </span>
      </button>

      {/* The scrubber: the whole loop, with a tick where each step starts. */}
      <div
        ref={trackRef}
        role="slider"
        aria-label="Playhead"
        aria-valuemin={0}
        aria-valuemax={Number(total.toFixed(2))}
        aria-valuenow={Number(playhead.toFixed(2))}
        aria-valuetext={`${playhead.toFixed(1)} of ${formatSeconds(Number(total.toFixed(1)))}`}
        tabIndex={0}
        data-testid="scrubber"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="group relative flex-1 min-w-0 h-full cursor-pointer outline-none"
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--color-line-strong)]" />
        <div
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--color-accent)] opacity-50"
          style={{ width: `${progress * 100}%` }}
        />
        {marks.steps.map((time, index) => (
          <div
            key={time}
            data-testid="step-tick"
            title={`Screenshot ${index + 1}`}
            className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-[var(--color-text-3)]"
            style={{ left: `${(timeToX(time, total, 1) * 100).toFixed(3)}%` }}
          />
        ))}
        {marks.loopPoint && (
          <div
            data-testid="loop-point"
            title="Loop point"
            className="absolute right-0 top-1/2 h-2.5 w-px -translate-y-1/2 bg-[var(--color-text-3)]"
          />
        )}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-accent)] ring-2 ring-[var(--color-panel)] group-focus-visible:ring-[var(--color-accent-soft)]"
          style={{ left: `${progress * 100}%` }}
        />
      </div>

      {/* The loop length, and the steps that make it up. */}
      <div className="shrink-0 font-mono text-[11px] text-[var(--color-text-3)] whitespace-nowrap">
        {stepLabel && <span>{stepLabel} · </span>}
        <span className="text-[var(--color-text-2)]">
          {formatSeconds(Number(total.toFixed(1)))}
        </span>{" "}
        loop
      </div>
    </div>
  );
};
