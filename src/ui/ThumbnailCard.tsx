import React from "react";
import clsx from "clsx";

export interface ThumbnailCardProps {
  title: string;
  imageSrc?: string;
  badge?: string;
  selected?: boolean;
  onClick?: () => void;
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3" | "4:5";
  className?: string;
}

export const ThumbnailCard: React.FC<ThumbnailCardProps> = ({
  title,
  imageSrc,
  badge,
  selected = false,
  onClick,
  aspectRatio = "16:9",
  className,
}) => {
  const aspectClass =
    aspectRatio === "16:9"
      ? "aspect-video"
      : aspectRatio === "9:16"
        ? "aspect-[9/16]"
        : aspectRatio === "1:1"
          ? "aspect-square"
          : aspectRatio === "4:3"
            ? "aspect-[4/3]"
            : "aspect-[4/5]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "group flex flex-col text-left rounded-md overflow-hidden border p-1 transition-all select-none cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
        selected
          ? "bg-[var(--color-panel)] border-[var(--color-accent)] ring-1 ring-[var(--color-accent)] shadow-md"
          : "bg-[var(--color-panel)] border-[var(--color-line)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-hover)]",
        className,
      )}
    >
      <div
        className={clsx(
          "relative w-full rounded-sm overflow-hidden bg-[var(--color-raised)]",
          aspectClass,
        )}
      >
        {imageSrc ? (
          <img src={imageSrc} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--color-text-3)] text-[11px]">
            No Preview
          </div>
        )}
        {badge && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase rounded-xs bg-black/70 backdrop-blur-xs text-white">
            {badge}
          </span>
        )}
      </div>
      <div className="p-1.5">
        <span className="block text-[12px] font-medium text-[var(--color-text)] truncate">
          {title}
        </span>
      </div>
    </button>
  );
};
