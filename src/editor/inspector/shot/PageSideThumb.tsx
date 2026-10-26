import React from "react";
import clsx from "clsx";
import type { AssetRef } from "../../../doc/types";
import type { PageSide } from "../../../doc/tour-pages";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../ui";
import { Thumb } from "./ScreenshotList";
import { assetDropProps } from "./useShotUpdate";

// The mobile card's shape, quality bar §3.4: 14 × 30 px is the phone screen aspect 0.4615.
const MOBILE_THUMB_ASPECT = 14 / 30;

interface PageSideThumbProps {
  side: PageSide;
  page: number;
  assetId: string;
  images: AssetRef[];
  urls: Record<string, string>;
  dimmed: boolean;
  /** The screenshots this side may change to: its size, not already on this side. */
  choices: AssetRef[];
  onChange: (assetId: string) => void;
}

/**
 * One side of a Responsive Tour page (PageList): its thumbnail, which opens a menu of the
 * screenshots it can change to and takes a screenshot dropped from Media.
 */
export const PageSideThumb: React.FC<PageSideThumbProps> = ({
  side,
  page,
  assetId,
  images,
  urls,
  dimmed,
  choices,
  onChange,
}) => {
  const asset = images.find((a) => a.id === assetId);
  const mobile = side === "mobile";
  const sideName = mobile ? "mobile" : "desktop";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Page ${page} ${sideName} screenshot: ${asset?.name ?? "none"}`}
          className={clsx(
            "rounded-[6px] cursor-pointer",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            // A missing side reads as an empty slot.
            !asset && "outline-1 outline-dashed outline-line-strong",
          )}
          {...assetDropProps(onChange)}
        >
          {mobile ? (
            <Thumb
              url={urls[assetId]}
              asset={asset}
              dimmed={dimmed}
              boxAspect={MOBILE_THUMB_ASPECT}
              className="w-[14px] h-[30px] rounded-[4px]"
            />
          ) : (
            <Thumb url={urls[assetId]} asset={asset} dimmed={dimmed} />
          )}
        </button>
      </DropdownMenuTrigger>
      {/* Aligned to the thumbnail's right edge, so the menu stays inside the inspector's side. */}
      <DropdownMenuContent
        align="end"
        collisionPadding={8}
        className="w-64 max-h-72 overflow-y-auto"
      >
        {choices.length === 0 && (
          <DropdownMenuItem disabled>No other {sideName} screenshots</DropdownMenuItem>
        )}
        {choices.map((choice) => (
          <DropdownMenuItem
            key={choice.id}
            onSelect={() => onChange(choice.id)}
            title={choice.name}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Thumb url={urls[choice.id]} asset={choice} />
              <span className="truncate">{choice.name}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
