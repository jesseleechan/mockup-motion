import { useEffect, useMemo, useRef } from "react";
import { AudioPreview } from "../../audio/preview";
import { schedule } from "../../motion";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { getBlob } from "../../storage/blobs";

/** How often (seconds of audio clock) the music is compared with the playhead while playing. */
const SYNC_CHECK_SEC = 0.25;
/** Largest gap (seconds) between the music and the playhead before the music is re-anchored. */
const MAX_DRIFT_SEC = 0.03;
/** A gap this large is a seek or a loop wrap, not drift, so it re-anchors without waiting. */
const JUMP_SEC = 0.25;

declare global {
  interface Window {
    /** Dev/test hook: audio clock position vs the playhead. */
    __mmAudio?: {
      position: () => number | null;
      playhead: () => number;
      /** Music minus playhead at the latest frame, both at the same moment, or null when stopped. */
      drift: () => number | null;
      loaded: () => boolean;
    };
  }
}

/**
 * Seconds since the current frame began. The playback loop advances the playhead by
 * requestAnimationFrame timestamps, which mark the start of a frame, but the audio clock is
 * read when the callback runs, which after a long task can be 100 ms or more later. Adding
 * this lag compares the music with the playhead at the moment the audio clock is read. Outside
 * a frame (a timeline seek) it is the time since the last frame, where the playback loop's next
 * tick continues from. `document.timeline.currentTime` is the frame's rAF timestamp.
 */
function frameLag(): number {
  const frameTime = document.timeline.currentTime;
  if (typeof frameTime !== "number") return 0;
  return Math.max(0, (performance.now() - frameTime) / 1000);
}

/**
 * Plays the project's music track in sync with the playhead. The playback
 * loop publishes the playhead once per frame, before rendering it; the music
 * starts on the first frame after Play (so a slow first frame cannot leave it
 * running ahead of a still picture), and every later frame is compared with
 * the audio clock at the same moment (see frameLag): seeks and loop wraps
 * re-anchor at once, and drift over MAX_DRIFT_SEC re-anchors at the next
 * SYNC_CHECK_SEC check. Audio only sounds while `playing` is true; scrubbing
 * pauses playback, so it is silent.
 */
export function useAudioPreview(): void {
  const doc = useEditorStore((s) => s.doc);
  const playing = useUIStore((s) => s.playing);
  const track = doc.audio;
  const assetId = track?.assetId ?? null;
  const total = useMemo(() => schedule(doc).total, [doc]);

  const previewRef = useRef<AudioPreview | null>(null);
  // Audio clock time of the next drift check.
  const nextCheckRef = useRef(0);
  // Music minus playhead at the latest frame, after any re-anchor.
  const driftRef = useRef<number | null>(null);

  // Create the preview once, on mount (before the effects below run).
  useEffect(() => {
    previewRef.current ??= new AudioPreview();
  }, []);

  // Load / unload the decoded buffer when the track's asset changes. If playback is
  // running, the next frame starts the music.
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    if (!assetId) {
      preview.clear();
      return;
    }
    let cancelled = false;
    void (async () => {
      const blob = await getBlob(assetId);
      if (!blob || cancelled) return;
      await preview.load(blob);
    })().catch((error: unknown) => {
      console.error("The music preview could not be loaded:", error);
    });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  // Stop on pause or when the track is removed; restart on an envelope-affecting edit.
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const position = preview.position();
    if (playing && track && preview.loaded) {
      // Not started yet: the playback loop's next frame starts it.
      if (position === null) return;
      // An edit while playing continues from the audio clock; the store playhead lags
      // the rendered frame by up to one store write.
      preview.start(track, total, position);
    } else {
      preview.stop();
      driftRef.current = null;
    }
  }, [playing, track, total]);

  // Start on the first frame, then re-anchor on seeks, loop wraps and drift.
  useEffect(() => {
    return useUIStore.subscribe((state, prev) => {
      const preview = previewRef.current;
      // `prev.playing` skips the Play notification itself; frames come after it.
      if (!preview?.loaded || !state.playing || !prev.playing) return;
      const current = useEditorStore.getState().doc;
      if (!current.audio) return;
      const currentTotal = schedule(current).total;
      // The playhead now, when the audio clock is read, not when this frame began.
      const playhead = state.playhead + frameLag();

      const position = preview.position();
      if (position === null) {
        preview.start(current.audio, currentTotal, playhead);
        nextCheckRef.current = preview.clock + SYNC_CHECK_SEC;
        driftRef.current = 0;
        return;
      }
      if (state.playhead === prev.playhead) return;

      const gap = Math.abs(position - playhead);
      const due = preview.clock >= nextCheckRef.current;
      if (gap > JUMP_SEC || (due && gap > MAX_DRIFT_SEC)) {
        preview.start(current.audio, currentTotal, playhead);
      }
      if (due || gap > JUMP_SEC) nextCheckRef.current = preview.clock + SYNC_CHECK_SEC;

      const after = preview.position();
      driftRef.current = after === null ? null : after - playhead;
    });
  }, []);

  // Test hook
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__mmAudio = {
      position: () => previewRef.current?.position() ?? null,
      playhead: () => useUIStore.getState().playhead,
      drift: () => (previewRef.current?.position() == null ? null : driftRef.current),
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
