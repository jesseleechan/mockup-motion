import React, { useState } from "react";
import { Tabs, TabsList, TabsContent, Button, Icon, Tooltip } from "../../ui";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { BUILTIN_TEMPLATES, validateTemplateRequirements } from "../../templates";
import { useTemplateActions } from "../template-actions";
import { MediaTab } from "./MediaTab";
import { BrandTab } from "./BrandTab";
import { UserTemplatesSection } from "./UserTemplatesSection";
import { templatePosterUrl } from "./template-media";
import { CaptureHelpModal } from "../dialogs/CaptureHelpModal";
import { SaveTemplateModal } from "../dialogs/SaveTemplateModal";
import {
  BookmarkPlus,
  Camera,
  Film,
  FolderOpen,
  Palette,
  PanelLeftClose,
  Sparkles,
} from "lucide-react";

export const LibraryPanel: React.FC = () => {
  const doc = useEditorStore((s) => s.doc);
  const togglePanel = useUIStore((s) => s.togglePanel);
  const openTemplateGallery = useUIStore((s) => s.openTemplateGallery);
  const { applyTemplateById } = useTemplateActions();

  const [activeTab, setActiveTab] = useState<string>("templates");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [captureModalOpen, setCaptureModalOpen] = useState(false);
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);

  const categories = ["all", "single", "mobile", "portfolio"];
  const filteredTemplates = BUILTIN_TEMPLATES.filter(
    (t) => selectedCategory === "all" || t.category === selectedCategory,
  );

  return (
    <aside
      data-panel="library"
      className="w-[280px] bg-[var(--color-panel)] border-r border-[var(--color-line)] flex flex-col shrink-0 select-none z-20 overflow-hidden"
    >
      {/* Dialogs */}
      <CaptureHelpModal open={captureModalOpen} onOpenChange={setCaptureModalOpen} />
      <SaveTemplateModal open={saveTemplateModalOpen} onOpenChange={setSaveTemplateModalOpen} />

      {/* Header with quick tools and collapse button */}
      <div className="h-10 px-3 border-b border-[var(--color-line)] flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-text)]">Library</span>

        <div className="flex items-center gap-1">
          <Tooltip content="Capture website screenshots">
            <button
              type="button"
              onClick={() => setCaptureModalOpen(true)}
              aria-label="Capture website screenshots"
              className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-accent)] hover:bg-[var(--color-hover)] rounded transition-colors"
            >
              <Icon icon={Camera} size={14} />
            </button>
          </Tooltip>

          <Tooltip content="Save project as template">
            <button
              type="button"
              onClick={() => setSaveTemplateModalOpen(true)}
              aria-label="Save as template"
              className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-accent)] hover:bg-[var(--color-hover)] rounded transition-colors"
            >
              <Icon icon={BookmarkPlus} size={14} />
            </button>
          </Tooltip>

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
      </div>

      {/* Tabs */}
      <div className="flex-1 flex flex-col min-h-0">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-3 pt-2">
            <TabsList
              items={[
                { id: "templates", label: "Templates", icon: <Icon icon={Film} size={13} /> },
                {
                  id: "media",
                  label: "Media",
                  badge: doc.assets.length,
                  icon: <Icon icon={FolderOpen} size={13} />,
                },
                { id: "brand", label: "Brand", icon: <Icon icon={Palette} size={13} /> },
              ]}
            />
          </div>

          {/* Templates Content */}
          <TabsContent value="templates" className="flex-1 flex flex-col min-h-0 px-3 pt-2">
            {/* Gallery Button & Category Chips */}
            <div className="flex items-center gap-1.5 pb-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                className="w-full mb-1"
                onClick={openTemplateGallery}
                icon={<Icon icon={Sparkles} size={13} className="text-[var(--color-accent)]" />}
              >
                Browse all templates
              </Button>
            </div>

            <div data-scroll-x className="flex items-center gap-1 overflow-x-auto pb-2 shrink-0">
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
                const validation = validateTemplateRequirements(template, doc.assets);
                const requiredSlots = template.slots.filter((s) => s.required);

                return (
                  <div
                    key={template.id}
                    // Like the gallery, applying never waits for screenshots (F06).
                    onClick={() => applyTemplateById(template.id)}
                    data-testid="library-template-card"
                    className="p-3 rounded-lg border transition-all border-[var(--color-line)] bg-[var(--color-raised)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-hover)] cursor-pointer group"
                  >
                    <img
                      src={templatePosterUrl(template.id)}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      className="block w-full aspect-video object-cover rounded-md border border-[var(--color-line)] mb-2.5 bg-[var(--color-bg)]"
                    />
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

                      {!validation.valid && (
                        <span className="text-[9px] text-[var(--color-text-3)] font-medium">
                          {validation.reason}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* User Saved Templates Section */}
              <UserTemplatesSection />
            </div>
          </TabsContent>

          {/* Media Content */}
          <TabsContent value="media" className="flex-1 flex flex-col min-h-0">
            <MediaTab />
          </TabsContent>

          {/* Brand Content */}
          <TabsContent value="brand" className="flex-1 flex flex-col min-h-0">
            <BrandTab />
          </TabsContent>
        </Tabs>
      </div>
    </aside>
  );
};
