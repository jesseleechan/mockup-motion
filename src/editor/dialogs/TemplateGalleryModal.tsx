import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button, Icon } from "../../ui";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import {
  BUILTIN_TEMPLATES,
  demoAssetsToFill,
  fittingTemplateId,
  getTemplateById,
  templateInCategory,
  validateTemplateRequirements,
  type Template,
  type TemplateCategory,
} from "../../templates";
import { TEMPLATE_CATEGORY_LABELS } from "../labels";
import { currentTemplate, useTemplateActions } from "../template-actions";
import { TemplateCard } from "./TemplateCard";
import { fillUserTemplateSlots, type UserTemplate } from "../../storage/user-templates";
import { UserTemplateCard } from "./UserTemplateCard";
import { useUserTemplates } from "./useUserTemplates";
import {
  Bookmark,
  Film,
  Monitor,
  Search,
  Smartphone,
  Sparkles,
  UploadCloud,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";

/** The gallery's tabs: the built-in categories, and the user's saved templates. */
type GalleryCategory = TemplateCategory | "all" | "yours";

/** Rendered once, in EditorShell; its open state lives in the UI store (F06). */
export const TemplateGalleryModal: React.FC = () => {
  const doc = useEditorStore((s) => s.doc);
  const open = useUIStore((s) => s.templateGalleryOpen);
  const closeTemplateGallery = useUIStore((s) => s.closeTemplateGallery);
  const requestScreenshotPicker = useUIStore((s) => s.requestScreenshotPicker);
  const applyTemplateResult = useEditorStore((s) => s.applyTemplateResult);
  const userTemplates = useUserTemplates(open);
  const { applyTemplateById, applyTemplateWithDemo } = useTemplateActions();
  const onOpenChange = (next: boolean) => {
    if (!next) closeTemplateGallery();
  };

  const [activeCategory, setActiveCategory] = useState<GalleryCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  // A saved project may name a template that has since been removed; select the first one.
  // When every screenshot is the other size, start on that size's variant instead (Frames plan §8).
  const initialTemplateId = () => {
    const id = currentTemplate(doc)?.id ?? BUILTIN_TEMPLATES[0].id;
    return fittingTemplateId(id, doc.assets) ?? id;
  };
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplateId);
  const [hoveredTemplateId, setHoveredTemplateId] = useState<string | null>(null);
  const [focusedTemplateId, setFocusedTemplateId] = useState<string | null>(null);

  // The modal stays mounted between openings, so each opening starts on the current template.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      // A saved template the project uses stays selected on Yours; otherwise Yours would show
      // no selection while Apply used a built-in template.
      const saved = userTemplates.templates.find((t) => t.id === doc.templateId);
      if (saved) {
        setSelectedTemplateId(saved.id);
      } else {
        setSelectedTemplateId(initialTemplateId());
        if (activeCategory === "yours") setActiveCategory("all");
      }
    }
  }

  const categories: { id: GalleryCategory; label: string; icon: LucideIcon }[] = [
    { id: "all", label: "All", icon: Sparkles },
    { id: "desktop", label: TEMPLATE_CATEGORY_LABELS.desktop, icon: Monitor },
    { id: "mobile", label: TEMPLATE_CATEGORY_LABELS.mobile, icon: Smartphone },
    // Saved templates get their own tab, shown once there is one.
    ...(userTemplates.templates.length > 0
      ? [{ id: "yours" as const, label: "Yours", icon: Bookmark }]
      : []),
  ];
  // Deleting the last saved template removes the "Yours" tab.
  const category =
    activeCategory === "yours" && userTemplates.templates.length === 0 ? "all" : activeCategory;

  const matchesQuery = (t: { name: string; description: string }) =>
    searchQuery.trim() === "" ||
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase());
  const filteredTemplates =
    category === "yours"
      ? []
      : BUILTIN_TEMPLATES.filter((t) => templateInCategory(t, category) && matchesQuery(t));
  const filteredUserTemplates =
    category === "yours" ? userTemplates.templates.filter(matchesQuery) : [];

  const selectedTemplate = BUILTIN_TEMPLATES.find((t) => t.id === selectedTemplateId);
  const selectedUserTemplate = userTemplates.templates.find((t) => t.id === selectedTemplateId);
  const selectedValidation = selectedTemplate
    ? validateTemplateRequirements(selectedTemplate, doc.assets)
    : { valid: true };
  // The selected preset's other size, when that one matches the screenshots.
  const fittingTemplate = selectedTemplate
    ? getTemplateById(fittingTemplateId(selectedTemplate.id, doc.assets) ?? "")
    : undefined;

  // Applying never waits for screenshots: the stage asks for any the template is missing.
  const handleApply = (template: Template) => {
    applyTemplateById(template.id);
    closeTemplateGallery();
  };

  // Offered while the selected template is missing screenshots the demo content can fill.
  const canUseDemo = selectedTemplate
    ? demoAssetsToFill(selectedTemplate, doc.assets).length > 0
    : false;
  // Applies the template, then opens the stage's file picker: the uploads fill it (F06).
  const handleChooseScreenshots = (template: Template) => {
    handleApply(template);
    requestScreenshotPicker();
  };
  const handleApplyWithDemo = async (template: Template) => {
    closeTemplateGallery();
    await applyTemplateWithDemo(template);
  };
  // A saved template fills its slots from the library by role.
  const handleApplyUserTemplate = (template: UserTemplate) => {
    applyTemplateResult(fillUserTemplateSlots(template, doc.assets, doc.aspect), template.id);
    closeTemplateGallery();
  };
  const handleDeleteUserTemplate = async (template: UserTemplate) => {
    await userTemplates.remove(template.id);
    if (selectedTemplateId === template.id) setSelectedTemplateId(initialTemplateId());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Radix closes on Escape before the rename field sees it; there, Escape cancels the rename.
        onEscapeKeyDown={(e) => {
          if ((e.target as HTMLElement | null)?.closest("[data-rename-input]")) e.preventDefault();
        }}
        // Focus starts on the selected card, the one Apply uses, rather than the close button.
        onOpenAutoFocus={(e) => {
          const card = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>(
            `[data-template-id="${selectedTemplateId}"]`,
          );
          if (!card) return;
          e.preventDefault();
          card.focus({ preventScroll: true });
        }}
        className="max-w-5xl! h-[85vh] flex flex-col p-0 overflow-hidden bg-[var(--color-bg)] border border-[var(--color-line)] shadow-2xl rounded-xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-line)] flex items-center justify-between bg-[var(--color-panel)] shrink-0">
          <div>
            <DialogTitle className="text-base font-semibold text-[var(--color-text)] flex items-center gap-2">
              <Icon icon={Sparkles} size={18} className="text-[var(--color-accent)]" />
              Template gallery
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--color-text-2)] mt-0.5">
              Curated motion layouts for presenting websites.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative w-56">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-3)]"
              />
              <input
                type="text"
                placeholder="Search templates"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs bg-[var(--color-raised)] border border-[var(--color-line)] rounded-lg text-[var(--color-text)] placeholder-[var(--color-text-3)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-3)] hover:text-[var(--color-text)]"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="px-6 py-2.5 border-b border-[var(--color-line)] flex items-center gap-1.5 bg-[var(--color-panel)] shrink-0 overflow-x-auto">
          {categories.map((cat) => {
            const IconComponent = cat.icon;
            const isSelected = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                aria-pressed={isSelected}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? "bg-[var(--color-raised)] text-[var(--color-text)] border border-[var(--color-line-strong)] shadow-sm"
                    : "text-[var(--color-text-2)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]"
                }`}
              >
                <Icon icon={IconComponent} size={13} />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-[var(--color-bg)]">
          {filteredTemplates.length === 0 && filteredUserTemplates.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center">
              <Film size={32} className="text-[var(--color-text-3)] mb-2 opacity-50" />
              <p className="text-sm font-medium text-[var(--color-text-2)]">No templates found</p>
              <p className="text-xs text-[var(--color-text-3)] mt-1">
                Try another category or search
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUserTemplates.map((template) => (
                <UserTemplateCard
                  key={template.id}
                  template={template}
                  selected={selectedTemplateId === template.id}
                  active={doc.templateId === template.id}
                  onSelect={() => setSelectedTemplateId(template.id)}
                  onRename={(name) => userTemplates.rename(template.id, name)}
                  onDelete={() => handleDeleteUserTemplate(template)}
                />
              ))}
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  assets={doc.assets}
                  selected={selectedTemplateId === template.id}
                  active={doc.templateId === template.id}
                  // The selected card always plays, so something moves as soon as the gallery opens.
                  previewing={
                    selectedTemplateId === template.id ||
                    hoveredTemplateId === template.id ||
                    focusedTemplateId === template.id
                  }
                  onSelect={() => setSelectedTemplateId(template.id)}
                  onPreviewChange={(reason, on) => {
                    const set = reason === "hover" ? setHoveredTemplateId : setFocusedTemplateId;
                    set((current) => (on ? template.id : current === template.id ? null : current));
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer with Apply Action */}
        <div className="px-6 py-3.5 border-t border-[var(--color-line)] bg-[var(--color-panel)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {selectedUserTemplate && (
              <span className="text-xs font-medium text-[var(--color-text)]">
                Selected: {selectedUserTemplate.name}
              </span>
            )}
            {selectedTemplate && (
              <>
                <span className="text-xs font-medium text-[var(--color-text)]">
                  Selected: {selectedTemplate.name}
                </span>
                {fittingTemplate ? (
                  <span
                    data-testid="template-size-hint"
                    className="text-xs text-[var(--color-text-2)] flex items-center gap-1.5"
                  >
                    {fittingTemplate.name} fits your screenshots.
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateId(fittingTemplate.id)}
                      aria-label={`Switch to ${fittingTemplate.name}`}
                      className="font-medium text-[var(--color-accent)] hover:underline focus-visible:outline-none focus-visible:underline"
                    >
                      Switch
                    </button>
                  </span>
                ) : (
                  !selectedValidation.valid && (
                    <span className="text-xs text-[var(--color-accent)] font-medium">
                      ({selectedValidation.reason})
                    </span>
                  )
                )}
              </>
            )}
          </div>

          {/* The close button and Escape cancel, so the footer has room for the ways in. */}
          <div className="flex items-center gap-2">
            {selectedTemplate && canUseDemo && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => handleChooseScreenshots(selectedTemplate)}
                  icon={<Icon icon={UploadCloud} size={14} />}
                >
                  Choose screenshots
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleApplyWithDemo(selectedTemplate)}
                  icon={<Icon icon={Wand2} size={14} />}
                >
                  Try with demo content
                </Button>
              </>
            )}
            <Button
              variant="primary"
              disabled={!selectedTemplate && !selectedUserTemplate}
              onClick={() => {
                if (selectedUserTemplate) handleApplyUserTemplate(selectedUserTemplate);
                else if (selectedTemplate) handleApply(selectedTemplate);
              }}
              icon={<Icon icon={Sparkles} size={14} />}
            >
              Apply template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
