import clsx from "clsx";

/**
 * Layout Stage's tiles (.tile and .tile-face in its globals.css), for the template and project
 * cards: a face at radius 12 with the hairline lift, and the caption under it. The tile itself
 * takes focus; its face shows the ring.
 */
export const tileRoot = "group flex flex-col gap-2 min-w-0 text-left cursor-pointer outline-none";

/**
 * The face. Selected, it is ringed in ink, as Layout Stage's --pick; hovered, in the strong line.
 * Keyboard focus adds the accent outline, 2 px clear of the ring.
 */
export function tileFace(selected: boolean, className?: string): string {
  return clsx(
    "relative aspect-video w-full overflow-hidden rounded-[12px] bg-field",
    "transition-shadow duration-120",
    "group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-accent",
    selected
      ? "shadow-[0_0_0_2px_var(--color-text)]"
      : "shadow-lift-sm group-hover:shadow-[0_0_0_1px_var(--color-line-strong)]",
    className,
  );
}
