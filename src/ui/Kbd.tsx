import React from "react";
import clsx from "clsx";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export const Kbd: React.FC<KbdProps> = ({ children, className, ...props }) => {
  return (
    <kbd
      className={clsx(
        "inline-flex items-center justify-center px-1.5 py-0.5 min-w-[20px] text-[10px] font-medium tracking-tight rounded-[4px]",
        "bg-[var(--color-raised)] text-[var(--color-text-2)] border border-[var(--color-line)] shadow-xs select-none ui-tabular",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
};
