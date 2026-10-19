import { produce } from "immer";
import type { Aspect, ProjectDoc } from "../../doc/types";
import { changeAspect } from "../aspect";

/** The sizes one export can write: a site, Dribbble, an Instagram post and a Story. */
export const EXPORT_ASPECTS: readonly Aspect[] = ["16:9", "4:3", "4:5", "9:16"];

/** The size chips: the four export sizes, with the project's own aspect first if it isn't one. */
export function sizeChoices(projectAspect: Aspect): Aspect[] {
  return EXPORT_ASPECTS.includes(projectAspect)
    ? [...EXPORT_ASPECTS]
    : [projectAspect, ...EXPORT_ASPECTS];
}

/** Export order: the project's aspect first, then the chips' order. */
export function orderSizes(selected: readonly Aspect[], projectAspect: Aspect): Aspect[] {
  return sizeChoices(projectAspect)
    .filter((a) => selected.includes(a))
    .sort((a, b) => Number(b === projectAspect) - Number(a === projectAspect));
}

/**
 * The document as it renders at another aspect: a copy re-fitted the way "Switch to" re-fits
 * the project (changeAspect). The project itself never changes.
 */
export function docAtAspect(doc: ProjectDoc, aspect: Aspect): ProjectDoc {
  if (doc.aspect === aspect) return doc;
  return produce(doc, (draft) => changeAspect(draft, aspect));
}

/**
 * Exports one file per aspect, in order, one at a time. `onFile` receives each file as it
 * finishes, so it can be offered before the rest are rendered. An abort stops the queue
 * before the next file starts, and a result that finishes after the abort is not reported.
 * A failure stops the queue and rejects; files already reported stay reported.
 */
export async function runExportQueue<T>(
  aspects: readonly Aspect[],
  exportOne: (aspect: Aspect, index: number) => Promise<T>,
  onFile: (aspect: Aspect, result: T, index: number) => void,
  signal: AbortSignal,
): Promise<void> {
  for (const [index, aspect] of aspects.entries()) {
    if (signal.aborted) return;
    const result = await exportOne(aspect, index);
    if (signal.aborted) return;
    onFile(aspect, result, index);
  }
}
