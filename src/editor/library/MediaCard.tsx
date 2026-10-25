import React from "react";
import clsx from "clsx";
import type { AssetRef, AssetRole } from "../../doc/types";
import { TILE_ASPECT, tileFit } from "./tile-fit";

type ScreenRole = Extract<AssetRole, "desktop" | "mobile">;

const ROLE_LABELS: Record<ScreenRole, string> = { desktop: "Desktop", mobile: "Mobile" };

function otherRole(role: ScreenRole): ScreenRole {
  return role === "desktop" ? "mobile" : "desktop";
}

/** "2880×1800", or the file size while the image's size is unknown. */
function sizeLabel(asset: AssetRef): string {
  return asset.width && asset.height
    ? `${asset.width}×${asset.height}`
    : `${(asset.bytes / 1024).toFixed(0)} KB`;
}

// The tags over the screenshot are paper pills, so they read on any image in either theme.
const TAG =
  "inline-flex items-center h-[18px] px-1.5 rounded-[6px] bg-paper text-[10px] font-semibold leading-none whitespace-nowrap";

export interface MediaCardProps extends React.HTMLAttributes<HTMLDivElement> {
  asset: AssetRef;
  /** The screenshot's URL (`useAssetUrls`); the tile's field fill shows until it is ready. */
  thumb: string | undefined;
  /** 1-based numbers of the shots that use the screenshot. */
  usage: number[];
  onSetRole: (role: ScreenRole) => void;
}

/**
 * A screenshot in the Library, as Layout Stage's media tile: the image on a field tile, with a
 * Desktop / Mobile tag that switches the role, a Full page tag and the shots that use it. The
 * name and size show on hover and are read by screen readers. Forwards its ref and other props,
 * so it can be a context menu trigger.
 */
export const MediaCard = React.forwardRef<HTMLDivElement, MediaCardProps>(
  ({ asset, thumb, usage, onSetRole, ...rest }, ref) => {
    // A screenshot without a role counts as desktop, as in saved templates (`user-templates.ts`).
    const role = asset.role ?? "desktop";
    const screenRole = role === "desktop" || role === "mobile" ? role : undefined;
    const fit = tileFit(asset, TILE_ASPECT);
    const size = sizeLabel(asset);

    return (
      <div
        ref={ref}
        {...rest}
        draggable
        title={`${asset.name} · ${size}`}
        data-testid="media-card"
        data-asset-id={asset.id}
        className={clsx(
          "relative aspect-[16/10] min-w-0 rounded-[12px] overflow-hidden bg-field select-none",
          "shadow-lift-sm hover:shadow-[0_0_0_1px_var(--color-line-strong)] transition-shadow duration-120",
          "cursor-grab active:cursor-grabbing",
        )}
      >
        {thumb && (
          <img
            src={thumb}
            alt=""
            draggable={false}
            className={clsx(
              "absolute inset-0 w-full h-full object-top pointer-events-none",
              fit === "cover" ? "object-cover" : "object-contain",
            )}
          />
        )}

        <span className="sr-only">
          {asset.name}, {size}
        </span>

        <div className="absolute top-1 inset-x-1 flex flex-wrap items-start justify-between gap-1">
          {screenRole ? (
            <button
              type="button"
              data-testid="media-role"
              aria-label={`${ROLE_LABELS[screenRole]} screenshot. Change to ${ROLE_LABELS[otherRole(screenRole)]}`}
              title={`Change to ${ROLE_LABELS[otherRole(screenRole)]}`}
              onClick={(e) => {
                e.stopPropagation();
                onSetRole(otherRole(screenRole));
              }}
              className={clsx(
                TAG,
                "text-text shadow-lift-sm hover:bg-field cursor-pointer transition-colors duration-120",
                "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
              )}
            >
              {ROLE_LABELS[screenRole]}
            </button>
          ) : (
            <span className={clsx(TAG, "text-text pointer-events-none")}>
              {role[0].toUpperCase() + role.slice(1)}
            </span>
          )}

          {asset.meta?.tall && (
            <span className={clsx(TAG, "text-text-2 pointer-events-none")}>Full page</span>
          )}
        </div>

        {/* The shots that use it, in Layout Stage's ink pill (.media-use). */}
        {usage.length > 0 && (
          <span
            title={`Used in shot ${usage.join(", ")}`}
            className="absolute left-1 bottom-1 inline-flex items-center h-[15px] min-w-[15px] px-1 rounded-full bg-text text-paper font-num text-[9.5px] font-medium leading-none"
          >
            S{usage.join(",")}
          </span>
        )}
      </div>
    );
  },
);
MediaCard.displayName = "MediaCard";
