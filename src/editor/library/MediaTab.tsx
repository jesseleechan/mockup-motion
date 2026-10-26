import React, { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  Icon,
  useToast,
} from "../../ui";
import { isSteppedLayout } from "../../motion";
import { layoutAssetIds } from "../../doc/assets";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { useAssetUrls } from "../assets/useAssetUrls";
import { MediaCard } from "./MediaCard";
import type { AssetRef, AssetRole } from "../../doc/types";
import { useImportFiles } from "../import/use-import-files";
import { SCREENSHOT_ACCEPT } from "./capture-import";
import { replacementRef } from "./replace-file";
import { Copy, GalleryHorizontal, Minus, Plus, RefreshCw, Tag, Trash2 } from "lucide-react";

interface MediaTabProps {
  onSelectAsset?: (assetId: string) => void;
  /** Id for the Library heading, so the panel can take its name. */
  headingId?: string;
}

export const MediaTab: React.FC<MediaTabProps> = ({ onSelectAsset, headingId }) => {
  const fullDoc = useEditorStore((s) => s.doc);
  const doc = useMemo(
    () => ({ ...fullDoc, assets: fullDoc.assets.filter((a) => a.kind === "image") }),
    [fullDoc],
  );
  const importFiles = useImportFiles();
  const { toast } = useToast();
  const replaceAsset = useEditorStore((s) => s.replaceAsset);
  const removeAsset = useEditorStore((s) => s.removeAsset);
  const setAssetRole = useEditorStore((s) => s.setAssetRole);
  const duplicateAsset = useEditorStore((s) => s.duplicateAsset);
  const reorderAssets = useEditorStore((s) => s.reorderAssets);
  const addAssetToShot = useEditorStore((s) => s.addAssetToShot);
  const removeAssetFromShot = useEditorStore((s) => s.removeAssetFromShot);
  // A slider, orbit, Site Tour or Responsive Tour shot takes screenshots from here (presets P03);
  // other layouts use their fields.
  const selection = useUIStore((s) => s.selection);
  const selectedShotIndex =
    selection.kind === "shot" ? fullDoc.shots.findIndex((shot) => shot.id === selection.id) : -1;
  const selectedLayout = fullDoc.shots[selectedShotIndex]?.layout;
  const selectedSlider = selectedLayout && isSteppedLayout(selectedLayout) ? selectedLayout : null;
  const selectedSliderIds = selectedSlider ? layoutAssetIds(selectedSlider) : [];
  const steppedName =
    selectedLayout?.kind === "orbit"
      ? "orbit"
      : selectedLayout?.kind === "tour" || selectedLayout?.kind === "responsive-tour"
        ? "tour"
        : "slider";
  // A Responsive Tour removes the page, both its screenshots (src/doc/tour-pages.ts).
  const removeLabel =
    selectedLayout?.kind === "responsive-tour"
      ? "Remove page from tour"
      : `Remove from ${steppedName}`;

  const [replacingAssetId, setReplacingAssetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const assetThumbnails = useAssetUrls(doc.assets);

  // Which shots use this asset?
  const getAssetUsage = (assetId: string): number[] => {
    const shotIndices: number[] = [];
    doc.shots.forEach((shot, idx) => {
      const lay = shot.layout;
      let used = false;
      if (lay.kind === "single" && lay.assetId === assetId) used = true;
      if (lay.kind === "compare" && (lay.beforeId === assetId || lay.afterId === assetId)) {
        used = true;
      }
      if (
        (lay.kind === "rows" || lay.kind === "columns" || isSteppedLayout(lay)) &&
        layoutAssetIds(lay).includes(assetId)
      )
        used = true;

      if (used) shotIndices.push(idx + 1);
    });
    return shotIndices;
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!replacingAssetId || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const existing = doc.assets.find((a) => a.id === replacingAssetId);
    if (!existing) return;

    setReplacingAssetId(null);

    // A file the import would reject, such as one that can't be decoded, is rejected with the
    // import's message: nothing is stored and the asset stays as it was.
    let updatedRef: AssetRef;
    try {
      updatedRef = await replacementRef(existing, file);
    } catch (err) {
      toast(err instanceof Error ? err.message : `${file.name}: this image couldn't be read.`);
      return;
    }
    await replaceAsset(existing.id, updatedRef, file);
  };

  const handleDragStart = (e: React.DragEvent, asset: AssetRef) => {
    e.dataTransfer.setData("application/x-mockup-asset-id", asset.id);
    e.dataTransfer.setData("text/plain", asset.id);
    e.dataTransfer.effectAllowed = "copyMove";
  };

  const handleCardDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleCardDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("application/x-mockup-asset-id");
    if (!sourceId || sourceId === targetId) return;

    const ids = doc.assets.map((a) => a.id);
    const sourceIdx = ids.indexOf(sourceId);
    const targetIdx = ids.indexOf(targetId);

    if (sourceIdx !== -1 && targetIdx !== -1) {
      ids.splice(sourceIdx, 1);
      ids.splice(targetIdx, 0, sourceId);
      reorderAssets(ids);
    }
  };

  const count = doc.assets.length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={SCREENSHOT_ACCEPT}
        data-testid="media-input"
        aria-label="Upload screenshots"
        className="hidden"
        onChange={async (e) => {
          if (e.target.files) {
            await importFiles(Array.from(e.target.files));
          }
        }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReplaceFile}
      />

      {/* Layout Stage's group head (.group-head): the heading, and the file count as its note. */}
      <div className="shrink-0 flex items-baseline justify-between gap-2 px-3.5 pt-2.5 pb-[5px]">
        <h2
          id={headingId}
          className="text-[10.5px] leading-[1.2] font-semibold uppercase tracking-[0.08em] text-text-2"
        >
          Library
        </h2>
        <span className="text-[11px] text-text-2">
          {count} {count === 1 ? "file" : "files"}
        </span>
      </div>

      {/* The tiles, then the Add tile, as Layout Stage's media grid. Focusable, so keyboard users
          can scroll a long list (axe scrollable-region-focusable). The padding keeps the tiles'
          hairline lift inside the scroll box. */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Screenshots"
        className="flex-1 min-h-0 overflow-y-auto px-3.5 pt-1 pb-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
          {doc.assets.map((asset) => {
            const thumb = assetThumbnails[asset.id];
            const usage = getAssetUsage(asset.id);
            const isUsed = usage.length > 0;

            return (
              <ContextMenu key={asset.id}>
                <ContextMenuTrigger asChild>
                  <MediaCard
                    asset={asset}
                    thumb={thumb}
                    usage={usage}
                    onDragStart={(e) => handleDragStart(e, asset)}
                    onDragOver={handleCardDragOver}
                    onDrop={(e) => handleCardDrop(e, asset.id)}
                    onClick={() => onSelectAsset?.(asset.id)}
                    onSetRole={(role) => setAssetRole(asset.id, role)}
                  />
                </ContextMenuTrigger>

                <ContextMenuContent>
                  {selectedSlider &&
                    (selectedSliderIds.includes(asset.id) ? (
                      <ContextMenuItem
                        icon={<Icon icon={Minus} size={13} />}
                        onClick={() => removeAssetFromShot(selectedShotIndex, asset.id)}
                      >
                        {removeLabel}
                      </ContextMenuItem>
                    ) : (
                      <ContextMenuItem
                        icon={<Icon icon={GalleryHorizontal} size={13} />}
                        onClick={() => addAssetToShot(selectedShotIndex, asset.id)}
                      >
                        Add to {steppedName}
                      </ContextMenuItem>
                    ))}

                  <ContextMenuItem
                    icon={<Icon icon={RefreshCw} size={13} />}
                    onClick={() => {
                      setReplacingAssetId(asset.id);
                      replaceInputRef.current?.click();
                    }}
                  >
                    Replace file…
                  </ContextMenuItem>

                  <ContextMenuItem
                    icon={<Icon icon={Copy} size={13} />}
                    onClick={() => duplicateAsset(asset.id)}
                  >
                    Duplicate
                  </ContextMenuItem>

                  {/* Set role options */}
                  {(["desktop", "mobile", "tablet", "logo", "other"] as AssetRole[]).map(
                    (roleOption) => (
                      <ContextMenuItem
                        key={roleOption}
                        icon={<Icon icon={Tag} size={13} />}
                        onClick={() => setAssetRole(asset.id, roleOption)}
                      >
                        Set role: {roleOption}
                      </ContextMenuItem>
                    ),
                  )}

                  <ContextMenuItem
                    danger
                    icon={<Icon icon={Trash2} size={13} />}
                    onClick={() => {
                      if (isUsed) {
                        if (
                          confirm(
                            `This media is used in shot ${usage.join(
                              ", ",
                            )}. Removing it will clear its references. Continue?`,
                          )
                        ) {
                          removeAsset(asset.id);
                        }
                      } else {
                        removeAsset(asset.id);
                      }
                    }}
                  >
                    Remove
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}

          <AddTile onClick={() => fileInputRef.current?.click()} />
        </div>

        {count === 0 && (
          <p className="mt-2.5 text-[11.5px] leading-[1.45] text-text-2">
            Drop screenshots here, or click Add to browse.
          </p>
        )}
      </div>
    </div>
  );
};

/** Upload, as Layout Stage's .media-add: a ringed tile with a plus at the end of the grid. */
const AddTile: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Add screenshots"
    title="Add screenshots"
    className={clsx(
      "aspect-[16/10] min-w-0 flex flex-col items-center justify-center gap-px rounded-[12px] cursor-pointer",
      "text-text-2 shadow-[inset_0_0_0_1.5px_var(--color-field-2)] hover:bg-field hover:text-text",
      "transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    )}
  >
    <Icon icon={Plus} size={18} strokeWidth={1.6} />
    <span className="text-[10.5px] font-medium">Add</span>
  </button>
);
