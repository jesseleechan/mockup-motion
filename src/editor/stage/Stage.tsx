import React, { useMemo, useRef, useState, useEffect } from "react";
import { EngineCanvas } from "../../engine/react/EngineCanvas";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { createEditorAssetProvider } from "../asset-provider";
import { BUILTIN_TEMPLATES, buildTemplate } from "../../templates";
import type { AssetRef } from "../../doc/types";
import { Button, Icon } from "../../ui";
import { Film, LayoutTemplate, Sparkles, UploadCloud } from "lucide-react";

interface StageProps {
  showSafeMargins: boolean;
  onOpenTemplates?: () => void;
}

const DEMO_ASSETS: AssetRef[] = [
  {
    id: "/demo/aurelia/desktop-hero.webp",
    name: "Aurelia Desktop Hero",
    kind: "image",
    mime: "image/webp",
    bytes: 348640,
    role: "desktop",
    width: 2880,
    height: 1800,
  },
  {
    id: "/demo/aurelia/mobile-hero.webp",
    name: "Aurelia Mobile Hero",
    kind: "image",
    mime: "image/webp",
    bytes: 159248,
    role: "mobile",
    width: 780,
    height: 1688,
  },
];

function aspectToRatio(aspect: string): number {
  switch (aspect) {
    case "16:9":
      return 16 / 9;
    case "9:16":
      return 9 / 16;
    case "1:1":
      return 1;
    case "4:5":
      return 4 / 5;
    case "4:3":
      return 4 / 3;
    default:
      return 16 / 9;
  }
}

