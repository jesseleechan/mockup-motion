import React, { useEffect, useRef } from "react";
import type { ProjectDoc } from "../../doc/types";
import { schedule } from "../../motion";
import { useUIStore } from "../../state/ui-store";
import { type AssetProvider, Engine } from "../Engine";

export interface EngineCanvasProps {
  doc: ProjectDoc;
  assets: AssetProvider;
  time?: number;
  onEngineReady?: (engine: Engine) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const EngineCanvas: React.FC<EngineCanvasProps> = ({
  doc,
  assets,
  time,
  onEngineReady,
  className,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);

  const playhead = useUIStore((s) => s.playhead);
  const playing = useUIStore((s) => s.playing);
  const setPlayhead = useUIStore((s) => s.setPlayhead);

  // Initialize engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let localEngine: Engine | null = null;

    async function init() {
      if (!canvas) return;
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const width = Math.max(100, Math.round((canvas.clientWidth || 800) * dpr));
      const height = Math.max(100, Math.round((canvas.clientHeight || 450) * dpr));

      localEngine = await Engine.create(canvas, {
        width,
        height,
        supersample: 1.5,
      });

      if (disposed) {
        localEngine.dispose();
        return;
      }

      await localEngine.setDocument(doc, assets);
      const currentTime = time ?? playhead;
      localEngine.renderAt(currentTime);

      engineRef.current = localEngine;
      onEngineReady?.(localEngine);
    }

    init();

    return () => {
      disposed = true;
      if (localEngine) {
        localEngine.dispose();
      }
      engineRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const width = Math.max(10, Math.round(entry.contentRect.width * dpr));
      const height = Math.max(10, Math.round(entry.contentRect.height * dpr));

      if (engineRef.current) {
        engineRef.current.resize(width, height);
        const currentTime = time ?? playhead;
        engineRef.current.renderAt(currentTime);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [playhead, time]);

  // Update doc & assets
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setDocument(doc, assets).then(() => {
        const currentTime = time ?? playhead;
        engineRef.current?.renderAt(currentTime);
      });
    }
  }, [doc, assets, playhead, time]);

  // Playhead & animation loop
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (!playing) {
      // Paused: restore full quality and render at current time
      engine.setSupersample(1.5);
      const currentTime = time ?? playhead;
      engine.renderAt(currentTime);
      return;
    }

    let rafId: number;
    let lastTime = performance.now();
    let slowFramesCount = 0;
    let isDegraded = false;

    const { total } = schedule(doc);

    function loop(now: number) {
      const deltaSec = (now - lastTime) / 1000;
      const frameDurationMs = now - lastTime;
      lastTime = now;

      // Adaptive quality: drop supersample if average frame time > 20ms for 30 frames
      if (frameDurationMs > 20) {
        slowFramesCount++;
        if (slowFramesCount >= 30 && !isDegraded) {
          isDegraded = true;
          engine?.setSupersample(1);
        }
      } else {
        slowFramesCount = Math.max(0, slowFramesCount - 1);
      }

      // Advance playhead
      const nextTime = total > 0 ? (playhead + deltaSec) % total : 0;
      setPlayhead(nextTime);
      engine?.renderAt(nextTime);

      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [playing, doc, playhead, time, setPlayhead]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className ?? ""}`}
      style={style}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
