import { useCallback } from "react";
import type { AssetRef, ProjectDoc } from "../doc/types";
import { useEditorStore, type TemplateResult } from "../state/store";
import { useUIStore } from "../state/ui-store";
import {
  BUILTIN_TEMPLATES,
  applyTemplate,
  demoAssetsToFill,
  emptyRequiredSlots,
  fullPageReplacements,
  getTemplateById,
  missingRequiredSlots,
  type SlotSpec,
  type Template,
} from "../templates";

/** The document's built-in template, if it has one. */
export function currentTemplate(doc: ProjectDoc): Template | undefined {
  return doc.templateId ? getTemplateById(doc.templateId) : undefined;
}

/** Required slots of the document's template that its assets cannot fill (F06). */
export function unfilledSlots(doc: ProjectDoc): SlotSpec[] {
  const template = currentTemplate(doc);
  return template ? missingRequiredSlots(template, doc.assets) : [];
}

/**
 * The document's template while it has empty required slots. Otherwise none, so adding
 * screenshots to a filled template never rebuilds its shots. A full-page slot holding a short
 * screenshot isn't empty: a new full-page screenshot takes its place instead
 * (`fullPageReplacements`).
 */
export function templateToFill(doc: ProjectDoc): Template | undefined {
  const template = currentTemplate(doc);
  return template && emptyRequiredSlots(template, doc.assets).length > 0 ? template : undefined;
}

/**
 * The template "Try with demo content" fills: the document's own, or on first run the gallery's
 * first entry (presets plan D1: Desktop Slider).
 */
export function demoContentTemplate(doc: ProjectDoc): Template {
  return currentTemplate(doc) ?? BUILTIN_TEMPLATES[0];
}

/** Template flows shared by the gallery, the library, the stage and the media tab. */
export function useTemplateActions() {
  const setSelection = useUIStore((s) => s.setSelection);

  const selectFirstShot = useCallback(
    (result: TemplateResult) => {
      const first = result.shots[0];
      if (first) setSelection({ kind: "shot", id: first.id });
    },
    [setSelection],
  );

  /** Keeps the assets and browser chrome, fills the slots and selects the first shot. */
  const applyTemplateById = useCallback(
    (templateId: string) => {
      const template = getTemplateById(templateId);
      if (!template) return;
      const { doc, applyTemplateResult } = useEditorStore.getState();
      const result = applyTemplate(template, doc);
      applyTemplateResult(result, template.id);
      selectFirstShot(result);
    },
    [selectFirstShot],
  );

  /** Adds screenshots; when a template is waiting for them, fills it in the same undo step. */
  const addScreenshots = useCallback(async (refs: AssetRef[], blobs?: Record<string, Blob>) => {
    const { doc, addAssets, addAssetsAndApplyTemplate } = useEditorStore.getState();
    const template = templateToFill(doc);
    if (template) {
      await addAssetsAndApplyTemplate(refs, template.id, (d) => applyTemplate(template, d), blobs);
      return;
    }
    const current = currentTemplate(doc);
    const replace = current ? fullPageReplacements(current, doc.assets, refs) : {};
    await addAssets(refs, blobs, Object.keys(replace).length > 0 ? replace : undefined);
  }, []);

  /**
   * Applies a template and fills its empty required slots with demo screenshots, in one step.
   * The selection stays as it is, as for "Try with demo content" on the stage.
   */
  const applyTemplateWithDemo = useCallback(async (template: Template) => {
    const { doc, addAssetsAndApplyTemplate } = useEditorStore.getState();
    await addAssetsAndApplyTemplate(demoAssetsToFill(template, doc.assets), template.id, (d) =>
      applyTemplate(template, d),
    );
  }, []);

  /** Demo screenshots for the empty required slots of the current (or default) template. */
  const fillWithDemoContent = useCallback(
    () => applyTemplateWithDemo(demoContentTemplate(useEditorStore.getState().doc)),
    [applyTemplateWithDemo],
  );

  return { applyTemplateById, applyTemplateWithDemo, addScreenshots, fillWithDemoContent };
}
