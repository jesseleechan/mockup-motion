import { useCallback, type DragEvent } from "react";
import type { Shot } from "../../../doc/types";
import { useEditorStore } from "../../../state/store";

type ApplyOptions = { label?: string; coalesceKey?: string };

/** Applies `mutate` to the draft of one shot; does nothing if the shot is gone. */
export function useShotUpdate(shotId: string) {
  const apply = useEditorStore((s) => s.apply);
  return useCallback(
    (mutate: (shot: Shot) => void, options?: ApplyOptions) => {
      apply((draft) => {
        const target = draft.shots.find((s) => s.id === shotId);
        if (target) mutate(target);
      }, options);
    },
    [apply, shotId],
  );
}

/** Accepts an asset dragged from the Media tab. */
export function assetDropProps(onAsset: (assetId: string) => void) {
  return {
    onDragOver: (e: DragEvent) => {
      if (e.dataTransfer.types.includes("application/x-mockup-asset-id")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    },
    onDrop: (e: DragEvent) => {
      const id = e.dataTransfer.getData("application/x-mockup-asset-id");
      if (id) {
        e.preventDefault();
        onAsset(id);
      }
    },
  };
}
