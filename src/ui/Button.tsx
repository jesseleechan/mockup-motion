import React, { forwardRef } from "react";
import clsx from "clsx";
import { Tooltip } from "./Tooltip";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      loading = false,
      disabled = false,
      icon,
      iconRight,
      children,
      className,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={clsx(
          "inline-flex items-center justify-center font-medium select-none transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
          "disabled:opacity-40 disabled:pointer-events-none",
          // Sizes
          size === "sm" && "h-7 px-2.5 text-[12px] gap-1.5 rounded-sm",
          size === "md" && "h-8 px-3.5 text-[13px] gap-2 rounded-md",
          // Variants
          variant === "primary" && [
            "bg-[var(--color-text)] text-[var(--color-bg)] font-semibold shadow-xs",
            "hover:opacity-90 active:opacity-95",
          ],
          variant === "secondary" && [
            "bg-[var(--color-raised)] text-[var(--color-text)] border border-[var(--color-line)] shadow-xs",
            "hover:bg-[var(--color-hover)] hover:border-[var(--color-line-strong)] active:bg-[var(--color-raised)]",
          ],
          variant === "ghost" && [
            "bg-transparent text-[var(--color-text-2)]",
            "hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] active:bg-[var(--color-raised)]",
          ],
          variant === "danger" && [
            "bg-[var(--color-danger)] text-white shadow-xs",
            "hover:opacity-90 active:opacity-95",
          ],
          className,
        )}
        {...props}
      >
        {loading ? (
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {!loading && iconRight && <span className="shrink-0">{iconRight}</span>}
      </button>
    );
  },
);

Button.displayName = "Button";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon: React.ReactNode;
  tooltip?: string;
  shortcut?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      "aria-label": ariaLabel,
      variant = "ghost",
      size = "md",
      icon,
      tooltip,
      shortcut,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const btn = (
      <button
        ref={ref}
        aria-label={ariaLabel}
        disabled={disabled}
        className={clsx(
          "inline-flex items-center justify-center shrink-0 select-none transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
          "disabled:opacity-40 disabled:pointer-events-none",
          size === "sm" && "w-7 h-7 rounded-sm text-[12px]",
          size === "md" && "w-8 h-8 rounded-md text-[13px]",
          variant === "primary" && "bg-[var(--color-text)] text-[var(--color-bg)] hover:opacity-90",
          variant === "secondary" &&
            "bg-[var(--color-raised)] text-[var(--color-text)] border border-[var(--color-line)] hover:bg-[var(--color-hover)]",
          variant === "ghost" &&
            "bg-transparent text-[var(--color-text-2)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
          variant === "danger" && "bg-[var(--color-danger)] text-white hover:opacity-90",
          className,
        )}
        {...props}
      >
        {icon}
      </button>
    );

    if (tooltip) {
      return (
        <Tooltip content={tooltip} shortcut={shortcut}>
          {btn}
        </Tooltip>
      );
    }

    return btn;
  },
);

IconButton.displayName = "IconButton";
