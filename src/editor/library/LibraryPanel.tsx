import React, { useRef, useState, useEffect } from "react";
import { Tabs, TabsList, TabsContent, Button, Icon, Tooltip } from "../../ui";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { BUILTIN_TEMPLATES, buildTemplate } from "../../templates";
import { getBlob } from "../../storage/blobs";
import type { AssetRef } from "../../doc/types";
import {
  Film,
  FolderOpen,
  Image as ImageIcon,
  PanelLeftClose,
  Plus,
  Trash2,
} from "lucide-react";

export const LibraryPanel: React.FC = () => {
  const doc = useEditorStore((s) => s.doc);
  const applyTemplateResult = useEditorStore((s) => s.applyTemplateResult);
  const addAssets = useEditorStore((s) => s.addAssets);
  const removeAsset = useEditorStore((s) => s.removeAsset);

  const togglePanel = useUIStore((s) => s.togglePanel);

  const [activeTab, setActiveTab] = useState<string>("templates");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [assetThumbnails, setAssetThumbnails] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load thumbnail URLs for media tab
  useEffect(() => {
    let active = true;
    const urls: Record<string, string> = {};

    async function loadThumbs() {
      for (const asset of doc.assets) {
        if (asset.id.startsWith("/") || asset.id.startsWith("http") || asset.id.startsWith("blob:") || asset.id.startsWith("data:")) {
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
      // revoke blob URLs
      for (const [id, url] of Object.entries(urls)) {
        if (!id.startsWith("/") && !id.startsWith("http")) {
          URL.revokeObjectURL(url);
        }
      }
    };
  }, [doc.assets]);

  const handleApplyTemplate = (templateId: string) => {
    const template = BUILTIN_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const res = buildTemplate(template, {
      aspect: doc.aspect,
      assets: doc.assets,
      name: doc.name,
      style: doc.style,
    });
    applyTemplateResult(res, template.id);
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
      try {
        const bmp = await createImageBitmap(file);
        width = bmp.width;
        height = bmp.height;
        bmp.close();
      } catch {
        // fallback
      }

      newRefs.push({
        id: assetId,
        name: file.name,
        kind: "image",
        mime: file.type || "image/png",
        bytes: file.size,
        role: height / width > 1.2 ? "mobile" : "desktop",
        width,
        height,
      });
    }

    if (newRefs.length > 0) {
      await addAssets(newRefs, blobs);
    }
  };

  const categories = ["all", "single", "mobile", "portfolio", "reel"];
  const filteredTemplates = BUILTIN_TEMPLATES.filter(
    (t) => selectedCategory === "all" || t.category === selectedCategory,
  );

  return (
    <aside className="w-[272px] bg-[var(--color-panel)] border-r border-[var(--color-line)] flex flex-col shrink-0 select-none z-20 overflow-hidden">
      {/* Hidden file input */}
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

      {/* Header with collapse button */}
      <div className="h-10 px-3 border-b border-[var(--color-line)] flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-text)]">Library</span>
        <Tooltip content="Collapse library ([)">
          <button
            type="button"
            onClick={() => togglePanel("library")}
            aria-label="Collapse library panel"
            className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] rounded transition-colors"
          >
            <Icon icon={PanelLeftClose} size={15} />
          </button>
        </Tooltip>
      </div>

      {/* Tabs */}
      <div className="flex-1 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-3 pt-2">
            <TabsList
              items={[
                { id: "templates", label: "Templates", icon: <Icon icon={Film} size={13} /> },
                { id: "media", label: `Media (${doc.assets.length})`, icon: <Icon icon={FolderOpen} size={13} /> },
              ]}
            />
          </div>

          {/* Templates Content */}
          <TabsContent value="templates" className="flex-1 flex flex-col min-h-0 px-3 pt-2">
            {/* Category Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-2 shrink-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium capitalize transition-colors ${
                    selectedCategory === cat
                      ? "bg-[var(--color-raised)] text-[var(--color-text)] border border-[var(--color-line-strong)]"
                      : "text-[var(--color-text-3)] hover:text-[var(--color-text-2)]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Template Cards List */}
            <div
              tabIndex={0}
              aria-label="Available templates"
              className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1 focus:outline-none"
            >
              {filteredTemplates.map((template) => {
                const requiredSlots = template.slots.filter((s) => s.required);
                const hasEnoughAssets = doc.assets.length >= requiredSlots.length;

                return (
                  <div
                    key={template.id}
                    onClick={() => handleApplyTemplate(template.id)}
                    className="p-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-hover)] cursor-pointer transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                        {template.name}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-3)] font-mono">
                        {template.defaultDuration}s
                      </span>
                    </div>

                    <p className="text-[11px] text-[var(--color-text-2)] line-clamp-2 leading-relaxed mb-2">
                      {template.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-[var(--color-text-3)]">
                        {requiredSlots.length === 0
                          ? "No media needed"
                          : `${requiredSlots.length} slot${requiredSlots.length > 1 ? "s" : ""}`}
                      </span>

                      {!hasEnoughAssets && requiredSlots.length > 0 && (
                        <span className="text-[9px] text-[var(--color-accent)] font-medium">
                          Needs {requiredSlots.length}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Media Content */}
          <TabsContent value="media" className="flex-1 flex flex-col min-h-0 px-3 pt-2">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-[var(--color-text-2)]">{doc.assets.length} file(s)</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                icon={<Icon icon={Plus} size={14} />}
              >
                Upload
              </Button>
            </div>

            {doc.assets.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-xs text-[var(--color-text-3)] border border-dashed border-[var(--color-line)] rounded-lg">
                <Icon icon={ImageIcon} size={24} className="mb-2 opacity-50" />
                <span>No media yet.</span>
                <span className="text-[10px] mt-1">Drop screenshots anywhere to add.</span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {doc.assets.map((asset) => {
                  const thumb = assetThumbnails[asset.id];
                  return (
                    <div
                      key={asset.id}
                      className="p-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] flex items-center gap-2.5 group"
                    >
                      {/* Thumbnail */}
                      <div className="w-10 h-10 rounded bg-black/40 overflow-hidden shrink-0 flex items-center justify-center border border-[var(--color-line)]">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Icon icon={ImageIcon} size={16} className="text-[var(--color-text-3)]" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[var(--color-text)] truncate">
                          {asset.name}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-3)] font-mono">
                          {asset.width && asset.height
                            ? `${asset.width}×${asset.height} · ${asset.role}`
                            : asset.role}
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        aria-label={`Remove asset ${asset.name}`}
                        onClick={() => removeAsset(asset.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-3)] hover:text-[var(--color-danger)] rounded hover:bg-[var(--color-hover)] transition-all"
                      >
                        <Icon icon={Trash2} size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </aside>
  );
};
