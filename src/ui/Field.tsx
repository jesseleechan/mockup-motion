import React from "react";
import clsx from "clsx";

export interface FieldProps {
  label: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
  className?: string;
  htmlFor?: string;
}

export const Field: React.FC<FieldProps> = ({ label, children, hint, className }) => {
  return (
    <div className={clsx("flex items-center gap-3 w-full", className)}>
      <div className="w-24 shrink-0 text-[12px] font-medium text-[var(--color-text-2)] select-none">
        <span>{label}</span>
        {hint && <div className="text-[10px] text-[var(--color-text-3)] font-normal">{hint}</div>}
      </div>
      <div className="grow min-w-0">{children}</div>
    </div>
  );
};
