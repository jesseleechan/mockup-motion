import React from "react";
import clsx from "clsx";

/**
 * A floating pill of controls on the workspace, as Layout Stage's `.cluster`: 44 px tall at
 * radius 14 on the panel colour, lifted by its shadow (docs/restyle-plan/README.md, R2). The top
 * bar's three clusters, the toolbar under the stage and a collapsed panel's rail are clusters.
 */
export const Cluster = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        "flex items-center gap-1 min-h-11 p-1 min-w-0 rounded-[14px] bg-[var(--color-panel)] shadow-lift",
        className,
      )}
      {...props}
    />
  ),
);

Cluster.displayName = "Cluster";

/** A hairline between groups of controls in a cluster. */
export const ClusterSeparator: React.FC<{ className?: string }> = ({ className }) => (
  <span
    aria-hidden="true"
    className={clsx("w-px self-stretch my-1.5 mx-0.5 shrink-0 bg-[var(--color-line)]", className)}
  />
);
