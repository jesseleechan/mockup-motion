import React, {
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import clsx from "clsx";
import { Plus, Upload, X } from "lucide-react";
import { validateAndDecodeAsset } from "../../../assets/decode";
import type { AssetRef } from "../../../doc/types";
import { useEditorStore } from "../../../state/store";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  Tooltip,
  useToast,
} from "../../../ui";
import { useAssetUrls } from "../../assets/useAssetUrls";
import { TILE_ASPECT, tileFit } from "../../library/tile-fit";
import { assetDropProps } from "./useShotUpdate";

const SHOT_ASSET_TYPE = "application/x-mockup-shot-asset";

interface ScreenshotListProps {
  shotIndex: number;
  assetIds: string[];
  images: AssetRef[];
  /** Accessible name of the list, e.g. "Slider screenshots". */
  label: string;
  /** How many screenshots the layout shows; later rows are dimmed. */
  shown: number;
  /** Says why later rows are dimmed, when there are any. */
  overflowNote?: string;
  /** The fewest screenshots the layout needs; Remove is disabled at this count. */
  minimum: number;
}

/**
 * A 48 × 30 preview (Layout Stage's .slot-thumb at 16:10), drawn from the top so a tall page
 * shows its hero, and never cropped at the sides (tile-fit.ts, quality bar §3). It leaves out the
 * role, so a phone screen covers the small box instead of shrinking to a sliver. `boxAspect` and
 * `className` give it another box, such as a Responsive Tour page's portrait mobile thumbnail.
 */
export const Thumb: React.FC<{
  url?: string;
  asset?: AssetRef;
  dimmed?: boolean;
  boxAspect?: number;
  className?: string;
}> = ({
  url,
  asset,
  dimmed,
  boxAspect = TILE_ASPECT,
  className = "w-12 h-[30px] rounded-[6px]",
}) => {
  const fit = tileFit({ width: asset?.width, height: asset?.height }, boxAspect);
  return (
    <span
      className={clsx("block shrink-0 overflow-hidden bg-field", className, dimmed && "opacity-50")}
    >
      {url && (
        <img
          src={url}
          alt=""
          draggable={false}
          className={clsx(
            "w-full h-full object-top",
            fit === "cover" ? "object-cover" : "object-contain",
          )}
        />
      )}
    </span>
  );
};

/**
 * The screenshots of a slider, orbit, stack or Frames shot in order: thumbnails, drag (or
 * Alt+↑ / Alt+↓) to reorder, remove, and Add screenshot from the library or a new upload.
 */
