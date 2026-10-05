import React from "react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { Icon } from "./Icon";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-[var(--color-line)] bg-[var(--color-panel)]/50",
        className,
      )}
    >
      {icon && (
        <div className="w-10 h-10 mb-3 rounded-full flex items-center justify-center bg-[var(--color-raised)] text-[var(--color-text-2)] border border-[var(--color-line)]">
          <Icon icon={icon} size={20} />
        </div>
      )}
      <h4 className="text-[14px] font-semibold text-[var(--color-text)] mb-1">{title}</h4>
      {description && (
        <p className="text-[12px] text-[var(--color-text-2)] max-w-xs mb-4">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};
