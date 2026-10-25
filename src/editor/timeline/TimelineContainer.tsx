import React, { useRef, useState } from "react";
import clsx from "clsx";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { ShotThumbnail } from "../thumbnails/ShotThumbnail";
import { formatSeconds, shotSummary } from "../labels";
import { scrubberKeyTime, timeToX, xToTime, type TimelineMarks } from "./marks";

/*
 * The slim timeline: one shot that loops, so a scrubber with the loop length and, where the
 * preset has them, its steps (docs/polish-plan/stage-timeline.md, item 2). Its pieces sit in the
 * toolbar under the stage, between the transport's controls (transport/TransportBar.tsx); the
 * shot's length is set in the inspector. Labels marked with @max-[…] hide when that toolbar is
 * narrow, never the controls (docs/restyle-plan/README.md, R2).
 */

// A step tick within this distance of the pointer catches a scrub, so a step is easy to land on.
const STEP_SNAP_PX = 6;

/** The shot: selects it for the inspector. */
export const ShotButton: React.FC = () => {
  // A document has one shot (multi-shot reels were cut on 19 Oct 2026).
  const shot = useEditorStore((s) => s.doc.shots[0]);
  const selection = useUIStore((s) => s.selection);
  const setSelection = useUIStore((s) => s.setSelection);
  const summary = shotSummary(shot);
  const isSelected = selection.kind === "shot" && selection.id === shot.id;

  return (
    <button
      type="button"
      data-testid="shot-card"
      aria-pressed={isSelected}
      aria-label={`Shot: ${summary}`}
      onClick={() => setSelection({ kind: "shot", id: shot.id })}
      className={clsx(
        "h-9 max-w-[200px] pl-1 pr-2.5 @max-[700px]:pr-1 flex items-center gap-2 rounded-[10px] border shrink-0 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
        isSelected
          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text)]"
          : "border-transparent text-[var(--color-text-2)] hover:bg-[var(--color-field)] hover:text-[var(--color-text)]",
      )}
    >
      <ShotThumbnail shot={shot} className="h-7 rounded-[6px] overflow-hidden bg-black shrink-0" />
      <span data-truncate className="text-[11px] font-medium truncate @max-[700px]:hidden">
        {summary}
      </span>
    </button>
  );
};

interface ScrubberProps {
  /** The loop length in seconds: the shot, less a wrap crossfade's overlap. */
  total: number;
  marks: TimelineMarks;
}

/** The scrubber: the whole loop, with a tick where each step starts. It takes the free width. */
export const TimelineScrubber: React.FC<ScrubberProps> = ({ total, marks }) => {
  const playhead = useUIStore((s) => s.playhead);
  const setPlayhead = useUIStore((s) => s.setPlayhead);
  const setPlaying = useUIStore((s) => s.setPlaying);

  const trackRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);

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

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const next = scrubberKeyTime(e.key, e.shiftKey, playhead, total, marks.steps);
    if (next === null) return;
    // The editor's global arrow and Home/End shortcuts would move the playhead a second time.
    e.preventDefault();
    e.stopPropagation();
    setPlaying(false);
    setPlayhead(next);
  };

  const progress = total > 0 ? Math.min(1, Math.max(0, playhead / total)) : 0;

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Timeline scrubber"
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
      onKeyDown={onKeyDown}
      // Inset by the playhead's radius, so the playhead never covers its neighbours at 0 and the
      // end. 40 px is the least it gives way to (TransportBar.tsx).
      className="group relative flex-1 min-w-10 self-stretch mx-1.5 cursor-pointer outline-none touch-none"
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
  );
};

/** The loop length, and the steps that make it up. */
export const LoopLength: React.FC<{ total: number; steps: number }> = ({ total, steps }) => (
  <div className="shrink-0 px-1 font-mono text-[11px] tabular-nums text-[var(--color-text-2)] whitespace-nowrap">
    {steps > 1 && <span className="@max-[880px]:hidden">{steps} steps · </span>}
    <span className="text-[var(--color-text)]">{formatSeconds(Number(total.toFixed(1)))}</span>
    <span className="@max-[760px]:hidden"> loop</span>
  </div>
);
