import React, { useMemo } from "react";
import clsx from "clsx";
import { IconButton, Icon, Tooltip } from "../../ui";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { schedule } from "../../motion";
import { STAGE_ZOOMS } from "../stage/fit";
import { Cluster, ClusterSeparator } from "../shell/Cluster";
import { LoopLength, ShotButton, TimelineScrubber } from "../timeline/TimelineContainer";
import { timelineMarks } from "../timeline/marks";
import {
  Play,
  Pause,
  Repeat,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  ShieldAlert,
} from "lucide-react";

interface TransportBarProps {
  showSafeMargins: boolean;
  onToggleSafeMargins: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const tenths = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${tenths}`;
}

// The last to hide as the toolbar narrows (see TransportBar).
const NARROW_HIDDEN = "@max-[560px]:hidden";

const toggleClass = (on: boolean) =>
  clsx(
    "w-8 h-8 flex items-center justify-center shrink-0 rounded-[9px] transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
    on
      ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
      : "text-[var(--color-text-2)] hover:text-[var(--color-text)] hover:bg-[var(--color-field)]",
  );

/**
 * The floating toolbar under the stage, as Layout Stage's canvas bar: the transport and the slim
 * timeline in one pill (docs/restyle-plan/README.md, R2). In order: the shot, previous, play and
 * next, the timecode, the scrubber, the loop length, then loop, safe margins and zoom.
 *
 * As the toolbar narrows, the scrubber gives way first (it takes the free width), then labels
 * hide, never controls, each where the scrubber would otherwise drop under about 170 px:
 *   - below 960 px, the timecode's total, which the loop length also shows;
 *   - below 880 px, the steps count, which the scrubber's ticks also show;
 *   - below 760 px, the word "loop";
 *   - below 700 px, the shot's name, which stays its accessible name;
 *   - below 560 px, the separators and the zoom icon.
 * Then everything fits at the stage's narrowest, 480 px (panel-layout.ts), with the scrubber at
 * 40 px or more. Turning the timeline off (panels.timeline) leaves the transport alone, in a pill
 * that hugs it.
 */
export const TransportBar: React.FC<TransportBarProps> = ({
  showSafeMargins,
  onToggleSafeMargins,
}) => {
  const doc = useEditorStore((s) => s.doc);
  const apply = useEditorStore((s) => s.apply);

  const playing = useUIStore((s) => s.playing);
  const playhead = useUIStore((s) => s.playhead);
  const stageZoom = useUIStore((s) => s.stageZoom);
  const showTimeline = useUIStore((s) => s.panels.timeline);
  const setPlaying = useUIStore((s) => s.setPlaying);
  const setPlayhead = useUIStore((s) => s.setPlayhead);
  const setStageZoom = useUIStore((s) => s.setStageZoom);

  // The loop length: the shot, less a wrap crossfade's overlap.
  const { total } = useMemo(() => schedule(doc), [doc]);
  const layout = doc.shots[0].layout;
  const marks = useMemo(() => timelineMarks(layout, total), [layout, total]);

  const handleTogglePlay = () => {
    setPlaying(!playing);
  };

  const handleStepFrame = (deltaFrames: number) => {
    setPlaying(false);
    const frameDuration = 1 / 30;
    const next = Math.max(0, Math.min(total, playhead + deltaFrames * frameDuration));
    setPlayhead(next);
  };

  const handleToggleLoop = () => {
    apply((draft) => {
      draft.loop = !draft.loop;
    });
  };

  return (
    // The container the labels' @max-[…] widths refer to. The pill inside fills it, or hugs the
    // transport when the timeline is off.
    <div className="@container shrink-0 w-full">
      <Cluster
        data-testid="timeline"
        data-panel="timeline"
        className={clsx("select-none", showTimeline ? "w-full" : "w-fit mx-auto")}
      >
        {showTimeline && (
          <>
            <ShotButton />
            <ClusterSeparator className={NARROW_HIDDEN} />
          </>
        )}

        <Tooltip content="Step backward 1 frame (←)">
          <IconButton
            icon={<Icon icon={ChevronLeft} size={15} />}
            aria-label="Previous frame"
            variant="ghost"
            size="sm"
            onClick={() => handleStepFrame(-1)}
          />
        </Tooltip>

        <button
          type="button"
          onClick={handleTogglePlay}
          aria-label={playing ? "Pause" : "Play"}
          data-testid="transport-play"
          className="w-8 h-8 shrink-0 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-ink)] flex items-center justify-center hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]"
        >
          <Icon icon={playing ? Pause : Play} size={14} className={playing ? "" : "ml-0.5"} />
        </button>

        <Tooltip content="Step forward 1 frame (→)">
          <IconButton
            icon={<Icon icon={ChevronRight} size={15} />}
            aria-label="Next frame"
            variant="ghost"
            size="sm"
            onClick={() => handleStepFrame(1)}
          />
        </Tooltip>

        <div className="shrink-0 px-1.5 font-mono text-[11px] tabular-nums text-[var(--color-text)] whitespace-nowrap">
          <span data-testid="transport-current">{formatTime(playhead)}</span>
          {/* Without the timeline, nothing else shows the total, and there is room for it. */}
          <span className={showTimeline ? "@max-[960px]:hidden" : undefined}>
            <span className="text-[var(--color-text-3)] mx-1">/</span>
            <span data-testid="transport-total" className="text-[var(--color-text-2)]">
              {formatTime(total)}
            </span>
          </span>
        </div>

        {showTimeline && (
          <>
            <TimelineScrubber total={total} marks={marks} />
            <LoopLength total={total} steps={marks.steps.length} />
          </>
        )}

        <ClusterSeparator className={NARROW_HIDDEN} />

        <Tooltip content={`Loop playback: ${doc.loop ? "On" : "Off"}`}>
          <button
            type="button"
            aria-label="Toggle loop playback"
            onClick={handleToggleLoop}
            className={toggleClass(doc.loop)}
          >
            <Icon icon={Repeat} size={14} />
          </button>
        </Tooltip>

        <Tooltip content={`Safe margins: ${showSafeMargins ? "on" : "off"}`}>
          <button
            type="button"
            aria-label="Toggle safe margins overlay"
            onClick={onToggleSafeMargins}
            className={toggleClass(showSafeMargins)}
          >
            <Icon icon={ShieldAlert} size={14} />
          </button>
        </Tooltip>

        <ClusterSeparator className={NARROW_HIDDEN} />

        {/* Zoom selector */}
        <div className="flex items-center gap-1 shrink-0 h-8 pl-1.5 pr-1 text-[var(--color-text-2)]">
          <Icon icon={Maximize2} size={12} className={NARROW_HIDDEN} />
          <select
            aria-label="Stage zoom"
            value={stageZoom}
            onChange={(e) => setStageZoom(Number(e.target.value))}
            className="bg-transparent text-[var(--color-text)] font-medium text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-[6px] cursor-pointer"
          >
            {STAGE_ZOOMS.map((zoom) => (
              <option key={zoom.value} value={zoom.value} className="bg-[var(--color-panel)]">
                {zoom.label}
              </option>
            ))}
          </select>
        </div>
      </Cluster>
    </div>
  );
};
