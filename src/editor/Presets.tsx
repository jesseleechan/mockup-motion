import { useEffect, useRef, useState } from "react";
import { Star, BookmarkPlus, Trash2 } from "lucide-react";
import type { Preset, UploadedImage } from "../types";
import { PRESETS } from "../presets/presets";
import { renderScene } from "../rendering/renderer";
let samplePromise: Promise<UploadedImage[]> | undefined;
function samples() {
  return (samplePromise ??= (async () => {
    const { loadDefaultDesktopImages, loadDefaultMobileImages } =
      await import("../utils/sampleImages");
    const [desktop, mobile] = await Promise.all([
      loadDefaultDesktopImages(),
      loadDefaultMobileImages(),
    ]);
    const imageElement = new Image();
    imageElement.src = "/demo/aurelia.png";
    try {
      await imageElement.decode();
      desktop[0] = {
        ...desktop[0],
        url: imageElement.src,
        imageElement,
        width: imageElement.width,
        height: imageElement.height,
        aspectRatio: imageElement.width / imageElement.height,
      };
    } catch {}
    return [...desktop, ...mobile];
  })());
}
function PresetThumbnail({
  preset,
  images,
}: {
  preset: Preset;
  images: UploadedImage[];
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    animation = useRef(0);
  const render = (time: number) => {
    const ctx = ref.current?.getContext("2d");
    if (ctx)
      renderScene({
        ctx,
        width: 300,
        height: 240,
        time,
        composition: preset.composition,
        images,
      });
  };
  useEffect(() => {
    render(0);
    return () => cancelAnimationFrame(animation.current);
  }, [preset, images]);
  const animate = () => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    const loop = (now: number) => {
      render(((now - start) / 1000) % preset.composition.motion.duration);
      animation.current = requestAnimationFrame(loop);
    };
    animation.current = requestAnimationFrame(loop);
  };
  const stop = () => {
    cancelAnimationFrame(animation.current);
    render(0);
  };
  return (
    <canvas
      ref={ref}
      width={300}
      height={240}
      aria-hidden="true"
      onMouseEnter={animate}
      onMouseLeave={stop}
    />
  );
}
export function PresetsPanel({
  selectedId,
  onApply,
  custom,
  favorites,
  onFavorite,
  onSave,
  onDelete,
}: {
  selectedId: string;
  onApply: (p: Preset) => void;
  custom: Preset[];
  favorites: string[];
  onFavorite: (id: string) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}) {
  const [images, setImages] = useState<UploadedImage[]>([]),
    [filter, setFilter] = useState<"all" | "favorites">("all");
  useEffect(() => {
    let live = true;
    samples().then((i) => {
      if (live) setImages(i);
    });
    return () => {
      live = false;
    };
  }, []);
  const presets = [...PRESETS, ...custom].filter(
    (p) => filter === "all" || favorites.includes(p.id),
  );
  return (
    <div className="presets-panel">
      <div className="library-heading">
        <h2>Find your look</h2>
        <p>A good starting point. Make it yours.</p>
      </div>
      <div className="preset-filters">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All presets
        </button>
        <button
          className={filter === "favorites" ? "active" : ""}
          onClick={() => setFilter("favorites")}
        >
          <Star size={12} />
          Favorites
        </button>
      </div>
      <div className="preset-grid">
        {presets.map((p) => (
          <div
            className={`preset-card ${p.id === selectedId ? "selected" : ""}`}
            key={p.id}
          >
            <button
              className="preset-main"
              onClick={() => onApply(p)}
              aria-label={`Apply ${p.name}`}
              aria-pressed={p.id === selectedId}
              title={p.description}
            >
              <PresetThumbnail preset={p} images={images} />
              <span>{p.name}</span>
            </button>
            <button
              className={`favorite-button ${favorites.includes(p.id) ? "active" : ""}`}
              aria-label={`${favorites.includes(p.id) ? "Unfavorite" : "Favorite"} ${p.name}`}
              onClick={() => onFavorite(p.id)}
            >
              <Star
                size={12}
                fill={favorites.includes(p.id) ? "currentColor" : "none"}
              />
            </button>
            {p.custom && (
              <button
                className="delete-preset"
                aria-label={`Delete ${p.name} preset`}
                onClick={() => onDelete(p.id)}
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        ))}
      </div>
      {!presets.length && (
        <p className="empty-favorites">Star a preset to find it here.</p>
      )}
      <button className="save-preset" onClick={onSave}>
        <BookmarkPlus size={16} />
        Save as preset
      </button>
    </div>
  );
}
