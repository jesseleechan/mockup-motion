import React from "react";
import clsx from "clsx";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = "md", className }) => {
  const sizeClasses =
    size === "sm"
      ? "w-3.5 h-3.5 border-2"
      : size === "md"
        ? "w-5 h-5 border-2"
        : "w-7 h-7 border-[2.5px]";

  return (
    <div
      role="status"
      aria-label="Loading"
      className={clsx(
        "inline-block rounded-full border-current border-t-transparent animate-spin text-[var(--color-accent)]",
        sizeClasses,
        className,
      )}
    />
  );
};
