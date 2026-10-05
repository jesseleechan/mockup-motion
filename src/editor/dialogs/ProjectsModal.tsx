import React, { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, Icon, Spinner } from "../../ui";
import { deleteProject, duplicateProject, listProjects, loadProject } from "../../storage/projects";
import { useEditorStore } from "../../state/store";
import { Copy, Plus, Trash2, FolderOpen, Check } from "lucide-react";

interface ProjectsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({ open, onOpenChange }) => {
  const [projects, setProjects] = useState<{ id: string; name: string; updatedAt: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const currentDoc = useEditorStore((s) => s.doc);
  const loadDoc = useEditorStore((s) => s.loadDoc);
  const newDoc = useEditorStore((s) => s.newDoc);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const list = await listProjects();
      setProjects(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    let active = true;
    listProjects().then((list) => {
      if (active) {
        setProjects(list);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [open]);

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
    await fetchProjects();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this project?")) {
      await deleteProject(id);
      if (id === currentDoc.id) {
        newDoc();
      }
      await fetchProjects();
    }
  };

  const handleCreateNew = () => {
    newDoc();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Your Projects" description="Manage and switch between your local mockup projects." className="max-w-md">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs text-[var(--color-text-2)]">{projects.length} saved project(s)</span>
          <Button size="sm" variant="secondary" onClick={handleCreateNew} icon={<Icon icon={Plus} size={14} />}>
            New Project
          </Button>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center items-center">
            <Spinner />
          </div>
        ) : projects.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--color-text-3)]">
            No saved projects found.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
            {projects.map((p) => {
              const isCurrent = p.id === currentDoc.id;
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
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                    isCurrent
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                      : "border-[var(--color-line)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-raised)]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      icon={isCurrent ? Check : FolderOpen}
                      size={16}
                      className={isCurrent ? "text-[var(--color-accent)] shrink-0" : "text-[var(--color-text-3)] shrink-0"}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[var(--color-text)] truncate">{p.name || "Untitled Project"}</div>
                      <div className="text-[10px] text-[var(--color-text-3)]">{dateStr}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label="Duplicate project"
                      onClick={(e) => handleDuplicate(e, p.id)}
                      className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] rounded transition-colors"
                    >
                      <Icon icon={Copy} size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete project"
                      onClick={(e) => handleDelete(e, p.id)}
                      className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-danger)] hover:bg-[var(--color-hover)] rounded transition-colors"
                    >
                      <Icon icon={Trash2} size={13} />
                    </button>
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
