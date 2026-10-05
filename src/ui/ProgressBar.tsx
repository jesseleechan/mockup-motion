import React from "react";
import clsx from "clsx";

export interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  className?: string;
  "aria-label"?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  className,
  "aria-label": ariaLabel = "Progress",
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={ariaLabel}
      className={clsx(
        "relative w-full h-1.5 bg-[var(--color-line)] rounded-full overflow-hidden",
        className,
      )}
    >
      <div
        className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-120"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};
