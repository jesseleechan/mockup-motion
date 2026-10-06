import React from "react";
import { IconButton, Icon, Tooltip } from "../../ui";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { schedule } from "../../motion";
import { STAGE_ZOOMS } from "../stage/fit";
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

export const TransportBar: React.FC<TransportBarProps> = ({
  showSafeMargins,
  onToggleSafeMargins,
}) => {
  const doc = useEditorStore((s) => s.doc);
  const apply = useEditorStore((s) => s.apply);

  const playing = useUIStore((s) => s.playing);
  const playhead = useUIStore((s) => s.playhead);
  const stageZoom = useUIStore((s) => s.stageZoom);
  const setPlaying = useUIStore((s) => s.setPlaying);
  const setPlayhead = useUIStore((s) => s.setPlayhead);
  const setStageZoom = useUIStore((s) => s.setStageZoom);

  const { total } = schedule(doc);

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
    <div className="h-10 px-4 bg-[var(--color-panel)] border-t border-[var(--color-line)] flex items-center justify-between select-none shrink-0 z-20">
      {/* Left: Step frame & Play/Pause */}
      <div className="flex items-center gap-1.5">
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
          className="w-7 h-7 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center hover:opacity-90 transition-opacity focus:outline-none"
        >
          <Icon icon={playing ? Pause : Play} size={13} className={playing ? "" : "ml-0.5"} />
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

        <div className="ml-2 font-mono text-[11px] text-[var(--color-text)]">
          <span data-testid="transport-current">{formatTime(playhead)}</span>
          <span className="text-[var(--color-text-3)] mx-1">/</span>
          <span data-testid="transport-total" className="text-[var(--color-text-2)]">
            {formatTime(total)}
          </span>
        </div>
      </div>

      {/* Right: Loop, Safe Margins, Zoom */}
      <div className="flex items-center gap-2">
        <Tooltip content={`Loop playback: ${doc.loop ? "On" : "Off"}`}>
          <button
            type="button"
            aria-label="Toggle loop playback"
            onClick={handleToggleLoop}
            className={`p-1.5 rounded-md text-xs transition-colors ${
              doc.loop
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "text-[var(--color-text-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <Icon icon={Repeat} size={14} />
          </button>
        </Tooltip>

        <Tooltip content={`Safe Margins Overlay: ${showSafeMargins ? "On" : "Off"}`}>
          <button
            type="button"
            aria-label="Toggle safe margins overlay"
            onClick={onToggleSafeMargins}
            className={`p-1.5 rounded-md text-xs transition-colors ${
              showSafeMargins
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "text-[var(--color-text-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <Icon icon={ShieldAlert} size={14} />
          </button>
        </Tooltip>

        <div className="h-4 w-px bg-[var(--color-line)] mx-1" />

        {/* Zoom selector */}
        <div className="flex items-center gap-1 text-[11px] text-[var(--color-text-2)]">
          <Icon icon={Maximize2} size={12} className="text-[var(--color-text-3)]" />
          <select
            aria-label="Stage zoom"
            value={stageZoom}
            onChange={(e) => setStageZoom(Number(e.target.value))}
            className="bg-transparent text-[var(--color-text)] font-medium text-xs focus:outline-none cursor-pointer"
          >
            {STAGE_ZOOMS.map((zoom) => (
              <option key={zoom.value} value={zoom.value} className="bg-[var(--color-panel)]">
                {zoom.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
