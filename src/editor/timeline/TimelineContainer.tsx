import React, { useRef } from "react";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { defaultShot } from "../../doc/defaults";
import { schedule } from "../../motion";
import { Icon, Tooltip } from "../../ui";
import {
  Copy,
  Laptop,
  Monitor,
  Plus,
  Smartphone,
  Tablet,
  Trash2,
  Type,
} from "lucide-react";

export const TimelineContainer: React.FC = () => {
  const doc = useEditorStore((s) => s.doc);
  const apply = useEditorStore((s) => s.apply);

  const selection = useUIStore((s) => s.selection);
  const playhead = useUIStore((s) => s.playhead);
  const setSelection = useUIStore((s) => s.setSelection);
  const setPlayhead = useUIStore((s) => s.setPlayhead);
  const setPlaying = useUIStore((s) => s.setPlaying);

  const scrubberRef = useRef<HTMLDivElement>(null);
  const { total, shots } = schedule(doc);

  const handleScrubberMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setPlaying(false);
    updatePlayheadFromMouse(e);

    const onMouseMove = (moveEvent: MouseEvent) => {
      updatePlayheadFromMouse(moveEvent);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const updatePlayheadFromMouse = (e: MouseEvent | React.MouseEvent) => {
    const rect = scrubberRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const clickX = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, clickX / rect.width));
    const nextTime = progress * total;
    setPlayhead(nextTime);
  };

  const handleAddShot = () => {
    const newS = defaultShot();
    apply(
      (draft) => {
        draft.shots.push(newS);
      },
      { label: "Add shot" },
    );
    setSelection({ kind: "shot", id: newS.id });
  };

  const handleDuplicateShot = (e: React.MouseEvent, shotId: string) => {
    e.stopPropagation();
    const shotToDup = doc.shots.find((s) => s.id === shotId);
    if (!shotToDup) return;
    const copy = {
      ...structuredClone(shotToDup),
      id: crypto.randomUUID(),
    };
    apply(
      (draft) => {
        const idx = draft.shots.findIndex((s) => s.id === shotId);
        draft.shots.splice(idx + 1, 0, copy);
      },
      { label: "Duplicate shot" },
    );
    setSelection({ kind: "shot", id: copy.id });
  };

  const handleDeleteShot = (e: React.MouseEvent, shotId: string) => {
    e.stopPropagation();
    if (doc.shots.length <= 1) {
      alert("A project must have at least one shot.");
      return;
    }
    apply(
      (draft) => {
        draft.shots = draft.shots.filter((s) => s.id !== shotId);
      },
      { label: "Delete shot" },
    );
    setSelection({ kind: "video" });
  };

  const playheadPercent = total > 0 ? (playhead / total) * 100 : 0;

  return (
    <div className="h-[148px] bg-[var(--color-panel)] border-t border-[var(--color-line)] flex flex-col select-none shrink-0 z-20">
      {/* Scrubber Area */}
      <div
        ref={scrubberRef}
        onMouseDown={handleScrubberMouseDown}
        className="relative h-6 bg-[var(--color-raised)] border-b border-[var(--color-line)] cursor-pointer select-none overflow-hidden"
      >
        {/* Shot markers along the scrubber */}
        <div className="absolute inset-0 flex">
          {shots.map((item, idx) => {
            const shotDuration = item.end - item.start;
            const widthPct = total > 0 ? (shotDuration / total) * 100 : 0;
            const shotObj = doc.shots[item.index];
            return (
              <div
                key={shotObj?.id ?? idx}
                style={{ width: `${widthPct}%` }}
                className="h-full border-r border-[var(--color-line)] px-2 flex items-center justify-between text-[10px] text-[var(--color-text-3)] font-mono truncate"
              >
                <span>Shot {idx + 1}</span>
                <span>{shotDuration.toFixed(1)}s</span>
              </div>
            );
          })}
        </div>

        {/* Playhead Needle */}
        <div
          style={{ left: `${playheadPercent}%` }}
          className="absolute top-0 bottom-0 w-0.5 bg-[var(--color-accent)] z-20 pointer-events-none"
        >
          <div className="w-2.5 h-2.5 -ml-1 -top-0.5 bg-[var(--color-accent)] rotate-45 rounded-xs" />
        </div>
      </div>

      {/* Shot Cards Strip */}
      <div className="flex-1 p-3 flex items-center gap-3 overflow-x-auto">
        {doc.shots.map((shot, idx) => {
          const isSelected = selection.kind === "shot" && selection.id === shot.id;
          const layoutKind = shot.layout.kind;
          const device = shot.layout.kind === "single" ? shot.layout.device : null;

          return (
            <div
              key={shot.id}
              onClick={() => setSelection({ kind: "shot", id: shot.id })}
              className={`group relative h-full min-w-[140px] max-w-[180px] p-2 rounded-lg border flex flex-col justify-between cursor-pointer transition-all ${
                isSelected
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]/20 shadow-xs"
                  : "border-[var(--color-line)] bg-[var(--color-raised)] hover:border-[var(--color-line-strong)]"
              }`}
            >
              {/* Header: Shot index & device icon */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--color-text)]">
                    Shot {idx + 1}
                  </span>
                  <div className="text-[var(--color-text-3)]">
                    {layoutKind === "title" && <Icon icon={Type} size={12} />}
                    {device === "browser" && <Icon icon={Monitor} size={12} />}
                    {device === "phone" && <Icon icon={Smartphone} size={12} />}
                    {device === "laptop" && <Icon icon={Laptop} size={12} />}
                    {device === "tablet" && <Icon icon={Tablet} size={12} />}
                  </div>
                </div>

                {/* Quick actions on hover */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                  <Tooltip content="Duplicate shot">
                    <button
                      type="button"
                      aria-label="Duplicate shot"
                      onClick={(e) => handleDuplicateShot(e, shot.id)}
                      className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-text)] rounded hover:bg-[var(--color-hover)]"
                    >
                      <Icon icon={Copy} size={11} />
                    </button>
                  </Tooltip>
                  {doc.shots.length > 1 && (
                    <Tooltip content="Delete shot">
                      <button
                        type="button"
                        aria-label="Delete shot"
                        onClick={(e) => handleDeleteShot(e, shot.id)}
                        className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-danger)] rounded hover:bg-[var(--color-hover)]"
                      >
                        <Icon icon={Trash2} size={11} />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Shot summary */}
              <div className="text-[10px] text-[var(--color-text-2)] font-mono capitalize truncate">
                {layoutKind === "title" ? "Title Card" : `${device || "Device"} · ${shot.camera.preset}`}
              </div>

              {/* Footer: Duration */}
              <div className="flex items-center justify-between text-[10px] text-[var(--color-text-3)] font-mono">
                <span>{shot.duration.toFixed(1)}s</span>
                {shot.texts.length > 0 && (
                  <span>{shot.texts.length} text{shot.texts.length > 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Shot Button */}
        <button
          type="button"
          onClick={handleAddShot}
          className="h-full min-w-[100px] border border-dashed border-[var(--color-line)] hover:border-[var(--color-accent)] rounded-lg flex flex-col items-center justify-center gap-1.5 text-[var(--color-text-3)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]/10 transition-all focus:outline-none"
        >
          <Icon icon={Plus} size={16} />
          <span className="text-[11px] font-medium">Add Shot</span>
        </button>
      </div>
    </div>
  );
};
