import React from "react";
import clsx from "clsx";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export const Kbd: React.FC<KbdProps> = ({ children, className, ...props }) => {
  return (
    <kbd
      // A field chip in Geist Mono.
      className={clsx(
        "inline-flex items-center justify-center min-w-[18px] min-h-[18px] px-1.5 rounded-[5px]",
        "bg-field text-text-2 font-num text-[10.5px] leading-none font-medium tabular-nums select-none",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
};
