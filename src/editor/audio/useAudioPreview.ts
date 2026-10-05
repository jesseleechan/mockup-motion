import { useEffect, useMemo, useRef } from "react";
import { AudioPreview } from "../../audio/preview";
import { schedule } from "../../motion";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { getBlob } from "../../storage/blobs";

/** Gap (seconds) between the audio clock and the playhead that triggers a re-sync while playing. */
const RESYNC_THRESHOLD_SEC = 0.1;

declare global {
  interface Window {
    /** Dev/test hook: audio clock position vs the playhead. */
    __mmAudio?: {
      position: () => number | null;
      playhead: () => number;
      drift: () => number | null;
      loaded: () => boolean;
    };
  }
}

/**
 * Plays the project's music track in sync with the playhead. Audio only
 * sounds while `playing` is true, so scrubbing and stepping are silent.
 */
export function useAudioPreview(): void {
  const doc = useEditorStore((s) => s.doc);
  const playing = useUIStore((s) => s.playing);
  const track = doc.audio;
  const assetId = track?.assetId ?? null;
  const total = useMemo(() => schedule(doc).total, [doc]);

  const previewRef = useRef<AudioPreview | null>(null);
  const loadedIdRef = useRef<string | null>(null);

  // Create the preview once, on mount (before the effects below run).
  useEffect(() => {
    previewRef.current ??= new AudioPreview();
  }, []);

  // Load / unload the decoded buffer when the track's asset changes.
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    if (!assetId) {
      preview.clear();
      loadedIdRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      const blob = await getBlob(assetId);
      if (!blob || cancelled) return;
      try {
        await preview.load(blob);
        if (cancelled) return;
        loadedIdRef.current = assetId;
        if (useUIStore.getState().playing && track) {
          preview.start(track, total, useUIStore.getState().playhead);
        }
      } catch {
        loadedIdRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
    // `track` and `total` are re-applied by the sync effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  // Start / stop / restart on play state or any envelope-affecting edit.
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    if (playing && track && preview.loaded) {
      preview.start(track, total, useUIStore.getState().playhead);
    } else {
      preview.stop();
    }
  }, [playing, track, total]);

  // Re-sync after seeks and loop wraps while playing.
  useEffect(() => {
    const unsubscribe = useUIStore.subscribe((state, prev) => {
      const preview = previewRef.current;
      if (!preview || !state.playing || !prev.playing || state.playhead === prev.playhead) return;
      const current = useEditorStore.getState().doc;
      if (!current.audio || !preview.loaded) return;
      const pos = preview.position();
      if (pos === null || Math.abs(pos - state.playhead) > RESYNC_THRESHOLD_SEC) {
        preview.start(current.audio, schedule(current).total, state.playhead);
      }
    });
    return unsubscribe;
  }, []);

  // Test hook
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__mmAudio = {
      position: () => previewRef.current?.position() ?? null,
      playhead: () => useUIStore.getState().playhead,
      drift: () => {
        const pos = previewRef.current?.position();
        return pos == null ? null : pos - useUIStore.getState().playhead;
      },
      loaded: () => previewRef.current?.loaded ?? false,
    };
    return () => {
      delete window.__mmAudio;
    };
  }, []);

  // Release the audio context on unmount.
  useEffect(() => {
    const preview = previewRef.current;
    return () => preview?.dispose();
  }, []);
}
