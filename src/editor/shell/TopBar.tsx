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
  SegmentedControl,
  Tooltip,
} from "../../ui";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { duplicateProject } from "../../storage/projects";
import type { Aspect } from "../../doc/types";
import { changeAspect } from "../aspect";
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
  SunMoon,
  Undo2,
  Video,
  type LucideIcon,
} from "lucide-react";
import { browserStorage } from "../../export/last-settings";
import {
  THEME_LABELS,
  nextThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "./theme-preference";
import { Cluster, ClusterSeparator } from "./Cluster";

interface TopBarProps {
  onOpenProjects: () => void;
  onOpenShortcuts: () => void;
  onOpenExport: () => void;
}

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];

/** The menu shows the current preference; choosing it moves to the next. */
const THEME_ICONS: Record<ThemePreference, LucideIcon> = {
  system: SunMoon,
  light: Sun,
  dark: Moon,
};

/**
 * The project's saved state: a dot, named for screen readers and on hover. A failed save stays
 * in words, as it needs the user's attention.
 */
const SaveStatus: React.FC = () => {
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const saveError = useEditorStore((s) => s.saveError);

  if (saveStatus === "error") {
    return (
      <span
        data-testid="save-error"
        role="status"
        className="hidden sm:block shrink-0 px-2 text-[11px] font-medium text-[var(--color-danger)] whitespace-nowrap"
      >
        {saveError?.toLowerCase().includes("storage") ? "Storage is full" : "Save failed"}
      </span>
    );
  }
  if (saveStatus === "idle") return null;
  const label = saveStatus === "saving" ? "Saving" : "Saved";
  return (
    <span title={label} className="hidden sm:flex shrink-0 items-center px-2.5 h-8">
      <span
        aria-hidden="true"
        className={
          saveStatus === "saving"
            ? "w-2 h-2 rounded-full bg-[var(--color-text-3)] animate-pulse"
            : "w-2 h-2 rounded-full bg-[var(--color-success)]"
        }
      />
      <span className="sr-only">{label}</span>
    </span>
  );
};

/**
 * The three floating clusters above the panels and the stage, as Layout Stage's top bar: the app
 * menu and the project on the left, history, aspect and theme in the centre, Export on the right.
 * The side columns share the room equally, so the centre cluster stays centred in the window.
 */
export const TopBar: React.FC<TopBarProps> = ({
  onOpenProjects,
  onOpenShortcuts,
  onOpenExport,
}) => {
  const doc = useEditorStore((s) => s.doc);
  const past = useEditorStore((s) => s.past);
  const future = useEditorStore((s) => s.future);
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

  // System → Light → Dark. EditorShell applies the preference to <html>.
  const handleCycleTheme = () => {
    const next = nextThemePreference(theme);
    setTheme(next);
    saveThemePreference(browserStorage(), next);
  };
  const nextThemeLabel = `Switch to ${THEME_LABELS[nextThemePreference(theme)]}`;

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
      // Frames shots take their preset's lanes at the new aspect, in the same undo step (D13).
      (draft) => changeAspect(draft, aspect),
      { label: `Change aspect to ${aspect}` },
    );
  };

  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 shrink-0 select-none z-30">
      {/* Left: the app menu, the project's name and its saved state */}
      <Cluster className="justify-self-start max-w-full">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 h-9 pl-2 pr-1.5 shrink-0 rounded-[10px] hover:bg-[var(--color-field)] text-[var(--color-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <div className="w-5 h-5 rounded bg-[var(--color-accent)] flex items-center justify-center text-[var(--color-accent-ink)] shadow-xs">
                <Icon icon={Video} size={13} />
              </div>
              {/* Under 1024 px, where the panels hide, the word steps aside for the project's name;
                  it stays the menu's accessible name. */}
              <span className="font-mark font-bold text-[13px] tracking-tight max-lg:sr-only">
                MockupMotion
              </span>
              <Icon icon={ChevronDown} size={12} className="text-[var(--color-text-2)]" />
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
              icon={<Icon icon={THEME_ICONS[theme]} size={14} />}
              onClick={handleCycleTheme}
              title={nextThemeLabel}
            >
              Theme: {THEME_LABELS[theme]}
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

        <ClusterSeparator />

        {/* The name sizes to its text up to a limit, and gives way first when the bar is tight. */}
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
          className="h-8 min-w-16 max-w-[240px] field-sizing-content px-2 bg-transparent text-[13px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-field)] focus:bg-[var(--color-paper)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] rounded-[9px] transition-colors truncate"
          title="Click to rename project"
        />

        <SaveStatus />
      </Cluster>

      {/* Centre: history, the aspect and the theme */}
      <Cluster className="justify-self-center">
        <Tooltip content="Undo (⌘Z)">
          <IconButton
            icon={<Icon icon={Undo2} size={15} />}
            aria-label="Undo"
            variant="ghost"
            disabled={past.length === 0}
            onClick={undo}
          />
        </Tooltip>
        <Tooltip content="Redo (⇧⌘Z)">
          <IconButton
            icon={<Icon icon={Redo2} size={15} />}
            aria-label="Redo"
            variant="ghost"
            disabled={future.length === 0}
            onClick={redo}
          />
        </Tooltip>

        {/* The only aspect control in the editor (F08). */}
        <div className="hidden md:flex items-center gap-1">
          <ClusterSeparator />
          <SegmentedControl
            aria-label="Aspect ratio"
            size="sm"
            value={doc.aspect}
            onChange={handleAspectChange}
            options={ASPECTS.map((aspect) => ({ value: aspect, label: aspect }))}
          />
        </div>

        <ClusterSeparator />
        <Tooltip content={nextThemeLabel}>
          <IconButton
            icon={<Icon icon={THEME_ICONS[theme]} size={15} />}
            aria-label={`Theme: ${THEME_LABELS[theme]}`}
            variant="ghost"
            onClick={handleCycleTheme}
          />
        </Tooltip>
      </Cluster>

      {/* Right: Export */}
      <Cluster className="justify-self-end">
        <Button variant="primary" onClick={onOpenExport} icon={<Icon icon={Download} size={14} />}>
          Export
        </Button>
      </Cluster>
    </header>
  );
};
