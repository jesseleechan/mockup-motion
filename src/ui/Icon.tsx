import React from "react";
import clsx from "clsx";
import type { LucideIcon, LucideProps } from "lucide-react";

export interface IconProps extends LucideProps {
  icon: LucideIcon;
}

export const Icon: React.FC<IconProps> = ({
  icon: LucideComp,
  size = 16,
  strokeWidth = 1.5,
  className,
  ...props
}) => {
  return (
    <LucideComp
      size={size}
      strokeWidth={strokeWidth}
      className={clsx("shrink-0 text-current", className)}
      aria-hidden="true"
      {...props}
    />
  );
};
