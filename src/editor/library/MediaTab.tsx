import React, { useMemo, useRef, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  Icon,
} from "../../ui";
import { isSteppedLayout } from "../../motion";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { useAssetUrls } from "../assets/useAssetUrls";
import { MediaCard } from "./MediaCard";
import type { AssetRef, AssetRole } from "../../doc/types";
import { useImportFiles } from "../import/use-import-files";
import { SCREENSHOT_ACCEPT } from "./capture-import";
import {
  Copy,
  GalleryHorizontal,
  Minus,
  Plus,
  RefreshCw,
  Tag,
  Trash2,
  UploadCloud,
} from "lucide-react";

interface MediaTabProps {
  onSelectAsset?: (assetId: string) => void;
}

export const MediaTab: React.FC<MediaTabProps> = ({ onSelectAsset }) => {
  const fullDoc = useEditorStore((s) => s.doc);
  const doc = useMemo(
    () => ({ ...fullDoc, assets: fullDoc.assets.filter((a) => a.kind === "image") }),
    [fullDoc],
  );
  const importFiles = useImportFiles();
  const replaceAsset = useEditorStore((s) => s.replaceAsset);
  const removeAsset = useEditorStore((s) => s.removeAsset);
  const setAssetRole = useEditorStore((s) => s.setAssetRole);
  const duplicateAsset = useEditorStore((s) => s.duplicateAsset);
  const reorderAssets = useEditorStore((s) => s.reorderAssets);
  const addAssetToShot = useEditorStore((s) => s.addAssetToShot);
  const removeAssetFromShot = useEditorStore((s) => s.removeAssetFromShot);
  // A slider or orbit shot takes screenshots from here (presets P03); other layouts use their
  // fields.
  const selection = useUIStore((s) => s.selection);
  const selectedShotIndex =
    selection.kind === "shot" ? fullDoc.shots.findIndex((shot) => shot.id === selection.id) : -1;
  const selectedLayout = fullDoc.shots[selectedShotIndex]?.layout;
  const selectedSlider = selectedLayout && isSteppedLayout(selectedLayout) ? selectedLayout : null;
  const steppedName = selectedLayout?.kind === "orbit" ? "orbit" : "slider";

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
      if (
        (lay.kind === "rows" ||
          lay.kind === "columns" ||
          lay.kind === "slider" ||
          lay.kind === "orbit") &&
        lay.assetIds.includes(assetId)
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

    let width = existing.width ?? 1920;
    let height = existing.height ?? 1080;
    try {
      const bmp = await createImageBitmap(file);
      width = bmp.width;
      height = bmp.height;
      bmp.close();
    } catch {
      // keep
    }

    const updatedRef: AssetRef = {
      ...existing,
      name: file.name,
      mime: file.type || "image/png",
      bytes: file.size,
      width,
      height,
    };

    await replaceAsset(replacingAssetId, updatedRef, file);
    setReplacingAssetId(null);
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

  return (
    <div className="flex-1 flex flex-col min-h-0 px-3 pt-2">
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

      {/* Header action bar */}
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-xs text-[var(--color-text-2)]">
          {doc.assets.length} {doc.assets.length === 1 ? "file" : "files"}
        </span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-raised)] hover:bg-[var(--color-hover)] text-xs text-[var(--color-text)] border border-[var(--color-line)] transition-colors cursor-pointer"
        >
          <Icon icon={Plus} size={13} />
          <span>Upload</span>
        </button>
      </div>

      {doc.assets.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex flex-col items-center justify-center p-4 text-center text-xs text-[var(--color-text-3)] border border-dashed border-[var(--color-line)] rounded-lg cursor-pointer hover:border-[var(--color-accent)] transition-colors"
        >
          <Icon icon={UploadCloud} size={28} className="mb-2 opacity-50" />
          <span className="font-semibold text-[var(--color-text-2)]">No media yet</span>
          <span className="text-[10px] mt-1 text-[var(--color-text-3)]">
            Drop screenshots here or click to browse
          </span>
        </div>
      ) : (
        /* 2-column media grid, focusable so keyboard users can scroll a long list (axe
           scrollable-region-focusable) */
        <div
          tabIndex={0}
          role="region"
          aria-label="Screenshots"
          className="flex-1 overflow-y-auto pr-1 pb-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <div className="grid grid-cols-2 gap-2">
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
                      (selectedSlider.assetIds.includes(asset.id) ? (
                        <ContextMenuItem
                          icon={<Icon icon={Minus} size={13} />}
                          onClick={() => removeAssetFromShot(selectedShotIndex, asset.id)}
                        >
                          Remove from {steppedName}
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
          </div>
        </div>
      )}
    </div>
  );
};
