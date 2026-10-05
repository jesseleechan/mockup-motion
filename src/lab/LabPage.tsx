import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Aspect, ProjectDoc } from "../doc/types";
import { EngineCanvas } from "../engine/react/EngineCanvas";
import type { AssetProvider, Engine } from "../engine/Engine";
import { exportWithEngine } from "../export/engine-export";
import { schedule } from "../motion";
import { useUIStore } from "../state/ui-store";
import { createLabAssetProvider } from "./asset-provider";
import type { labTestImages } from "./test-images";

type LabTestImages = typeof labTestImages;

// Fixtures
import cardHeroFixture from "./fixtures/card-hero.json";
import cardScrollFixture from "./fixtures/card-scroll.json";
import orbitLoopFixture from "./fixtures/orbit-loop.json";
import devicesBrowserFixture from "./fixtures/devices-browser.json";
import devicesPhoneFixture from "./fixtures/devices-phone.json";
import devicesTabletFixture from "./fixtures/devices-tablet.json";
import devicesLaptopFixture from "./fixtures/devices-laptop.json";
import textTitleFixture from "./fixtures/text-title.json";

import { BUILTIN_TEMPLATES, buildTemplatePreviewDoc } from "../templates";
import { VISUAL_FIXTURES } from "./visual-fixtures";

declare global {
  interface Window {
    __labReady?: boolean;
    __labError?: string;
    __labEngine?: Engine;
    __exportWithEngine?: typeof exportWithEngine;
    __createLabAssetProvider?: typeof createLabAssetProvider;
    __fixtures?: Record<string, ProjectDoc>;
    __labTestImages?: LabTestImages;
    __labSetDoc?: (doc: ProjectDoc, images?: Record<string, ImageBitmap>) => Promise<void>;
  }
}

const FIXTURES: Record<string, ProjectDoc> = {
  "card-hero": cardHeroFixture as unknown as ProjectDoc,
  "card-scroll": cardScrollFixture as unknown as ProjectDoc,
  "orbit-loop": orbitLoopFixture as unknown as ProjectDoc,
  "devices-browser": devicesBrowserFixture as unknown as ProjectDoc,
  "devices-phone": devicesPhoneFixture as unknown as ProjectDoc,
  "devices-tablet": devicesTabletFixture as unknown as ProjectDoc,
  "devices-laptop": devicesLaptopFixture as unknown as ProjectDoc,
  "text-title": textTitleFixture as unknown as ProjectDoc,
};

// Register all 12 built-in templates into fixtures
for (const t of BUILTIN_TEMPLATES) {
  const pDoc = buildTemplatePreviewDoc(t);
  FIXTURES[`template-${t.id}`] = pDoc;
  FIXTURES[t.id] = pDoc;
}
Object.assign(FIXTURES, VISUAL_FIXTURES);

function aspectRatioOf(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 16 / 9;
    case "9:16":
      return 9 / 16;
    case "4:5":
      return 4 / 5;
    case "4:3":
      return 4 / 3;
    default:
      return 1;
  }
}

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];

