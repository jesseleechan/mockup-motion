import clsx from "clsx";

/**
 * The export dialog's surfaces, in Layout Stage's look (docs/restyle-plan/README.md, R4). The
 * dialog is a panel; wells on it are field, and controls are paper.
 */

/** A section heading: Layout Stage's group heading, in text-2 rather than its ink-3 (contrast). */
export const sectionHeading =
  "text-[10.5px] leading-[1.2] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-2)]";

/** A heading row with an optional note on the right, as Layout Stage's .group-head. */
export const sectionHead = "flex items-baseline justify-between gap-2 mb-2.5";

/** The note beside a heading, e.g. "Custom" or "2 files". */
export const sectionNote = "text-[11px] font-medium text-[var(--color-text-2)]";

const wellShape = "rounded-[12px] text-[12px] text-[var(--color-text-2)]";

/** A field well: the summary, the verification, the aspect hint. */
export const well = clsx(wellShape, "bg-field");

/**
 * The well for a file's verification: field, or the warning's notice tint when a check failed,
 * so a bad file stands out without a border. One background class or the other, never both:
 * for the same property, Tailwind's order (by name) would decide, not the class list.
 */
export function verificationWell(valid: boolean): string {
  return clsx(wellShape, "px-3.5 py-3", valid ? "bg-field" : "bg-[var(--color-warning)]/8");
}

export type NoticeTone = "warning" | "danger";

/**
 * A warning or an error, as Layout Stage's .cap-error: status text on a tint of its own colour.
 * The tint stays at 8%, where danger text keeps 4.5:1 on the light panel (10% gives 4.44);
 * tests/ui.test.ts holds it there.
 */
export function notice(tone: NoticeTone): string {
  return clsx(
    "rounded-[10px] px-3 py-2.5 flex items-start gap-2 text-[12px] font-medium leading-[1.4]",
    tone === "warning"
      ? "bg-[var(--color-warning)]/8 text-[var(--color-warning)]"
      : "bg-[var(--color-danger)]/8 text-[var(--color-danger)]",
  );
}

/** A download link drawn as the primary button (src/ui/Button.tsx), at `md` or `sm`. */
export function downloadLink(size: "md" | "sm"): string {
  return clsx(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold",
    "bg-text text-paper hover:brightness-115 transition-[filter] duration-120",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    size === "md"
      ? "h-8 px-3 gap-1.5 rounded-[10px] text-[12.5px]"
      : "h-7 px-2.5 gap-1.5 rounded-[9px] text-[12px]",
  );
}
