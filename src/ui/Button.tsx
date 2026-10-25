import React, { forwardRef } from "react";
import clsx from "clsx";
import { Tooltip } from "./Tooltip";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "xs" | "sm" | "md";
/** `lg` is Layout Stage's 36 px icon button; the smaller sizes match the buttons. */
export type IconButtonSize = ButtonSize | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const BASE = [
  "select-none transition-[background-color,box-shadow,color,filter] duration-120",
  // An aria-disabled button stays focusable to show why; it keeps the not-allowed cursor.
  "cursor-pointer aria-disabled:cursor-not-allowed",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  "disabled:opacity-40 disabled:pointer-events-none",
].join(" ");

// Layout Stage's .btn (docs/restyle-plan/README.md, R3): 32, 28 and 24 px at radius 10, 9 and 7.
const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: "h-8 px-3 text-[12.5px] gap-1.5 rounded-[10px]",
  sm: "h-7 px-2.5 text-[12px] gap-1.5 rounded-[9px]",
  xs: "h-6 px-2 text-[11.5px] gap-1 rounded-[7px]",
};

const ICON_BUTTON_SIZES: Record<IconButtonSize, string> = {
  lg: "w-9 h-9 rounded-[10px]",
  md: "w-8 h-8 rounded-[10px]",
  sm: "w-7 h-7 rounded-[9px]",
  xs: "w-6 h-6 rounded-[7px]",
};

/**
 * Primary is ink, the one main action. Secondary is paper with a hairline lift, ghost is bare
 * until hovered. Danger takes paper text, which keeps 4.5:1 on the danger fill in both themes
 * (white on the dark theme's #ff8297 was 2.4:1).
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-text text-paper hover:brightness-115 active:brightness-100",
  secondary: "bg-paper text-text shadow-lift-sm hover:shadow-lift-sm-hover",
  ghost: "bg-transparent text-text-2 hover:bg-field hover:text-text active:bg-field-2",
  danger: "bg-danger text-paper hover:brightness-110 active:brightness-100",
};

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
          "inline-flex items-center justify-center whitespace-nowrap font-semibold",
          BASE,
          BUTTON_SIZES[size],
          VARIANTS[variant],
          className,
        )}
        {...props}
      >
        {loading ? (
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        {children && <span className="min-w-0 truncate">{children}</span>}
        {!loading && iconRight && <span className="shrink-0">{iconRight}</span>}
      </button>
    );
  },
);

Button.displayName = "Button";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  variant?: ButtonVariant;
  size?: IconButtonSize;
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
          "inline-flex items-center justify-center shrink-0",
          BASE,
          ICON_BUTTON_SIZES[size],
          VARIANTS[variant],
          // A menu or popover it opened is still showing (Layout Stage's [aria-expanded]).
          variant === "ghost" && "aria-expanded:bg-field-2",
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
