import React from "react";
import { Check } from "lucide-react";

/** "Active" or "Current" over a tile's face: the template or project in use. */
export const ActiveBadge: React.FC<{ label?: string }> = ({ label = "Active" }) => (
  <span className="px-1.5 py-0.5 rounded-[6px] text-[10.5px] font-semibold bg-[var(--color-accent)] text-[var(--color-accent-ink)] flex items-center gap-1">
    <Check size={10} strokeWidth={2.5} aria-hidden="true" />
    {label}
  </span>
);
