import React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import clsx from "clsx";

export const Tabs = TabsPrimitive.Root;

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsListProps {
  items: TabItem[];
  className?: string;
}

export const TabsList: React.FC<TabsListProps> = ({ items, className }) => {
  return (
    <TabsPrimitive.List
      className={clsx(
        "inline-flex items-center gap-1 border-b border-[var(--color-line)] w-full select-none",
        className,
      )}
    >
      {items.map((item) => (
        <TabsPrimitive.Trigger
          key={item.id}
          value={item.id}
          disabled={item.disabled}
          className={clsx(
            "inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-b-2 -mb-[1px] transition-colors cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
            "data-[state=active]:border-[var(--color-accent)] data-[state=active]:text-[var(--color-text)] data-[state=active]:font-semibold",
            "data-[state=inactive]:border-transparent data-[state=inactive]:text-[var(--color-text-2)] hover:text-[var(--color-text)]",
            "data-[disabled]:opacity-40 data-[disabled]:pointer-events-none",
          )}
        >
          {item.icon && <span className="shrink-0">{item.icon}</span>}
          <span>{item.label}</span>
        </TabsPrimitive.Trigger>
      ))}
    </TabsPrimitive.List>
  );
};

export interface TabsContentProps extends TabsPrimitive.TabsContentProps {
  className?: string;
  children: React.ReactNode;
}

export const TabsContent: React.FC<TabsContentProps> = ({ className, children, ...props }) => {
  return (
    <TabsPrimitive.Content
      className={clsx(
        "pt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
        className,
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Content>
  );
};
