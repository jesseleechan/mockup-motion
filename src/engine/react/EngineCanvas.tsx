import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ProjectDoc } from "../../doc/types";
import { schedule } from "../../motion";
import { useUIStore } from "../../state/ui-store";
import { type AssetProvider, Engine } from "../Engine";

export interface EngineCanvasProps {
  doc: ProjectDoc;
  assets: AssetProvider;
  time?: number;
  onEngineReady?: (engine: Engine) => void;
  onCanvasClick?: (
    e: React.MouseEvent<HTMLCanvasElement>,
    pickResult: { nodeId: string; u: number; v: number } | null,
  ) => void;
  className?: string;
  style?: React.CSSProperties;
  /** Override device pixel ratio. Visual stills pass 1. */
  pixelRatio?: number;
  /** Override the default 1.5 preview supersample. */
  supersample?: 1 | 1.5 | 2;
  /** Isolated lab fixtures only; does not change CameraMove or saved projects. */
  cameraDistanceOverride?: number;
}

const DEFAULT_SUPERSAMPLE = 1.5;
// A 3× display would otherwise allocate 9× the pixels before the 1.5× supersample.
const MAX_PIXEL_RATIO = 2;
// The canvas renders every frame; the store (transport, timeline) only needs ~30 Hz.
const STORE_WRITE_INTERVAL_MS = 33;
// Adaptive quality: after this many frames slower than SLOW_FRAME_MS, drop supersample to 1.
const SLOW_FRAME_MS = 20;
const SLOW_FRAME_LIMIT = 30;

function resolvePixelRatio(override: number | undefined): number {
  if (override !== undefined) return override;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.min(dpr, MAX_PIXEL_RATIO);
}

function devicePixels(cssPx: number, pixelRatio: number): number {
  return Math.max(1, Math.round(cssPx * pixelRatio));
}

/**
 * Thin preview wrapper around Engine. The document effect depends on the
 * document and assets only; playback and scrubbing call renderAt directly and
 * never call setDocument.
 */
export const EngineCanvas: React.FC<EngineCanvasProps> = ({
  doc,
  assets,
  time,
  onEngineReady,
  onCanvasClick,
  className,
  style,
  pixelRatio,
  supersample,
  cameraDistanceOverride,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const playing = useUIStore((s) => s.playing);

  // Latest values for callbacks that run outside React's render cycle.
  const docRef = useRef(doc);
  const timeRef = useRef(time);
  const onEngineReadyRef = useRef(onEngineReady);
  const supersampleRef = useRef(supersample ?? DEFAULT_SUPERSAMPLE);
  const playheadRef = useRef(time ?? useUIStore.getState().playhead);
  const lastWrittenRef = useRef<number | null>(null);
  const readyReportedRef = useRef(false);

  useLayoutEffect(() => {
    docRef.current = doc;
    onEngineReadyRef.current = onEngineReady;
    supersampleRef.current = supersample ?? DEFAULT_SUPERSAMPLE;
  });

  // Init: create the engine once, at the container's measured size.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let disposed = false;
    let created: Engine | null = null;
    const ratio = resolvePixelRatio(pixelRatio);

    void Engine.create(canvas, {
      width: devicePixels(container.clientWidth || 800, ratio),
      height: devicePixels(container.clientHeight || 450, ratio),
      supersample: supersampleRef.current,
      cameraDistanceOverride,
    }).then((next) => {
      if (disposed) {
        next.dispose();
        return;
      }
      created = next;
      setEngine(next);
    });

    return () => {
      disposed = true;
      created?.dispose();
      setEngine(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize: follow the container; never depends on the playhead.
  useEffect(() => {
    const container = containerRef.current;
    if (!engine || !container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      // A hidden container (display: none) reports 0×0; keep the last real size.
      if (width === 0 || height === 0) return;
      const ratio = resolvePixelRatio(pixelRatio);
      engine.resize(devicePixels(width, ratio), devicePixels(height, ratio));
      engine.renderAt(playheadRef.current);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [engine, pixelRatio]);

  // Document: [doc, assets] only. Engine.setDocument's generation guard drops superseded loads.
  useEffect(() => {
    if (!engine) return;
    let cancelled = false;
    void engine.setDocument(doc, assets).then(() => {
      if (cancelled) return;
      engine.renderAt(playheadRef.current);
      if (!readyReportedRef.current) {
        readyReportedRef.current = true;
        onEngineReadyRef.current?.(engine);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [engine, doc, assets]);

  // Controlled time (lab stills and the lab scrubber).
  useEffect(() => {
    timeRef.current = time;
    if (time === undefined) return;
    playheadRef.current = time;
    engine?.renderAt(time);
  }, [engine, time]);

  // Paused rendering: follow store playhead changes outside React's render cycle.
  useEffect(() => {
    if (!engine) return;
    return useUIStore.subscribe((state, prev) => {
      if (state.playhead === prev.playhead) return;
      if (state.playing) {
        // A seek from the timeline during playback moves the playback clock.
        if (state.playhead !== lastWrittenRef.current) playheadRef.current = state.playhead;
        return;
      }
      if (timeRef.current !== undefined) return;
      playheadRef.current = state.playhead;
      engine.renderAt(state.playhead);
    });
  }, [engine]);

  // Playback: one requestAnimationFrame loop per play, keyed on `playing`.
  useEffect(() => {
    if (!engine || !playing) return;

    const writePlayhead = (value: number) => {
      lastWrittenRef.current = value;
      useUIStore.getState().setPlayhead(value);
    };

    // Play at the end of a non-looping document starts over.
    if (playheadRef.current >= schedule(docRef.current).total) playheadRef.current = 0;

    let rafId = 0;
    let lastNow: number | null = null;
    let lastWriteNow = -Infinity;
    let slowFrames = 0;
    let degraded = false;

    const tick = (now: number) => {
      const frameMs = lastNow === null ? 0 : now - lastNow;
      lastNow = now;

      const currentDoc = docRef.current;
      const { total } = schedule(currentDoc);
      let t = playheadRef.current + frameMs / 1000;
      let ended = false;
      if (t >= total) {
        if (currentDoc.loop && total > 0) {
          t %= total;
        } else {
          t = total;
          ended = true;
        }
      }
      playheadRef.current = t;
      engine.renderAt(t);

      if (frameMs > SLOW_FRAME_MS) {
        slowFrames++;
        if (slowFrames >= SLOW_FRAME_LIMIT && !degraded) {
          degraded = true;
          engine.setSupersample(1);
        }
      } else {
        slowFrames = Math.max(0, slowFrames - 1);
      }

      if (ended) {
        writePlayhead(t);
        useUIStore.getState().setPlaying(false);
        return;
      }
      if (now - lastWriteNow >= STORE_WRITE_INTERVAL_MS) {
        lastWriteNow = now;
        writePlayhead(t);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      if (degraded) engine.setSupersample(supersampleRef.current);
      writePlayhead(playheadRef.current);
      engine.renderAt(playheadRef.current);
    };
  }, [engine, playing]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!onCanvasClick || !canvas || !engine) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    onCanvasClick(e, engine.pick(x, y));
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className ?? ""}`}
      style={style}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="w-full h-full block cursor-crosshair"
      />
    </div>
  );
};
