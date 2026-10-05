import React, { useRef } from "react";
import { Music2, X } from "lucide-react";
import { useEditorStore } from "../../state/store";
import { Icon, Tooltip } from "../../ui";
import { MAX_FADE_SEC } from "../../audio/mix";

export const LANE_HEIGHT = 40;
const LANE_PADDING_LEFT = 12;

interface AudioLaneProps {
  total: number;
  pxPerSecond: number;
}

type DragKind = "move" | "fadeIn" | "fadeOut";

/** Timeline lane for the music track: waveform, drag-to-offset, and fade handles. */
export const AudioLane: React.FC<AudioLaneProps> = ({ total, pxPerSecond }) => {
  const audio = useEditorStore((s) => s.doc.audio);
  const asset = useEditorStore((s) => s.doc.assets.find((a) => a.id === s.doc.audio?.assetId));
  const updateMusic = useEditorStore((s) => s.updateMusic);
  const begin = useEditorStore((s) => s.begin);
  const end = useEditorStore((s) => s.end);

  const drag = useRef<{ kind: DragKind; startX: number; start: number } | null>(null);

  if (!audio || !asset) return null;

  const duration = asset.durationSec ?? 0;
  const peaks = asset.peaks ?? [];
  const visibleSec = Math.max(0, Math.min(duration, total - audio.offset));
  const clipLeft = audio.offset * pxPerSecond;
  const clipWidth = Math.max(8, visibleSec * pxPerSecond);
  const fadeInPx = audio.fadeIn * pxPerSecond;
  const fadeOutPx = audio.fadeOut * pxPerSecond;
  // The fade-out always ends at `total`; show it against the end of the visible clip.
  const fadeOutLeft = Math.max(0, (total - audio.fadeOut) * pxPerSecond - clipLeft);

  const startDrag = (e: React.PointerEvent<HTMLElement>, kind: DragKind) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = kind === "move" ? audio.offset : kind === "fadeIn" ? audio.fadeIn : audio.fadeOut;
    drag.current = { kind, startX: e.clientX, start };
    begin();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const deltaSec = (e.clientX - d.startX) / pxPerSecond;
    if (d.kind === "move") {
      const maxOffset = Math.max(0, total - 0.5);
      updateMusic({ offset: Math.min(maxOffset, Math.max(0, d.start + deltaSec)) });
    } else if (d.kind === "fadeIn") {
      updateMusic({ fadeIn: Math.min(MAX_FADE_SEC, Math.max(0, d.start + deltaSec)) });
    } else {
      updateMusic({ fadeOut: Math.min(MAX_FADE_SEC, Math.max(0, d.start - deltaSec)) });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // not captured
    }
    end();
  };

  const onFadeKey = (e: React.KeyboardEvent, key: "fadeIn" | "fadeOut") => {
    const step = e.shiftKey ? 0.5 : 0.1;
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    // Right grows a fade-in and shrinks a fade-out (matches handle movement).
    const sign = key === "fadeIn" ? dir : -dir;
    updateMusic({ [key]: audio[key] + sign * step });
  };

  const max = Math.max(...peaks, 0.001);

  return (
    <div
      data-testid="audio-lane"
      className="relative shrink-0 min-w-max"
      style={{ height: LANE_HEIGHT, paddingLeft: LANE_PADDING_LEFT }}
    >
      <div
        className="relative h-full"
        style={{ width: Math.max(total * pxPerSecond, clipLeft + clipWidth) }}
      >
        <div
          role="group"
          aria-label={`Music track ${asset.name}`}
          data-testid="audio-clip"
          onPointerDown={(e) => startDrag(e, "move")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="absolute top-1 bottom-1 rounded-md overflow-hidden bg-[var(--color-accent-soft)] border border-[var(--color-accent)]/50 cursor-grab active:cursor-grabbing touch-none"
          style={{ left: clipLeft, width: clipWidth }}
        >
          <svg
            className="absolute top-0 left-0 h-full pointer-events-none"
            style={{ width: Math.max(duration * pxPerSecond, 1) }}
            viewBox={`0 0 ${peaks.length || 1} 1`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {peaks.map((p, i) => {
              const h = Math.max(0.04, (p / max) * 0.9);
              return (
                <rect
                  key={i}
                  x={i + 0.15}
                  y={(1 - h) / 2}
                  width={0.7}
                  height={h}
                  fill="var(--color-accent)"
                  opacity={0.85}
                />
              );
            })}
          </svg>
          <span className="absolute left-1.5 top-0.5 flex items-center gap-1 text-[9px] font-medium text-[var(--color-text)] pointer-events-none">
            <Icon icon={Music2} size={10} />
            <span className="truncate max-w-[160px]">{asset.name}</span>
          </span>

          {/* Fade shading */}
          {fadeInPx > 0 && (
            <div
              className="absolute top-0 bottom-0 left-0 pointer-events-none bg-gradient-to-r from-black/60 to-transparent"
              style={{ width: fadeInPx }}
            />
          )}
          {fadeOutPx > 0 && (
            <div
              className="absolute top-0 bottom-0 pointer-events-none bg-gradient-to-l from-black/60 to-transparent"
              style={{ left: fadeOutLeft, width: fadeOutPx }}
            />
          )}
        </div>

        {/* Fade handles */}
        <button
          type="button"
          role="slider"
          aria-label="Fade in"
          aria-valuemin={0}
          aria-valuemax={MAX_FADE_SEC}
          aria-valuenow={Number(audio.fadeIn.toFixed(2))}
          aria-valuetext={`${audio.fadeIn.toFixed(1)} seconds`}
          data-testid="fade-in-handle"
          onPointerDown={(e) => startDrag(e, "fadeIn")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={(e) => onFadeKey(e, "fadeIn")}
          className="absolute top-0.5 w-2.5 h-2.5 -ml-1 rounded-full bg-white border border-[var(--color-accent)] cursor-ew-resize touch-none focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          style={{ left: clipLeft + fadeInPx }}
        />
        <button
          type="button"
          role="slider"
          aria-label="Fade out"
          aria-valuemin={0}
          aria-valuemax={MAX_FADE_SEC}
          aria-valuenow={Number(audio.fadeOut.toFixed(2))}
          aria-valuetext={`${audio.fadeOut.toFixed(1)} seconds`}
          data-testid="fade-out-handle"
          onPointerDown={(e) => startDrag(e, "fadeOut")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={(e) => onFadeKey(e, "fadeOut")}
          className="absolute top-0.5 w-2.5 h-2.5 -ml-1 rounded-full bg-white border border-[var(--color-accent)] cursor-ew-resize touch-none focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          style={{ left: Math.max(0, (total - audio.fadeOut) * pxPerSecond) }}
        />
      </div>
    </div>
  );
};

interface MusicControlsProps {
  onRemove: () => void;
}

/** Volume slider and remove button shown in the timeline toolbar while a track exists. */
export const MusicControls: React.FC<MusicControlsProps> = ({ onRemove }) => {
  const audio = useEditorStore((s) => s.doc.audio);
  const updateMusic = useEditorStore((s) => s.updateMusic);
  const begin = useEditorStore((s) => s.begin);
  const end = useEditorStore((s) => s.end);
  if (!audio) return null;

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-2)]">
      <Icon icon={Music2} size={12} className="text-[var(--color-accent)]" />
      <label className="flex items-center gap-1">
        <span>Volume</span>
        <input
          type="range"
          aria-label="Music volume"
          min={0}
          max={1}
          step={0.01}
          value={audio.volume}
          onPointerDown={begin}
          onPointerUp={end}
          onKeyUp={end}
          onChange={(e) => updateMusic({ volume: Number(e.target.value) })}
          className="w-20 accent-[var(--color-accent)]"
        />
        <span className="font-mono w-7 text-right">{Math.round(audio.volume * 100)}%</span>
      </label>
      <Tooltip content="Remove music">
        <button
          type="button"
          aria-label="Remove music"
          onClick={onRemove}
          className="p-1 rounded text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]"
        >
          <Icon icon={X} size={12} />
        </button>
      </Tooltip>
    </div>
  );
};
