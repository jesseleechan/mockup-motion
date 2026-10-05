import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import clsx from "clsx";
import { X } from "lucide-react";
import { Icon } from "./Icon";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export interface DialogContentProps extends Omit<DialogPrimitive.DialogContentProps, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, title, description, children, ...props }, ref) => {
    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs animate-in fade-in-0" />
        <DialogPrimitive.Content
          ref={ref}
          className={clsx(
            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
            "w-full max-w-lg p-6 rounded-lg shadow-2xl outline-none",
            "bg-[var(--color-panel)] border border-[var(--color-line)] text-[var(--color-text)]",
            "animate-in fade-in-0 zoom-in-95",
            className,
          )}
          {...props}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              {title && (
                <DialogPrimitive.Title className="text-[16px] font-semibold tracking-tight text-[var(--color-text)]">
                  {title}
                </DialogPrimitive.Title>
              )}
              {description && (
                <DialogPrimitive.Description className="text-[13px] text-[var(--color-text-2)] mt-1">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                className="p-1 rounded-sm text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                aria-label="Close dialog"
              >
                <Icon icon={X} size={16} />
              </button>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);

DialogContent.displayName = "DialogContent";
