import React, { useEffect, useRef, useSyncExternalStore } from "react";
import { templatePosterUrl, templateVideoUrl } from "./template-media";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export interface TemplatePreviewProps {
  templateId: string;
  /** Plays while true (the card is hovered or focused); pauses and resets when false. */
  active: boolean;
  className?: string;
}

/**
 * A template's rendered preview (`npm run template-previews`): the poster at rest, the
 * looping video while active. The video downloads only on first play. Under
 * prefers-reduced-motion it shows the poster only.
 */
export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  templateId,
  active,
  className,
}) => {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      video.play().catch((err: unknown) => {
        // Leaving before playback starts aborts play(); that is the expected outcome.
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(`[TemplatePreview] ${templateId} failed to play`, err);
      });
    } else if (!video.paused || video.currentTime > 0) {
      video.pause();
      // load() rewinds and shows the poster again; with preload="none" it fetches nothing.
      video.load();
    }
  }, [active, templateId]);

  if (reducedMotion) {
    return (
      <img
        src={templatePosterUrl(templateId)}
        alt=""
        draggable={false}
        data-testid="template-poster"
        className={className}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={templateVideoUrl(templateId)}
      poster={templatePosterUrl(templateId)}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      data-testid="template-video"
      className={className}
    />
  );
};
