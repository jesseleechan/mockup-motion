import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button, Icon } from "../../ui";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { BUILTIN_TEMPLATES, validateTemplateRequirements, type Template } from "../../templates";
import { useTemplateActions } from "../template-actions";
import { Check, Film, Layers, Monitor, Play, Search, Smartphone, Sparkles, X } from "lucide-react";

/** Rendered once, in EditorShell; its open state lives in the UI store (F06). */
export const TemplateGalleryModal: React.FC = () => {
  const doc = useEditorStore((s) => s.doc);
  const open = useUIStore((s) => s.templateGalleryOpen);
  const closeTemplateGallery = useUIStore((s) => s.closeTemplateGallery);
  const { applyTemplateById } = useTemplateActions();
  const onOpenChange = (next: boolean) => {
    if (!next) closeTemplateGallery();
  };

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    doc.templateId || BUILTIN_TEMPLATES[0].id,
  );
  const [hoveredTemplateId, setHoveredTemplateId] = useState<string | null>(null);

  // The modal stays mounted between openings, so each opening starts on the current template.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSelectedTemplateId(doc.templateId || BUILTIN_TEMPLATES[0].id);
  }

  const categories = [
    { id: "all", label: "All", icon: Sparkles },
    { id: "single", label: "Single Shot", icon: Monitor },
    { id: "responsive", label: "Responsive", icon: Layers },
    { id: "mobile", label: "Mobile", icon: Smartphone },
    { id: "portfolio", label: "Portfolio", icon: Film },
    { id: "reel", label: "Reels", icon: Play },
  ];

  const filteredTemplates = BUILTIN_TEMPLATES.filter((t) => {
    const matchesCategory = activeCategory === "all" || t.category === activeCategory;
    const matchesQuery =
      searchQuery.trim() === "" ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const selectedTemplate = BUILTIN_TEMPLATES.find((t) => t.id === selectedTemplateId);
  const selectedValidation = selectedTemplate
    ? validateTemplateRequirements(selectedTemplate, doc.assets)
    : { valid: true };

  // Applying never waits for screenshots: the stage asks for any the template is missing.
  const handleApply = (template: Template) => {
    applyTemplateById(template.id);
    closeTemplateGallery();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden bg-[var(--color-bg)] border border-[var(--color-line)] shadow-2xl rounded-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-line)] flex items-center justify-between bg-[var(--color-panel)] shrink-0">
          <div>
            <DialogTitle className="text-base font-semibold text-[var(--color-text)] flex items-center gap-2">
              <Icon icon={Sparkles} size={18} className="text-[var(--color-accent)]" />
              Template Gallery
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--color-text-2)] mt-0.5">
              12 curated motion layouts tuned for high-impact product showcases.
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
                placeholder="Search templates..."
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
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
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
          {filteredTemplates.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center">
              <Film size={32} className="text-[var(--color-text-3)] mb-2 opacity-50" />
              <p className="text-sm font-medium text-[var(--color-text-2)]">No templates found</p>
              <p className="text-xs text-[var(--color-text-3)] mt-1">
                Try another category or search query
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => {
                const isSelected = selectedTemplateId === template.id;
                const isHovered = hoveredTemplateId === template.id;
                const validation = validateTemplateRequirements(template, doc.assets);
                const requiredSlots = template.slots.filter((s) => s.required);

                return (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    onMouseEnter={() => setHoveredTemplateId(template.id)}
                    onMouseLeave={() => setHoveredTemplateId(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setSelectedTemplateId(template.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Select template ${template.name}`}
                    className={`flex flex-col rounded-xl border transition-all text-left overflow-hidden group cursor-pointer ${
                      isSelected
                        ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20 bg-[var(--color-raised)]"
                        : "border-[var(--color-line)] bg-[var(--color-panel)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-raised)]"
                    }`}
                  >
                    {/* Media Preview Box */}
                    <div className="aspect-video w-full bg-[var(--color-raised)] relative overflow-hidden flex items-center justify-center border-b border-[var(--color-line)]">
                      {/* Video or Poster fallback */}
                      <video
                        src={`/templates/${template.id}.webm`}
                        poster={`/templates/${template.id}.webp`}
                        autoPlay={isHovered}
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          // Hide broken video and show fallback thumbnail
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />

                      {/* Fallback Graphic if no video exists yet */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-raised)] -z-10">
                        <Icon
                          icon={Film}
                          size={28}
                          className="text-[var(--color-text-3)] mb-1 opacity-60"
                        />
                        <span className="text-[11px] font-mono text-[var(--color-text-3)]">
                          {template.id}
                        </span>
                      </div>

                      {/* Top Badges */}
                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-black/60 backdrop-blur-md text-white/90 shadow-sm">
                          {template.defaultDuration}s
                        </span>

                        {doc.templateId === template.id && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-accent)] text-white flex items-center gap-1 shadow-sm">
                            <Check size={10} />
                            Active
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-xs font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                            {template.name}
                          </h4>
                          <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--color-text-3)]">
                            {template.category}
                          </span>
                        </div>

                        <p className="text-[11px] text-[var(--color-text-2)] leading-relaxed line-clamp-2 mb-3">
                          {template.description}
                        </p>
                      </div>

                      {/* Slots & Validation Status */}
                      <div className="pt-2 border-t border-[var(--color-line)] flex items-center justify-between">
                        <span className="text-[10px] text-[var(--color-text-3)]">
                          {requiredSlots.length === 0
                            ? "No media required"
                            : `${requiredSlots.length} slot${requiredSlots.length > 1 ? "s" : ""}`}
                        </span>

                        {!validation.valid && (
                          <span className="text-[10px] font-medium text-[var(--color-accent)]">
                            {validation.reason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with Apply Action */}
        <div className="px-6 py-3.5 border-t border-[var(--color-line)] bg-[var(--color-panel)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {selectedTemplate && (
              <>
                <span className="text-xs font-medium text-[var(--color-text)]">
                  Selected: {selectedTemplate.name}
                </span>
                {!selectedValidation.valid && (
                  <span className="text-xs text-[var(--color-accent)] font-medium">
                    ({selectedValidation.reason})
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!selectedTemplate}
              onClick={() => selectedTemplate && handleApply(selectedTemplate)}
              className="gap-1.5"
            >
              <Sparkles size={14} />
              Apply template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
