import React, { useEffect, useRef, useState } from "react";
import { Button, Dialog, DialogContent, Icon, IconButton, Input, Spinner } from "../../ui";
import {
  deleteProject,
  duplicateProject,
  getThumb,
  listProjects,
  loadProject,
  saveProject,
} from "../../storage/projects";
import { useEditorStore } from "../../state/store";
import { useThumbnailRenderer } from "../thumbnails/context";
import { writeProjectThumbnail } from "../thumbnails/project-thumbnail";
import { ThumbnailCancelledError } from "../thumbnails/ThumbnailRenderer";
import { Copy, Plus, Trash2, FolderOpen, Edit2 } from "lucide-react";
import { ActiveBadge } from "./ActiveBadge";
import { tileFace, tileRoot } from "./tile";

interface ProjectsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function renameProjectInDB(id: string, name: string): Promise<void> {
  const doc = await loadProject(id);
  if (doc) {
    doc.name = name;
    doc.updatedAt = Date.now();
    await saveProject(doc);
  }
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({ open, onOpenChange }) => {
  const [projects, setProjects] = useState<{ id: string; name: string; updatedAt: number }[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const thumbnailsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    thumbnailsRef.current = thumbnails;
  }, [thumbnails]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const currentDoc = useEditorStore((s) => s.doc);
  const loadDoc = useEditorStore((s) => s.loadDoc);
  const newDoc = useEditorStore((s) => s.newDoc);
  const renderer = useThumbnailRenderer();

  const refreshProjects = async () => {
    const list = await listProjects();
    setProjects(list);
    const thumbs: Record<string, string> = {};
    for (const p of list) {
      const blob = await getThumb(p.id);
      if (blob) {
        thumbs[p.id] = URL.createObjectURL(blob);
      }
    }
    for (const url of Object.values(thumbnailsRef.current)) URL.revokeObjectURL(url);
    setThumbnails(thumbs);
  };

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const list = await listProjects();
        if (!active) return;
        setProjects(list);

        const thumbs: Record<string, string> = {};
        for (const p of list) {
          const blob = await getThumb(p.id);
          if (blob && active) {
            thumbs[p.id] = URL.createObjectURL(blob);
          }
        }
        if (!active) return;
        setThumbnails(thumbs);
        setLoading(false);

        // The open project's stored thumbnail can be up to 30 s old; show it as it is now.
        const doc = useEditorStore.getState().doc;
        if (renderer && list.some((p) => p.id === doc.id)) {
          const blob = await writeProjectThumbnail(renderer, doc);
          if (active) {
            setThumbnails((prev) => {
              const old = prev[doc.id];
              if (old) URL.revokeObjectURL(old);
              return { ...prev, [doc.id]: URL.createObjectURL(blob) };
            });
          }
        }
      } catch (err) {
        if (!(err instanceof ThumbnailCancelledError)) {
          console.error("[Projects] Failed to load projects", err);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      for (const url of Object.values(thumbnailsRef.current)) {
        URL.revokeObjectURL(url as string);
      }
    };
  }, [open, renderer]);

  const handleSelect = async (id: string) => {
    if (id === currentDoc.id) {
      onOpenChange(false);
      return;
    }
    const doc = await loadProject(id);
    if (doc) {
      loadDoc(doc);
      onOpenChange(false);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await duplicateProject(id);
    await refreshProjects();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this project? Unused media will be cleaned up.")) {
      await deleteProject(id);
      if (id === currentDoc.id) {
        newDoc();
      }
      await refreshProjects();
    }
  };

  const handleStartRename = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setEditingId(id);
    setEditName(name);
  };

  const handleSaveRename = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    await renameProjectInDB(id, trimmed);
    if (id === currentDoc.id) {
      useEditorStore.getState().apply((draft) => {
        draft.name = trimmed;
      });
    }
    setEditingId(null);
    await refreshProjects();
  };

  const handleCreateNew = () => {
    newDoc();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Your projects"
        description="Switch between projects, rename, duplicate, or delete."
        // Radix closes on Escape before the rename field sees it; there, Escape cancels the rename.
        onEscapeKeyDown={(e) => {
          if ((e.target as HTMLElement | null)?.closest("[data-rename-input]")) e.preventDefault();
        }}
        // Important, so it wins over DialogContent's own max-w-lg: Tailwind orders utilities for
        // the same property by name, not by their order in the class list.
        className="max-w-2xl!"
      >
        <div className="flex justify-between items-center mb-4">
          <span className="text-[12px] text-[var(--color-text-2)]">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </span>
          <Button
            size="sm"
            variant="primary"
            onClick={handleCreateNew}
            icon={<Icon icon={Plus} size={14} />}
          >
            New project
          </Button>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <Spinner />
          </div>
        ) : projects.length === 0 ? (
          <div className="py-12 rounded-[12px] border border-dashed border-[var(--color-line-strong)] text-center text-[12px] text-[var(--color-text-2)]">
            No saved projects found.
          </div>
        ) : (
          // The padding leaves room inside the scroll area for the open project's ring and a
          // focused face's outline (offset 4 px plus 2 px, tile.ts); the margin keeps the cards
          // where they were.
          <div className="grid grid-cols-3 gap-x-3 gap-y-4 max-h-[60vh] overflow-y-auto -m-2 p-2">
            {projects.map((p) => {
              const isCurrent = p.id === currentDoc.id;
              const name = p.name || "Untitled project";
              const thumbUrl = thumbnails[p.id];
              const dateStr = new Date(p.updatedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={p.id}
                  // A click anywhere on the card opens the project, the face's included. The face
                  // is the button that does it from the keyboard (Layout Stage's "Open" button);
                  // the caption's buttons sit beside it and stop their clicks.
                  onClick={() => handleSelect(p.id)}
                  data-testid="project-card"
                  data-project-id={p.id}
                  className={tileRoot}
                >
                  <button
                    type="button"
                    aria-label={`Open ${name}`}
                    aria-current={isCurrent ? "true" : undefined}
                    className={tileFace(isCurrent, "grid place-items-center cursor-pointer")}
                  >
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Icon icon={FolderOpen} size={24} className="text-[var(--color-text-2)]" />
                    )}
                    {isCurrent && (
                      <span className="absolute top-2 left-2">
                        <ActiveBadge label="Current" />
                      </span>
                    )}
                  </button>

                  <div className="px-0.5 flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0 flex-1">
                      {editingId === p.id ? (
                        <Input
                          autoFocus
                          aria-label="Project name"
                          data-rename-input
                          value={editName}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRename(p.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          onBlur={() => handleSaveRename(p.id)}
                          className="h-7! text-[12.5px]!"
                        />
                      ) : (
                        <div className="h-7 leading-7 text-[12.5px] font-semibold text-[var(--color-text)] truncate">
                          {name}
                        </div>
                      )}
                      <div className="text-[11px] text-[var(--color-text-2)] truncate">
                        {dateStr}
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                      <IconButton
                        size="xs"
                        aria-label="Rename project"
                        title="Rename"
                        icon={<Icon icon={Edit2} size={13} />}
                        onClick={(e) => handleStartRename(e, p.id, p.name)}
                      />
                      <IconButton
                        size="xs"
                        aria-label="Duplicate project"
                        title="Duplicate"
                        icon={<Icon icon={Copy} size={13} />}
                        onClick={(e) => handleDuplicate(e, p.id)}
                      />
                      <IconButton
                        size="xs"
                        aria-label="Delete project"
                        title="Delete"
                        icon={<Icon icon={Trash2} size={13} />}
                        onClick={(e) => handleDelete(e, p.id)}
                        className="hover:text-danger!"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
