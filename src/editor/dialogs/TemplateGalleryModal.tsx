import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Icon,
  IconButton,
  Input,
  Tabs,
  TabsContent,
  TabsList,
} from "../../ui";
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
import { GalleryFooter } from "./GalleryFooter";
import { useUserTemplates } from "./useUserTemplates";
import { Search, X } from "lucide-react";

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

  const categories: { id: GalleryCategory; label: string }[] = [
    { id: "all", label: "All" },
    { id: "desktop", label: TEMPLATE_CATEGORY_LABELS.desktop },
    { id: "mobile", label: TEMPLATE_CATEGORY_LABELS.mobile },
    // Saved templates get their own tab, shown once there is one.
    ...(userTemplates.templates.length > 0 ? [{ id: "yours" as const, label: "Yours" }] : []),
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
        // Important, so they win over DialogContent's own width and padding: Tailwind orders
        // utilities for the same property by name, not by their order in the class list.
        className="max-w-5xl! p-0! h-[85vh] flex flex-col overflow-hidden"
      >
        <Tabs
          value={category}
          onValueChange={(value) => setActiveCategory(value as GalleryCategory)}
          className="flex-1 min-h-0 flex flex-col"
        >
          {/* Header; the close button floats in its top-right corner. */}
          <div className="shrink-0 px-6 pt-5 pb-4 flex flex-col gap-4">
            <div className="pr-8">
              <DialogTitle className="text-[16px] font-semibold tracking-tight text-[var(--color-text)]">
                Template gallery
              </DialogTitle>
              <DialogDescription className="mt-1 text-[13px] text-[var(--color-text-2)]">
                Curated motion layouts for presenting websites.
              </DialogDescription>
            </div>

            <div className="flex items-center justify-between gap-4">
              {/* Fitted to its tabs, each at least 88 px, rather than the full width. */}
              <TabsList items={categories} className="w-auto! min-w-0 [&>button]:min-w-[88px]" />
              <div className="relative w-60 shrink-0">
                <Icon
                  icon={Search}
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-2)]"
                />
                <Input
                  placeholder="Search templates"
                  aria-label="Search templates"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8! pr-8!"
                />
                {searchQuery && (
                  <IconButton
                    size="xs"
                    aria-label="Clear search"
                    icon={<Icon icon={X} size={13} />}
                    onClick={() => setSearchQuery("")}
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Templates grid. Its padding leaves room for a selected tile's ring and focus outline. */}
          <TabsContent
            value={category}
            className="flex-1 min-h-0 overflow-y-auto px-6 pt-2! pb-6 focus-visible:ring-inset"
          >
            {filteredTemplates.length === 0 && filteredUserTemplates.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <p className="text-[13px] font-medium text-[var(--color-text)]">
                  No templates found
                </p>
                <p className="mt-1 text-[12px] text-[var(--color-text-2)]">
                  Try another category or search
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-6">
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
                      set((current) =>
                        on ? template.id : current === template.id ? null : current,
                      );
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <GalleryFooter
          template={selectedTemplate}
          userTemplate={selectedUserTemplate}
          reason={selectedValidation.valid ? undefined : selectedValidation.reason}
          fitting={fittingTemplate}
          canUseDemo={canUseDemo}
          onSwitch={(template) => setSelectedTemplateId(template.id)}
          onTryDemo={handleApplyWithDemo}
          onChooseScreenshots={handleChooseScreenshots}
          onApply={() => {
            if (selectedUserTemplate) handleApplyUserTemplate(selectedUserTemplate);
            else if (selectedTemplate) handleApply(selectedTemplate);
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
