import React, { useState } from "react";
import clsx from "clsx";
import { ChevronRight, RotateCcw } from "lucide-react";
import { Icon } from "./Icon";

export interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  onReset?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const Section: React.FC<SectionProps> = ({
  title,
  defaultOpen = true,
  onReset,
  children,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={clsx("border-b border-[var(--color-line)] last:border-b-0", className)}>
      <div className="flex items-center justify-between px-3 py-2.5 select-none">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 font-semibold text-[12px] uppercase tracking-wider text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-xs"
        >
          <Icon
            icon={ChevronRight}
            size={12}
            className={clsx("transition-transform duration-180", isOpen && "rotate-90")}
          />
          <span>{title}</span>
        </button>

        {onReset && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            title="Reset section parameters"
            className="p-1 rounded-xs text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors"
          >
            <Icon icon={RotateCcw} size={11} />
          </button>
        )}
      </div>

      {isOpen && <div className="px-3 pb-3 flex flex-col gap-2.5">{children}</div>}
    </div>
  );
};
