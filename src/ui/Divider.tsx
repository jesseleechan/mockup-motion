import React from "react";
import clsx from "clsx";

export interface DividerProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({ orientation = "horizontal", className }) => {
  return (
    <div
      role="separator"
      className={clsx(
        orientation === "horizontal" ? "w-full h-[1px] my-2" : "h-full w-[1px] mx-2",
        "bg-[var(--color-line)] shrink-0",
        className,
      )}
    />
  );
};
