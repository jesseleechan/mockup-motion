import { useCallback, useEffect, useState } from "react";
import {
  deleteUserTemplate,
  listUserTemplates,
  renameUserTemplate,
  type UserTemplate,
} from "../../storage/user-templates";

/** Oldest first, the order they were saved in. */
function byAge(list: UserTemplate[]): UserTemplate[] {
  return [...list].sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * The templates the user saved ("Save as template"), oldest first. They are read each time
 * `open` turns true, so a template saved while the gallery was closed shows the next time it
 * opens.
 */
export function useUserTemplates(open: boolean) {
  const [templates, setTemplates] = useState<UserTemplate[]>([]);

  const refresh = useCallback(async () => {
    setTemplates(byAge(await listUserTemplates()));
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    listUserTemplates().then(
      (list) => {
        if (active) setTemplates(byAge(list));
      },
      (err: unknown) => console.error("[useUserTemplates] failed to read saved templates", err),
    );
    return () => {
      active = false;
    };
  }, [open]);

  const rename = async (id: string, name: string) => {
    await renameUserTemplate(id, name);
    await refresh();
  };

  const remove = async (id: string) => {
    await deleteUserTemplate(id);
    await refresh();
  };

  return { templates, rename, remove };
}