export const ScreenshotList: React.FC<ScreenshotListProps> = ({
  shotIndex,
  assetIds,
  images,
  label,
  shown,
  overflowNote,
  minimum,
}) => {
  const addAssetToShot = useEditorStore((s) => s.addAssetToShot);
  const removeAssetFromShot = useEditorStore((s) => s.removeAssetFromShot);
  const moveAssetInShot = useEditorStore((s) => s.moveAssetInShot);
  const addScreenshotsToShot = useEditorStore((s) => s.addScreenshotsToShot);
  const { toast } = useToast();
  const urls = useAssetUrls(images);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The gap a dragged row would land in: 0 is before the first row.
  const [dropGap, setDropGap] = useState<number | null>(null);
  // React reorders a moved row's element, which drops its focus; a keyboard move puts it back.
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const refocusId = useRef<string | null>(null);
  useLayoutEffect(() => {
    const id = refocusId.current;
    refocusId.current = null;
    if (id) rowRefs.current.get(id)?.focus();
  }, [assetIds]);
  const atMinimum = assetIds.length <= minimum;
  const minimumReason = `Needs at least ${minimum} screenshots`;

  const imageOf = (id: string) => images.find((a) => a.id === id);
  const nameOf = (id: string) => imageOf(id)?.name ?? "Missing screenshot";
  const available = images.filter((a) => !assetIds.includes(a.id));
  const add = (assetId: string) => {
    if (assetId) addAssetToShot(shotIndex, assetId);
  };

  const handleUpload = async (files: File[]) => {
    const refs: AssetRef[] = [];
    const blobs: Record<string, Blob> = {};
    for (const file of files) {
      try {
        const result = await validateAndDecodeAsset(file, file.name);
        refs.push(result.ref);
        blobs[result.ref.id] = result.blob;
      } catch (err) {
        toast(err instanceof Error ? err.message : `${file.name}: this image couldn't be read.`);
      }
    }
    if (refs.length > 0) await addScreenshotsToShot(shotIndex, refs, blobs);
  };

  const gapAt = (e: DragEvent<HTMLLIElement>, index: number) => {
    const box = e.currentTarget.getBoundingClientRect();
    return e.clientY < box.top + box.height / 2 ? index : index + 1;
  };

  const handleDrop = (e: DragEvent, gap: number) => {
    const id = e.dataTransfer.getData(SHOT_ASSET_TYPE);
    setDropGap(null);
    if (!id) return;
    e.preventDefault();
    // Stop the list's Media drop handler from treating it as a new screenshot.
    e.stopPropagation();
    const from = assetIds.indexOf(id);
    moveAssetInShot(shotIndex, id, gap > from ? gap - 1 : gap);
  };

  const handleKeyDown = (e: KeyboardEvent, id: string, index: number) => {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    refocusId.current = id;
    moveAssetInShot(shotIndex, id, index + (e.key === "ArrowUp" ? -1 : 1));
  };

  return (
    <div className="flex flex-col gap-2" {...assetDropProps(add)}>
      {/* Layout Stage's slot rows (.slots): number, thumbnail, name, actions. */}
      <ol aria-label={label} className="flex flex-col gap-1.5" onDragLeave={() => setDropGap(null)}>
        {assetIds.map((id, i) => (
          <li
            key={id}
            ref={(el) => {
              if (el) rowRefs.current.set(id, el);
              else rowRefs.current.delete(id);
            }}
            draggable
            tabIndex={0}
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            data-screenshot-row=""
            onDragStart={(e) => {
              e.dataTransfer.setData(SHOT_ASSET_TYPE, id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => setDropGap(null)}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(SHOT_ASSET_TYPE)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDropGap(gapAt(e, i));
            }}
            onDrop={(e) => handleDrop(e, gapAt(e, i))}
            onKeyDown={(e) => handleKeyDown(e, id, i)}
            className={clsx(
              "relative grid grid-cols-[14px_48px_minmax(0,1fr)_auto] items-center gap-2 py-[5px] pl-1.5 pr-[5px]",
              "rounded-[12px] bg-paper shadow-lift-sm hover:shadow-lift-sm-hover transition-shadow duration-120",
              "text-[12.5px] cursor-grab active:cursor-grabbing",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              // The drop line sits in the middle of the 6 px gap the row would land in.
              dropGap === i &&
                "before:absolute before:inset-x-2 before:-top-1 before:h-0.5 before:rounded-full before:bg-accent",
              dropGap === i + 1 &&
                i === assetIds.length - 1 &&
                "after:absolute after:inset-x-2 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-accent",
            )}
          >
            {/* The list already gives the position to screen readers. */}
            <span aria-hidden className="font-num text-[11px] font-medium text-center text-text-2">
              {i + 1}
            </span>
            <Thumb url={urls[id]} asset={imageOf(id)} dimmed={i >= shown} />
            <span
              className={clsx(
                "min-w-0 truncate font-semibold",
                // A screenshot the layout doesn't show is dimmed; its name still reads at 4.5:1.
                i >= shown ? "text-text-2" : "text-text",
              )}
              title={nameOf(id)}
              data-truncate=""
            >
              {nameOf(id)}
            </span>
            {atMinimum ? (
              // aria-disabled, not disabled, so the reason shows on hover and focus.
              <Tooltip content={minimumReason}>
                <IconButton
                  size="xs"
                  aria-label={`Remove ${nameOf(id)}`}
                  aria-disabled
                  aria-description={minimumReason}
                  className="opacity-40 cursor-not-allowed"
                  icon={<Icon icon={X} size={12} />}
                />
              </Tooltip>
            ) : (
              <IconButton
                size="xs"
                aria-label={`Remove ${nameOf(id)}`}
                icon={<Icon icon={X} size={12} />}
                onClick={() => removeAssetFromShot(shotIndex, id)}
              />
            )}
          </li>
        ))}
      </ol>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            icon={<Icon icon={Plus} size={14} />}
          >
            Add screenshot
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-y-auto"
        >
          {available.map((asset) => (
            <DropdownMenuItem key={asset.id} onSelect={() => add(asset.id)} title={asset.name}>
              <span className="flex items-center gap-2 min-w-0">
                <Thumb url={urls[asset.id]} asset={asset} />
                <span className="truncate">{asset.name}</span>
              </span>
            </DropdownMenuItem>
          ))}
          {available.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem
            icon={<Icon icon={Upload} size={14} />}
            onSelect={() => fileInputRef.current?.click()}
          >
            Upload…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/avif"
        aria-label="Upload screenshots to this shot"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          handleUpload(files).catch((err: unknown) => {
            toast(err instanceof Error ? err.message : "These screenshots couldn't be added.");
          });
        }}
      />

      {overflowNote && assetIds.length > shown && (
        <p className="text-[11px] leading-4 text-text-2">{overflowNote}</p>
      )}
      <p className="text-[11px] leading-4 text-text-2">
        Drag to reorder. Drop a file from Media here to add it.
      </p>
    </div>
  );
};
