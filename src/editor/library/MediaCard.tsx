import React from "react";
import type { AssetRef, AssetRole } from "../../doc/types";

type ScreenRole = Extract<AssetRole, "desktop" | "mobile">;

const CARD_ASPECT = 16 / 10;

const ROLE_LABELS: Record<ScreenRole, string> = { desktop: "Desktop", mobile: "Mobile" };

function otherRole(role: ScreenRole): ScreenRole {
  return role === "desktop" ? "mobile" : "desktop";
}

export interface MediaCardProps extends React.HTMLAttributes<HTMLDivElement> {
  asset: AssetRef;
  /** The screenshot's URL (`useAssetUrls`); a neutral fill shows until it is ready. */
  thumb: string | undefined;
  /** 1-based numbers of the shots that use the screenshot. */
  usage: number[];
  onSetRole: (role: ScreenRole) => void;
}

/**
 * A screenshot in the Media tab: the image fitted to the card's width, the full name on hover,
 * and a Desktop / Mobile badge that switches the role. Forwards its ref and other props, so it
 * can be a context menu trigger.
 */
export const MediaCard = React.forwardRef<HTMLDivElement, MediaCardProps>(
  ({ asset, thumb, usage, onSetRole, ...rest }, ref) => {
    const isUsed = usage.length > 0;
    // A screenshot without a role counts as desktop, as in saved templates (`user-templates.ts`).
    const role = asset.role ?? "desktop";
    const screenRole = role === "desktop" || role === "mobile" ? role : undefined;
    // The image fills the 16:10 box without overflowing it. A screenshot no wider than the box
    // covers it from the top, so only its bottom is cut; a wider one, or a phone screen, shows
    // whole. A page is never cropped at the sides (quality bar §3).
    const aspect = asset.width && asset.height ? asset.width / asset.height : CARD_ASPECT;
    const phoneScreen = screenRole === "mobile" && !asset.meta?.tall;
    const fit = !phoneScreen && aspect <= CARD_ASPECT ? "object-cover" : "object-contain";

    return (
      <div
        ref={ref}
        {...rest}
        draggable
        title={asset.name}
        data-testid="media-card"
        data-asset-id={asset.id}
        className="group relative flex flex-col rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-hover)] overflow-hidden cursor-grab active:cursor-grabbing transition-all select-none"
      >
        <div className="w-full aspect-[16/10] bg-[var(--color-bg)] relative overflow-hidden border-b border-[var(--color-line)]">
          {thumb && (
            <img
              src={thumb}
              alt=""
              draggable={false}
              className={`absolute inset-0 w-full h-full object-top pointer-events-none ${fit}`}
            />
          )}

          <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between">
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
                className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] font-medium text-white/90 hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] cursor-pointer"
              >
                {ROLE_LABELS[screenRole]}
              </button>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] font-medium text-white/90 pointer-events-none">
                {role[0].toUpperCase() + role.slice(1)}
              </span>
            )}

            {asset.meta?.tall && (
              <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] font-medium text-white/90 pointer-events-none">
                Full page
              </span>
            )}
          </div>

          {/* Used in Shot Dot */}
          {isUsed && (
            <div
              title={`Used in shot ${usage.join(", ")}`}
              className="absolute bottom-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[9px] text-white/80"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
              <span>S{usage.join(",")}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-1.5 flex flex-col min-w-0">
          <span
            data-truncate
            className="text-[11px] font-semibold text-[var(--color-text)] truncate"
          >
            {asset.name}
          </span>
          <span className="text-[9px] text-[var(--color-text-3)] font-mono truncate mt-0.5">
            {asset.width && asset.height
              ? `${asset.width}×${asset.height}`
              : `${(asset.bytes / 1024).toFixed(0)} KB`}
          </span>
        </div>
      </div>
    );
  },
);
MediaCard.displayName = "MediaCard";
