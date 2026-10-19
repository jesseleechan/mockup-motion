import type { Template, TemplateCategory } from "./types";

/** The gallery tabs a template sits under: its own size, or both for desktop + mobile ones. */
export function templateInCategory(
  template: Pick<Template, "category">,
  category: TemplateCategory | "all",
): boolean {
  return category === "all" || template.category === category || template.category === "both";
}
