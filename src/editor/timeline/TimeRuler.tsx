import React, { useRef } from "react";

export interface TimeRulerProps {
  totalDuration: number;
  playhead: number;
  pxPerSecond: number;
  shotBoundaries: number[];
  onSeek: (time: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

export const TimeRuler: React.FC<TimeRulerProps> = ({
  totalDuration,
  playhead,
  pxPerSecond,
  shotBoundaries,
  onSeek,
  onScrubStart,
  onScrubEnd,
}) => {
  const rulerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Determine tick interval
  // If pxPerSecond > 60: major tick every 1s, minor tick every 0.5s
  // If pxPerSecond > 120: major tick every 0.5s, minor tick every 0.1s
  // Else: major tick every 1s or 2s
  let majorStep = 1;
  let minorStep = 0.5;
  if (pxPerSecond >= 100) {
    majorStep = 0.5;
    minorStep = 0.1;
  } else if (pxPerSecond < 35) {
    majorStep = 2;
    minorStep = 1;
  }

  const ticks: Array<{ time: number; isMajor: boolean }> = [];
  const maxTime = Math.max(1, Math.ceil(totalDuration));
  for (let t = 0; t <= maxTime; t += minorStep) {
    const isMajor = Math.abs(t % majorStep) < 0.001 || Math.abs((t % majorStep) - majorStep) < 0.001;
    ticks.push({ time: Number(t.toFixed(2)), isMajor });
  }

  const computeTimeFromEvent = (e: React.PointerEvent<HTMLDivElement>): number => {
    const rect = rulerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    const clientX = e.clientX - rect.left;
    let targetTime = clientX / pxPerSecond;
    targetTime = Math.max(0, Math.min(totalDuration, targetTime));

    // Shift-snap to shot boundaries
    if (e.shiftKey && shotBoundaries.length > 0) {
      const snapThresholdSec = Math.max(0.15, 12 / pxPerSecond); // ~12px snap zone
      for (const boundary of shotBoundaries) {
        if (Math.abs(targetTime - boundary) <= snapThresholdSec) {
          targetTime = boundary;
          break;
        }
      }
    }

    return targetTime;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onScrubStart?.();

    const t = computeTimeFromEvent(e);
    onSeek(t);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const t = computeTimeFromEvent(e);
    onSeek(t);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture might have been lost
      }
      onScrubEnd?.();
    }
  };

  const playheadX = playhead * pxPerSecond;

  return (
    <div
      ref={rulerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="slider"
      aria-label="Timeline scrubber"
      aria-valuemin={0}
      aria-valuemax={totalDuration}
      aria-valuenow={playhead}
      tabIndex={0}
      className="relative h-6 bg-[var(--color-raised)] border-b border-[var(--color-line)] cursor-pointer select-none overflow-hidden touch-none"
      style={{ width: `${Math.max(1, totalDuration * pxPerSecond)}px` }}
    >
      {/* Ticks and time labels */}
      {ticks.map(({ time, isMajor }) => {
        const leftPx = time * pxPerSecond;
        return (
          <div
            key={time}
            style={{ left: `${leftPx}px` }}
            className="absolute top-0 bottom-0 pointer-events-none flex flex-col justify-end"
          >
            {isMajor ? (
              <>
                <span className="absolute top-1 left-1 text-[9px] font-mono text-[var(--color-text-3)] leading-none select-none">
                  {time.toFixed(majorStep < 1 ? 1 : 0)}s
                </span>
                <div className="h-2.5 w-[1px] bg-[var(--color-line-strong)]" />
              </>
            ) : (
              <div className="h-1.5 w-[1px] bg-[var(--color-line)]" />
            )}
          </div>
        );
      })}

      {/* Shot boundary markers */}
      {shotBoundaries.map((boundary, idx) => (
        <div
          key={`boundary-${idx}`}
          style={{ left: `${boundary * pxPerSecond}px` }}
          className="absolute top-0 bottom-0 w-[1px] bg-[var(--color-line-strong)] opacity-60 pointer-events-none"
        />
      ))}

      {/* Playhead indicator on ruler */}
      <div
        style={{ left: `${playheadX}px` }}
        className="absolute top-0 bottom-0 w-[2px] bg-[var(--color-accent)] pointer-events-none z-30"
      >
        <div className="w-2.5 h-2.5 -ml-[4px] -top-0.5 bg-[var(--color-accent)] rotate-45 rounded-xs shadow-xs" />
      </div>
    </div>
  );
};
