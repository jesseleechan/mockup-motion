import React from "react";
import type { Aspect, Shot } from "../../../doc/types";
import { framesAssetIds, isPacedShot, paceLimited, paceOf, type Pace } from "../../../motion";
import { useEditorStore } from "../../../state/store";
import { Section, SegmentedControl } from "../../../ui";

const PACE_LABELS: Record<Pace, string> = { calm: "Calm", default: "Default", brisk: "Brisk" };

/**
 * Calm, Default or Brisk for a slider, stack, orbit, Site Tour, Frames or Responsive Scroll shot
 * (src/motion/pace.ts). A pace a limit makes equal to Default is unavailable, with the reason on
 * hover and focus. One click is one undo step.
 */
export const PaceSection: React.FC<{ shot: Shot; aspect: Aspect }> = ({ shot, aspect }) => {
  const index = useEditorStore((s) => s.doc.shots.findIndex((c) => c.id === shot.id));
  const setShotPace = useEditorStore((s) => s.setShotPace);
  if (!isPacedShot(shot)) return null;

  const current = paceOf(shot);
  const limited = paceLimited(shot, aspect);
  const { layout } = shot;
  const shown =
    layout.kind === "rows" || layout.kind === "columns"
      ? framesAssetIds(layout, aspect).length
      : null;

  return (
    <Section title="Pace">
      <SegmentedControl<Pace>
        aria-label="Pace"
        className="flex w-full [&>button]:flex-1"
        value={current}
        onChange={(pace) => {
          if (index >= 0 && pace !== current) setShotPace(index, pace);
        }}
        options={(["calm", "default", "brisk"] as const).map((pace) => ({
          value: pace,
          label: PACE_LABELS[pace],
          // The current pace stays available even when a limit makes it equal Default.
          reason: pace !== "default" && pace !== current ? limited[pace] : undefined,
        }))}
      />
      {shown !== null && "assetIds" in layout && shown < layout.assetIds.length && (
        <p className="text-[11px] leading-4 text-text-2">
          Shows the first {shown} screenshots, so the loop fits in 30 s.
        </p>
      )}
    </Section>
  );
};
