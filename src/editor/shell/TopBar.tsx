import React, { useState } from "react";
import {
  Button,
  IconButton,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Icon,
  Tooltip,
} from "../../ui";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { duplicateProject } from "../../storage/projects";
import type { Aspect } from "../../doc/types";
import {
  ChevronDown,
  Copy,
  Download,
  FilePlus,
  FolderOpen,
  HelpCircle,
  LayoutTemplate,
  Moon,
  Redo2,
  Sun,
  Undo2,
  Video,
} from "lucide-react";

interface TopBarProps {
  onOpenProjects: () => void;
  onOpenShortcuts: () => void;
  onOpenExport: () => void;
}

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];

export const TopBar: React.FC<TopBarProps> = ({
  onOpenProjects,
  onOpenShortcuts,
  onOpenExport,
}) => {
  const doc = useEditorStore((s) => s.doc);
  const past = useEditorStore((s) => s.past);
  const future = useEditorStore((s) => s.future);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const saveError = useEditorStore((s) => s.saveError);
  const apply = useEditorStore((s) => s.apply);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const newDoc = useEditorStore((s) => s.newDoc);
  const loadDoc = useEditorStore((s) => s.loadDoc);

  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const openTemplateGallery = useUIStore((s) => s.openTemplateGallery);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(doc.name);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNameValue(val);
    apply(
      (draft) => {
        draft.name = val;
      },
      { coalesceKey: "project-name" },
    );
  };

  const handleToggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("mockupmotion_theme", next);
    } catch {
      // ignore
    }
  };

  const handleDuplicate = async () => {
    try {
      const copy = await duplicateProject(doc.id);
      loadDoc(copy);
    } catch (err) {
      console.error("Duplicate failed", err);
    }
  };

  const handleAspectChange = (aspect: Aspect) => {
    apply(
      (draft) => {
        draft.aspect = aspect;
      },
      { label: `Change aspect to ${aspect}` },
    );
  };

  return (
    <header className="h-[52px] px-3.5 bg-[var(--color-panel)] border-b border-[var(--color-line)] flex items-center justify-between select-none shrink-0 z-30">
      {/* Left: Mark & Project Title & Save Status */}
      <div className="flex items-center gap-2.5 min-w-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 px-2 py-1 -ml-1 rounded-md hover:bg-[var(--color-hover)] text-[var(--color-text)] transition-colors focus-visible:outline-none"
            >
              <div className="w-5 h-5 rounded bg-[var(--color-accent)] flex items-center justify-center text-white shadow-xs">
                <Icon icon={Video} size={13} />
              </div>
              <span className="font-semibold text-xs tracking-tight">MockupMotion</span>
              <Icon icon={ChevronDown} size={12} className="text-[var(--color-text-3)]" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start">
            <DropdownMenuItem icon={<Icon icon={FilePlus} size={14} />} onClick={() => newDoc()}>
              New project
            </DropdownMenuItem>
            <DropdownMenuItem icon={<Icon icon={Copy} size={14} />} onClick={handleDuplicate}>
              Duplicate project
            </DropdownMenuItem>
            <DropdownMenuItem icon={<Icon icon={FolderOpen} size={14} />} onClick={onOpenProjects}>
              Projects
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<Icon icon={LayoutTemplate} size={14} />}
              onClick={openTemplateGallery}
            >
              Templates
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              icon={<Icon icon={theme === "dark" ? Sun : Moon} size={14} />}
              onClick={handleToggleTheme}
            >
              Theme: {theme === "dark" ? "Light" : "Dark"}
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<Icon icon={HelpCircle} size={14} />}
              shortcut="?"
              onClick={onOpenShortcuts}
            >
              Shortcuts
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-4 w-px bg-[var(--color-line)]" />

        {/* Project Name editable */}
        <div className="relative flex items-center min-w-0 max-w-[200px] sm:max-w-[280px]">
          <input
            type="text"
            aria-label="Project name"
            value={isEditingName ? nameValue : doc.name}
            onFocus={() => {
              setNameValue(doc.name);
              setIsEditingName(true);
            }}
            onBlur={() => setIsEditingName(false)}
            onChange={handleNameChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.currentTarget.blur();
              }
            }}
            className="w-full bg-transparent px-1.5 py-0.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-hover)] focus:bg-[var(--color-raised)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] rounded transition-colors truncate"
            title="Click to rename project"
          />
        </div>

        {/* Save Status indicator */}
        <div className="hidden sm:flex items-center text-[11px] text-[var(--color-text-3)]">
          {saveStatus === "saving" && <span>Saving</span>}
          {saveStatus === "saved" && <span className="text-[var(--color-text-3)]">Saved</span>}
          {saveStatus === "error" && (
            <span data-testid="save-error" role="status" className="text-[var(--color-danger)]">
              {saveError?.toLowerCase().includes("storage") ? "Storage is full" : "Save failed"}
            </span>
          )}
        </div>
      </div>

      {/* Center: Undo/Redo & Aspect Selector */}
      <div className="flex items-center gap-3">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5">
          <Tooltip content="Undo (⌘Z)">
            <IconButton
              icon={<Icon icon={Undo2} size={15} />}
              aria-label="Undo"
              variant="ghost"
              size="sm"
              disabled={past.length === 0}
              onClick={undo}
            />
          </Tooltip>
          <Tooltip content="Redo (⇧⌘Z)">
            <IconButton
              icon={<Icon icon={Redo2} size={15} />}
              aria-label="Redo"
              variant="ghost"
              size="sm"
              disabled={future.length === 0}
              onClick={redo}
            />
          </Tooltip>
        </div>

        {/* Aspect Chips */}
        <div className="hidden md:flex items-center bg-[var(--color-raised)] p-0.5 rounded-lg border border-[var(--color-line)]">
          {ASPECTS.map((asp) => {
            const isActive = doc.aspect === asp;
            return (
              <button
                key={asp}
                type="button"
                onClick={() => handleAspectChange(asp)}
                className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all ${
                  isActive
                    ? "bg-[var(--color-panel)] text-[var(--color-text)] shadow-xs"
                    : "text-[var(--color-text-2)] hover:text-[var(--color-text)]"
                }`}
              >
                {asp}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Export Button */}
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={onOpenExport}
          icon={<Icon icon={Download} size={14} />}
        >
          Export
        </Button>
      </div>
    </header>
  );
};
