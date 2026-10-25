import React, { forwardRef } from "react";
import clsx from "clsx";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Selected, as `aria-pressed`. Leave it out for a chip that is a plain action. */
  pressed?: boolean;
  icon?: React.ReactNode;
}

/**
 * Layout Stage's .chip: a 28 px field pill at radius 9. A pressed chip turns paper with an ink
 * ring, so the choice reads without colour.
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ pressed, icon, type = "button", className, children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={pressed}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 h-7 px-2.5 rounded-[9px] whitespace-nowrap select-none cursor-pointer",
        "text-[12px] transition-[background-color,box-shadow,color] duration-120",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:opacity-40 disabled:pointer-events-none",
        pressed
          ? "bg-paper text-text font-semibold shadow-[0_0_0_1.5px_var(--color-text)]"
          : "bg-field text-text-2 font-medium hover:text-text",
        className,
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  ),
);

Chip.displayName = "Chip";
