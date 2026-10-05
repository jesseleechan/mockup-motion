import React, { useRef, useState, useEffect } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  Icon,
} from "../../ui";
import { useEditorStore } from "../../state/store";
import { getBlob } from "../../storage/blobs";
import type { AssetRef, AssetRole } from "../../doc/types";
import { analyzeImage } from "../../assets/roles";
import {
  Copy,
  ImageIcon,
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
  const doc = useEditorStore((s) => s.doc);
  const addAssets = useEditorStore((s) => s.addAssets);
  const replaceAsset = useEditorStore((s) => s.replaceAsset);
  const removeAsset = useEditorStore((s) => s.removeAsset);
  const setAssetRole = useEditorStore((s) => s.setAssetRole);
  const duplicateAsset = useEditorStore((s) => s.duplicateAsset);
  const reorderAssets = useEditorStore((s) => s.reorderAssets);

  const [assetThumbnails, setAssetThumbnails] = useState<Record<string, string>>({});
  const [replacingAssetId, setReplacingAssetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Load thumbnail URLs
  useEffect(() => {
    let active = true;
    const urls: Record<string, string> = {};

    async function loadThumbs() {
      for (const asset of doc.assets) {
        if (
          asset.id.startsWith("/") ||
          asset.id.startsWith("http") ||
          asset.id.startsWith("blob:") ||
          asset.id.startsWith("data:")
        ) {
          urls[asset.id] = asset.id;
        } else {
          const blob = await getBlob(asset.id);
          if (blob && active) {
            urls[asset.id] = URL.createObjectURL(blob);
          }
        }
      }
      if (active) {
        setAssetThumbnails(urls);
      }
    }

    loadThumbs();

    return () => {
      active = false;
      for (const [id, url] of Object.entries(urls)) {
        if (!id.startsWith("/") && !id.startsWith("http")) {
          URL.revokeObjectURL(url);
        }
      }
    };
  }, [doc.assets]);

  // Which shots use this asset?
  const getAssetUsage = (assetId: string): number[] => {
    const shotIndices: number[] = [];
    doc.shots.forEach((shot, idx) => {
      const lay = shot.layout;
      let used = false;
      if (lay.kind === "single" && lay.assetId === assetId) used = true;
      if (lay.kind === "pair" && (lay.desktopId === assetId || lay.mobileId === assetId)) used = true;
      if (lay.kind === "trio" && (lay.desktopId === assetId || lay.tabletId === assetId || lay.mobileId === assetId)) used = true;
      if ((lay.kind === "rows" || lay.kind === "columns" || lay.kind === "wall" || lay.kind === "stack") && lay.assetIds.includes(assetId)) used = true;
      if (shot.texts?.some((t) => t.logoAssetId === assetId)) used = true;

      if (used) shotIndices.push(idx + 1);
    });
    return shotIndices;
  };

  const handleFileUpload = async (files: File[]) => {
    const newRefs: AssetRef[] = [];
    const blobs: Record<string, Blob> = {};

    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const assetId = crypto.randomUUID();
      blobs[assetId] = file;

      let width = 1920;
      let height = 1080;
      let hasAlpha = false;
      let opaqueFraction = 1.0;
      let bottomColor = "#000000";
      let hasStatusBar = false;

      try {
        const bmp = await createImageBitmap(file);
        width = bmp.width;
        height = bmp.height;

        // Sample pixels to detect alpha and status bar
        const canvas = new OffscreenCanvas(Math.min(width, 390), Math.min(height, 844));
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const analysis = analyzeImage({
            width: canvas.width,
            height: canvas.height,
            rgba: imgData.data,
          });
          hasAlpha = analysis.role === "logo";
          opaqueFraction = hasAlpha ? 0.15 : 1.0;
          bottomColor = analysis.bottomColor;
          hasStatusBar = analysis.hasStatusBar;
        }
        bmp.close();
      } catch {
        // fallback
      }

      const role = analyzeImage({ width, height, hasAlpha, opaqueFraction }).role;
      const isTall = role === "mobile" ? width / height < 0.4 : width / height < 0.5;

      newRefs.push({
        id: assetId,
        name: file.name,
        kind: "image",
        mime: file.type || "image/png",
        bytes: file.size,
        role,
        width,
        height,
        meta: {
          tall: isTall,
          hasStatusBar,
          bottomColor,
        },
      });
    }

    if (newRefs.length > 0) {
      await addAssets(newRefs, blobs);
    }
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
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          if (e.target.files) {
            await handleFileUpload(Array.from(e.target.files));
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
        <span className="text-xs text-[var(--color-text-2)]">{doc.assets.length} file(s)</span>
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
        /* 2-Column Media Grid */
        <div className="flex-1 overflow-y-auto pr-1 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {doc.assets.map((asset) => {
              const thumb = assetThumbnails[asset.id];
              const usage = getAssetUsage(asset.id);
              const isUsed = usage.length > 0;

              return (
                <ContextMenu key={asset.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, asset)}
                      onDragOver={handleCardDragOver}
                      onDrop={(e) => handleCardDrop(e, asset.id)}
                      onClick={() => onSelectAsset?.(asset.id)}
                      className="group relative flex flex-col rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-hover)] overflow-hidden cursor-grab active:cursor-grabbing transition-all select-none"
                    >
                      {/* Thumbnail Container */}
                      <div className="w-full aspect-[4/3] bg-black/60 relative overflow-hidden flex items-center justify-center border-b border-[var(--color-line)]">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={asset.name}
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        ) : (
                          <Icon icon={ImageIcon} size={20} className="text-[var(--color-text-3)]" />
                        )}

                        {/* Top Badges */}
                        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
                          <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[9px] font-medium text-[var(--color-text)] uppercase tracking-wider">
                            {asset.role || "desktop"}
                          </span>

                          {asset.meta?.tall && (
                            <span className="px-1 py-0.5 rounded bg-[var(--color-accent)]/80 text-[8px] font-bold text-black uppercase">
                              Tall
                            </span>
                          )}
                        </div>

                        {/* Used in Shot Dot */}
                        {isUsed && (
                          <div
                            title={`Used in Shot ${usage.join(", ")}`}
                            className="absolute bottom-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[9px] text-[var(--color-text-2)]"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                            <span>S{usage.join(",")}</span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-1.5 flex flex-col min-w-0">
                        <span className="text-[11px] font-semibold text-[var(--color-text)] truncate">
                          {asset.name}
                        </span>
                        <span className="text-[9px] text-[var(--color-text-3)] font-mono truncate mt-0.5">
                          {asset.width && asset.height
                            ? `${asset.width}×${asset.height}`
                            : `${(asset.bytes / 1024).toFixed(0)} KB`}
                        </span>
                      </div>
                    </div>
                  </ContextMenuTrigger>

                  <ContextMenuContent>
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
                              `This media is used in Shot ${usage.join(
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
