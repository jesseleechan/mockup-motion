import React, { forwardRef } from "react";
import clsx from "clsx";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Numbers, sizes and codes: Geist Mono with tabular figures, like Layout Stage's .num. */
  numeric?: boolean;
}

/** A text or number field in Layout Stage's look: paper with the hairline lift, radius 9, 32 px. */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ numeric = false, type = "text", className, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={clsx(
        "h-8 w-full min-w-0 px-2.5 rounded-[9px] bg-paper text-text shadow-lift-sm",
        "placeholder:text-text-2 hover:shadow-lift-sm-hover transition-shadow duration-120",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:opacity-40 disabled:pointer-events-none",
        numeric ? "font-num text-[12px] tabular-nums" : "text-[13px] font-medium",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