export const Stage: React.FC<StageProps> = ({ showSafeMargins, onOpenTemplates }) => {
  const doc = useEditorStore((s) => s.doc);
  const applyTemplateResult = useEditorStore((s) => s.applyTemplateResult);
  const addAssets = useEditorStore((s) => s.addAssets);

  const stageZoom = useUIStore((s) => s.stageZoom);
  const provider = useMemo(() => createEditorAssetProvider(), []);

  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = React.useCallback(
    async (files: File[]) => {
      const newRefs: AssetRef[] = [];
      const blobs: Record<string, Blob> = {};

      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const assetId = crypto.randomUUID();
        blobs[assetId] = file;

        // Extract image dimensions
        let width = 1920;
        let height = 1080;
        try {
          const bmp = await createImageBitmap(file);
          width = bmp.width;
          height = bmp.height;
          bmp.close();
        } catch {
          // use fallback dimensions
        }

        const isMobile = height / width > 1.2;
        const isTall = height / width > 2.0;

        newRefs.push({
          id: assetId,
          name: file.name,
          kind: "image",
          mime: file.type || "image/png",
          bytes: file.size,
          role: isMobile ? "mobile" : "desktop",
          width,
          height,
          meta: { tall: isTall },
        });
      }

      if (newRefs.length > 0) {
        await addAssets(newRefs, blobs);

        // If document currently has no shots, apply default template with new assets
        if (doc.shots.length === 0) {
          const template = BUILTIN_TEMPLATES[0];
          const res = buildTemplate(template, {
            aspect: doc.aspect,
            assets: [...doc.assets, ...newRefs],
            name: doc.name,
            style: doc.style,
          });
          applyTemplateResult(res, template.id);
        }
      }
    },
    [addAssets, applyTemplateResult, doc.aspect, doc.assets, doc.name, doc.shots.length, doc.style],
  );

  // Global drag-and-drop listener
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDragOver(true);
      }
    };

    const onDragLeave = (e: DragEvent) => {
      // If leaving window
      if (!e.relatedTarget) {
        setIsDragOver(false);
      }
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        await handleFiles(Array.from(e.dataTransfer.files));
      }
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFiles]);

  const handleTryDemoContent = async () => {
    await addAssets(DEMO_ASSETS);
    const template = BUILTIN_TEMPLATES[0]; // Hero Drift
    const res = buildTemplate(template, {
      aspect: doc.aspect,
      assets: DEMO_ASSETS,
      name: doc.name,
      style: doc.style,
    });
    applyTemplateResult(res, template.id);
  };

  const ratio = aspectToRatio(doc.aspect);
  const isVertical = doc.aspect === "9:16" || doc.aspect === "4:5";

  return (
    <div className="relative flex-1 w-full h-full bg-[var(--color-stage)] p-8 flex items-center justify-center overflow-hidden select-none">
      {/* Hidden file input for file picker button */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          if (e.target.files) {
            await handleFiles(Array.from(e.target.files));
          }
        }}
      />

      {/* Empty State Card if no assets or shots */}
      {doc.shots.length === 0 || (doc.assets.length === 0 && !doc.templateId) ? (
        <div className="z-10 max-w-md w-full bg-[var(--color-panel)] border border-[var(--color-line)] p-8 rounded-xl shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)] flex items-center justify-center shadow-xs">
            <Icon icon={Film} size={26} />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-[var(--color-text)] tracking-tight">
              Create Motion Mockups
            </h2>
            <p className="text-xs text-[var(--color-text-2)] leading-relaxed">
              Transform static screenshots into smooth, photorealistic 3D camera animations.
            </p>
          </div>

          <div className="space-y-2.5">
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={onOpenTemplates}
              icon={<Icon icon={LayoutTemplate} size={15} />}
            >
              Start with a template
            </Button>

            <Button
              variant="secondary"
              className="w-full justify-center"
              onClick={() => fileInputRef.current?.click()}
              icon={<Icon icon={UploadCloud} size={15} />}
            >
              Drop screenshots
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-center text-[var(--color-accent)]"
              onClick={handleTryDemoContent}
              icon={<Icon icon={Sparkles} size={15} />}
            >
              Try with demo content
            </Button>
          </div>
        </div>
      ) : (
        /* Canvas Stage Output Boundary */
        <div
          className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-180"
          style={{
            aspectRatio: `${ratio}`,
            width: stageZoom === 0.5 ? "50%" : stageZoom > 1 ? "100%" : "auto",
            height: stageZoom === 0.5 ? "50%" : stageZoom > 1 ? "100%" : "auto",
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        >
          <div className="relative w-full h-full border border-[var(--color-line)] rounded-sm overflow-hidden shadow-2xl bg-black">
            <EngineCanvas doc={doc} assets={provider} />

            {/* Safe Margins Overlay */}
            {showSafeMargins && (
              <div className="absolute inset-0 pointer-events-none z-10">
                {/* 7% perimeter margin */}
                <div className="absolute inset-[7%] border border-dashed border-[var(--color-accent)]/50 rounded-xs flex items-center justify-center">
                  <span className="absolute top-1 left-1.5 text-[9px] font-mono text-[var(--color-accent)]/70 uppercase">
                    7% Safe Margin
                  </span>

                  {/* 80% central vertical safe area for 9:16 and 4:5 */}
                  {isVertical && (
                    <div className="w-full h-[80%] border border-[var(--color-danger)]/60 bg-[var(--color-danger)]/5 rounded-xs flex items-center justify-center">
                      <span className="text-[10px] font-mono text-[var(--color-danger)]/80 uppercase font-semibold">
                        80% Action Area
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Drag-and-drop Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-[var(--color-bg)]/80 backdrop-blur-xs border-2 border-dashed border-[var(--color-accent)] flex flex-col items-center justify-center gap-3 animate-in fade-in duration-100">
          <div className="w-14 h-14 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] flex items-center justify-center animate-bounce">
            <Icon icon={UploadCloud} size={30} />
          </div>
          <div className="text-base font-semibold text-[var(--color-text)]">
            Drop screenshots anywhere to add
          </div>
          <div className="text-xs text-[var(--color-text-2)]">
            PNG, WebP, JPG up to 8K resolution
          </div>
        </div>
      )}
    </div>
  );
};