export const LabPage: React.FC = () => {
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const initialFixture = urlParams.get("fixture") ?? "card-hero";
  const initialAspect = (urlParams.get("aspect") as Aspect) ?? "16:9";
  const initialTime = urlParams.get("t") ? parseFloat(urlParams.get("t")!) : 0;

  const [selectedFixture, setSelectedFixture] = useState(initialFixture);
  const [aspect, setAspect] = useState<Aspect>(initialAspect);
  const doc = useMemo<ProjectDoc>(() => {
    const base = FIXTURES[selectedFixture] ?? FIXTURES["card-hero"];
    return { ...base, aspect };
  }, [selectedFixture, aspect]);

  const [time, setTime] = useState(initialTime);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const [engineInfo, setEngineInfo] = useState<{
    drawCalls: number;
    maxTextureSize: number;
    renderer: string;
    frameMs: number;
  }>({
    drawCalls: 0,
    maxTextureSize: 0,
    renderer: "",
    frameMs: 0,
  });

  const engineRef = useRef<Engine | null>(null);
  const provider = useMemo(() => createLabAssetProvider(), []);

  const playhead = useUIStore((s) => s.playhead);
  const playing = useUIStore((s) => s.playing);
  const setPlaying = useUIStore((s) => s.setPlaying);
  const setPlayhead = useUIStore((s) => s.setPlayhead);

  const { total: docDuration } = useMemo(() => schedule(doc), [doc]);

  const handleEngineReady = useCallback(
    (engine: Engine) => {
      engineRef.current = engine;
      window.__labEngine = engine;

      const info = engine.info;
      setEngineInfo({
        drawCalls: info.drawCalls,
        maxTextureSize: info.maxTextureSize,
        renderer: info.renderer,
        frameMs: 0,
      });

      window.__exportWithEngine = exportWithEngine;
      window.__createLabAssetProvider = createLabAssetProvider;
      window.__fixtures = FIXTURES;
      window.__labReady = false;
      if (import.meta.env.DEV) {
        window.__labSetDoc = async (nextDoc, images = {}, providerOverride?: AssetProvider) => {
          const testProvider: AssetProvider = providerOverride ?? {
            async getImage(assetId: string, maxWidth: number) {
              return images[assetId] ?? provider.getImage(assetId, maxWidth);
            },
            getText: provider.getText.bind(provider),
            getAudio: provider.getAudio?.bind(provider),
          };
          await engine.setDocument(nextDoc, testProvider);
          engine.renderAt(0);
        };
      }
      void (async () => {
        try {
          await document.fonts?.ready;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          window.__labError = `Font readiness failed: ${message}`;
          console.error(window.__labError, error);
          throw new Error(window.__labError, { cause: error });
        }
        if (import.meta.env.DEV) {
          const { labTestImages } = await import("./test-images");
          window.__labTestImages = labTestImages;
        }
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        window.__labReady = true;
      })();
    },
    [provider],
  );

  // Frame readout loop for stats
  useEffect(() => {
    let animId: number;
    function poll() {
      if (engineRef.current) {
        const info = engineRef.current.info;
        setEngineInfo((prev) => ({
          ...prev,
          drawCalls: info.drawCalls,
          maxTextureSize: info.maxTextureSize,
          renderer: info.renderer,
        }));
      }
      animId = requestAnimationFrame(poll);
    }
    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Step frame (+1 / -1 frame)
  const stepFrame = (deltaFrames: number) => {
    setPlaying(false);
    const fps = doc.export.fps || 30;
    const dt = deltaFrames / fps;
    const newT = Math.max(0, Math.min(docDuration, playhead + dt));
    setPlayhead(newT);
    setTime(newT);
  };

  const handleExport1080p = async () => {
    if (exporting) return;
    setExporting(true);
    setExportProgress(0);

    try {
      const res = await exportWithEngine(
        doc,
        provider,
        { ...doc.export, resolution: 1080 },
        undefined,
        (p) => setExportProgress(p.percentage),
      );
      const url = URL.createObjectURL(res.blob);
      setExportUrl(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert(`Export failed: ${err}`);
    } finally {
      setExporting(false);
    }
  };

  // Aspect ratio style for preview canvas
  const canvasAspectStyle = useMemo(() => {
    switch (aspect) {
      case "16:9":
        return { aspectRatio: "16 / 9" };
      case "9:16":
        return { aspectRatio: "9 / 16" };
      case "1:1":
        return { aspectRatio: "1 / 1" };
      case "4:5":
        return { aspectRatio: "4 / 5" };
      case "4:3":
        return { aspectRatio: "4 / 3" };
    }
  }, [aspect]);

  const still = urlParams.get("still") === "1";
  const stillW = Number(urlParams.get("w")) || 640;
  const stillH = Math.max(1, Math.round(stillW / aspectRatioOf(aspect)));

  if (still) {
    return (
      <div data-testid="lab-still" style={{ width: stillW, height: stillH, background: "#000" }}>
        <EngineCanvas
          doc={doc}
          assets={provider}
          time={playing ? undefined : time}
          pixelRatio={1}
          supersample={1}
          onEngineReady={handleEngineReady}
          className="w-full h-full"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d0d0f] text-neutral-200 font-sans select-none overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-[#121214]">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white tracking-wide">MOCKUPMOTION</span>
          <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">
            /lab
          </span>
        </div>

        {/* Fixture Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-400">Fixture:</label>
          <select
            value={selectedFixture}
            onChange={(e) => setSelectedFixture(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 text-sm rounded px-2.5 py-1 text-white focus:outline-none"
          >
            {Object.keys(FIXTURES).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="flex items-center gap-1 bg-neutral-800/80 p-0.5 rounded border border-neutral-700">
          {ASPECTS.map((a) => (
            <button
              key={a}
              onClick={() => setAspect(a)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                aspect === a
                  ? "bg-neutral-600 text-white font-medium"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {/* Export Button */}
        <div className="flex items-center gap-2">
          {exportUrl && (
            <a
              href={exportUrl}
              download={`export-1080p.${doc.export.format}`}
              className="text-xs text-emerald-400 underline hover:text-emerald-300"
            >
              Download
            </a>
          )}
          <button
            onClick={handleExport1080p}
            disabled={exporting}
            className="px-3 py-1 bg-neutral-100 hover:bg-white text-black text-xs font-medium rounded transition-colors disabled:opacity-50"
          >
            {exporting ? `Exporting (${exportProgress}%)` : "Export 1080p"}
          </button>
        </div>
      </header>

      {/* Main Canvas Area */}
      <main className="flex-1 relative flex items-center justify-center p-6 bg-[#09090b] overflow-hidden">
        <div
          className="relative max-w-full max-h-full rounded shadow-2xl overflow-hidden border border-neutral-800"
          style={canvasAspectStyle}
        >
          <EngineCanvas
            doc={doc}
            assets={provider}
            time={playing ? undefined : time}
            onEngineReady={handleEngineReady}
            className="w-full h-full"
          />
        </div>

        {/* Engine Info HUD Panel */}
        <div className="absolute bottom-4 right-4 bg-black/75 backdrop-blur border border-neutral-800 rounded p-3 text-xs font-mono text-neutral-400 space-y-1 z-20 pointer-events-none">
          <div>
            Renderer: <span className="text-white">{engineInfo.renderer || "WebGL"}</span>
          </div>
          <div>
            Draw Calls: <span className="text-white">{engineInfo.drawCalls}</span>
          </div>
          <div>
            Max Texture: <span className="text-white">{engineInfo.maxTextureSize}px</span>
          </div>
        </div>
      </main>

      {/* Playback Controls & Timeline Scrubber */}
      <footer className="h-14 border-t border-neutral-800 bg-[#121214] px-4 flex items-center gap-4">
        {/* Play/Pause */}
        <button
          onClick={() => setPlaying(!playing)}
          className="w-8 h-8 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
        >
          {playing ? "⏸" : "▶"}
        </button>

        {/* Step Buttons */}
        <button
          onClick={() => stepFrame(-1)}
          className="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
          title="Step -1 frame"
        >
          -1f
        </button>
        <button
          onClick={() => stepFrame(1)}
          className="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
          title="Step +1 frame"
        >
          +1f
        </button>

        {/* Time Readout */}
        <span className="text-xs font-mono text-neutral-400 min-w-28">
          {(playing ? playhead : time).toFixed(2)}s / {docDuration.toFixed(2)}s
        </span>

        {/* Scrubber Slider */}
        <input
          type="range"
          min={0}
          max={docDuration || 1}
          step={0.01}
          value={playing ? playhead : time}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            setPlaying(false);
            setTime(val);
            setPlayhead(val);
          }}
          className="flex-1 accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
        />
      </footer>
    </div>
  );
};

export default LabPage;
