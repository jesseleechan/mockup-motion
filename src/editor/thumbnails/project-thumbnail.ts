import type { ProjectDoc } from "../../doc/types";
import { schedule } from "../../motion";
import { putThumb } from "../../storage/projects";
import { PROJECT_THUMBNAIL_FRACTION } from "./docs";
import type { ThumbnailRenderer } from "./ThumbnailRenderer";

/** One debounce key per project, so a switch never merges two projects' requests. */
export function projectThumbnailKey(projectId: string): string {
  return `project:${projectId}`;
}

/** Renders the project at 35% of its total and stores it for the Projects dialog. */
export async function writeProjectThumbnail(
  renderer: ThumbnailRenderer,
  doc: ProjectDoc,
): Promise<Blob> {
  const { total } = schedule(doc);
  const blob = await renderer.renderBlob(
    doc,
    total * PROJECT_THUMBNAIL_FRACTION,
    doc.aspect,
    projectThumbnailKey(doc.id),
  );
  await putThumb(doc.id, blob);
  return blob;
}
