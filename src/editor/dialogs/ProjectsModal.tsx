import React, { useEffect, useRef, useState } from "react";
import { Button, Dialog, DialogContent, Icon, Spinner } from "../../ui";
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
import { Copy, Plus, Trash2, FolderOpen, Check, Edit2 } from "lucide-react";

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
        className="max-w-2xl"
      >
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs text-[var(--color-text-2)]">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </span>
          <Button
            size="sm"
            variant="secondary"
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
          <div className="py-12 text-center text-xs text-[var(--color-text-3)]">
            No saved projects found.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {projects.map((p) => {
              const isCurrent = p.id === currentDoc.id;
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
                  onClick={() => handleSelect(p.id)}
                  data-testid="project-card"
                  data-project-id={p.id}
                  className={`flex flex-col rounded-lg border overflow-hidden cursor-pointer transition-all group ${
                    isCurrent
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                      : "border-[var(--color-line)] hover:border-[var(--color-line-strong)] bg-[var(--color-raised)] hover:bg-[var(--color-hover)]"
                  }`}
                >
                  {/* Thumbnail / Poster */}
                  <div className="w-full aspect-video bg-black/60 relative flex items-center justify-center overflow-hidden border-b border-[var(--color-line)]">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Icon
                        icon={isCurrent ? Check : FolderOpen}
                        size={28}
                        className={
                          isCurrent ? "text-[var(--color-accent)]" : "text-[var(--color-text-3)]"
                        }
                      />
                    )}
                    {isCurrent && (
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-[var(--color-accent)] text-black font-semibold text-[9px] uppercase tracking-wider">
                        Current
                      </span>
                    )}
                  </div>

                  {/* Info and Actions */}
                  <div className="p-2.5 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      {editingId === p.id ? (
                        <input
                          type="text"
                          autoFocus
                          value={editName}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRename(p.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          onBlur={() => handleSaveRename(p.id)}
                          className="w-full h-6 px-1.5 text-xs rounded border border-[var(--color-accent)] bg-[var(--color-panel)] text-[var(--color-text)] outline-none"
                        />
                      ) : (
                        <div className="text-xs font-semibold text-[var(--color-text)] truncate">
                          {p.name || "Untitled Project"}
                        </div>
                      )}
                      <div className="text-[10px] text-[var(--color-text-3)] mt-0.5">{dateStr}</div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        aria-label="Rename project"
                        title="Rename"
                        onClick={(e) => handleStartRename(e, p.id, p.name)}
                        className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel)] rounded transition-colors"
                      >
                        <Icon icon={Edit2} size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label="Duplicate project"
                        title="Duplicate"
                        onClick={(e) => handleDuplicate(e, p.id)}
                        className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel)] rounded transition-colors"
                      >
                        <Icon icon={Copy} size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete project"
                        title="Delete"
                        onClick={(e) => handleDelete(e, p.id)}
                        className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-danger)] hover:bg-[var(--color-panel)] rounded transition-colors"
                      >
                        <Icon icon={Trash2} size={13} />
                      </button>
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
