import React, {
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import clsx from "clsx";
import { GripVertical, Plus, Upload, X } from "lucide-react";
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

/** A 40 × 26 preview, top-aligned so a tall page shows its hero (quality-bar §3: no side crop). */
const Thumb: React.FC<{ url?: string; dimmed?: boolean }> = ({ url, dimmed }) => (
  <span
    className={clsx(
      "block w-10 h-[26px] shrink-0 overflow-hidden rounded-xs border border-[var(--color-line)] bg-[var(--color-raised)]",
      dimmed && "opacity-50",
    )}
  >
    {url && (
      <img src={url} alt="" draggable={false} className="w-full h-full object-cover object-top" />
    )}
  </span>
);

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

  const nameOf = (id: string) => images.find((a) => a.id === id)?.name ?? "Missing screenshot";
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
    <div className="space-y-2" {...assetDropProps(add)}>
      <ol aria-label={label} className="space-y-0.5" onDragLeave={() => setDropGap(null)}>
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
              "group flex items-center gap-2 px-1 py-1 rounded-sm text-[12px] cursor-grab active:cursor-grabbing",
              "hover:bg-[var(--color-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
              // The drop line sits on the edge of the gap the row would land in.
              dropGap === i && "shadow-[inset_0_2px_0_var(--color-accent)]",
              dropGap === i + 1 &&
                i === assetIds.length - 1 &&
                "shadow-[inset_0_-2px_0_var(--color-accent)]",
              i >= shown ? "text-[var(--color-text-3)]" : "text-[var(--color-text)]",
            )}
          >
            <Icon
              icon={GripVertical}
              size={12}
              className="shrink-0 text-[var(--color-text-3)] group-hover:text-[var(--color-text-2)]"
            />
            <Thumb url={urls[id]} dimmed={i >= shown} />
            <span className="flex-1 min-w-0 truncate" title={nameOf(id)} data-truncate="">
              {nameOf(id)}
            </span>
            {atMinimum ? (
              // aria-disabled, not disabled, so the reason shows on hover and focus.
              <Tooltip content={minimumReason}>
                <IconButton
                  size="sm"
                  aria-label={`Remove ${nameOf(id)}`}
                  aria-disabled
                  aria-description={minimumReason}
                  className="opacity-40 cursor-not-allowed"
                  icon={<Icon icon={X} size={12} />}
                />
              </Tooltip>
            ) : (
              <IconButton
                size="sm"
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
                <Thumb url={urls[asset.id]} />
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
        <p className="text-[11px] text-[var(--color-text-2)]">{overflowNote}</p>
      )}
      <p className="text-[11px] text-[var(--color-text-3)]">
        Drag to reorder. Drop a file from Media here to add it.
      </p>
    </div>
  );
};
