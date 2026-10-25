import React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import clsx from "clsx";

export const Tabs = TabsPrimitive.Root;

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** A count shown after the label, e.g. the number of media files. */
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsListProps {
  items: TabItem[];
  className?: string;
}

/** The segmented control's look (SegmentedControl.tsx): a paper pill over a field track. */
export const TabsList: React.FC<TabsListProps> = ({ items, className }) => {
  return (
    <TabsPrimitive.List
      className={clsx(
        "flex items-center gap-0.5 w-full p-[3px] bg-field rounded-[12px] select-none",
        className,
      )}
    >
      {items.map((item) => (
        <TabsPrimitive.Trigger
          key={item.id}
          value={item.id}
          disabled={item.disabled}
          className={clsx(
            "flex-1 inline-flex items-center justify-center gap-1.5 h-[30px] px-3 rounded-[9px] whitespace-nowrap text-[12px] font-semibold cursor-pointer",
            "transition-[background-color,box-shadow,color] duration-120",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            "data-[state=active]:bg-paper data-[state=active]:text-text data-[state=active]:shadow-lift-sm",
            "data-[state=inactive]:text-text-2 hover:text-text",
            "data-[disabled]:opacity-40 data-[disabled]:pointer-events-none",
          )}
        >
          {item.icon && <span className="shrink-0">{item.icon}</span>}
          <span>{item.label}</span>
          {item.badge !== undefined && (
            <span className="font-num text-[10.5px] font-medium tabular-nums text-text-2">
              {item.badge}
            </span>
          )}
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
        "pt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className,
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Content>
  );
};
