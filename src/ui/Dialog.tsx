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

/**
 * A floating panel at radius 18 over the scrim, as Layout Stage's panels. With a title or a
 * description it draws them in a header row with the close button. Without either, the content
 * draws its own header (the template gallery): the close button then floats in the top-right
 * corner, in the dialog's padding, rather than taking a row of its own above that header.
 */
export const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, title, description, children, ...props }, ref) => {
    const hasHeader = Boolean(title || description);
    const close = (
      <DialogPrimitive.Close asChild>
        <button
          type="button"
          className={clsx(
            "grid place-items-center w-7 h-7 shrink-0 rounded-[8px] cursor-pointer transition-colors",
            "text-text-2 hover:text-text hover:bg-field",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            hasHeader ? "-mt-1 -mr-1" : "absolute top-3 right-3 z-10",
          )}
          aria-label="Close dialog"
        >
          <Icon icon={X} size={16} />
        </button>
      </DialogPrimitive.Close>
    );

    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim animate-in fade-in-0" />
        <DialogPrimitive.Content
          ref={ref}
          className={clsx(
            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
            "w-full max-w-lg p-6 rounded-[18px] shadow-sheet outline-none",
            "bg-panel text-text",
            "animate-in fade-in-0 zoom-in-95",
            className,
          )}
          {...props}
        >
          {hasHeader ? (
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                {title && (
                  <DialogPrimitive.Title className="text-[16px] font-semibold tracking-tight text-text">
                    {title}
                  </DialogPrimitive.Title>
                )}
                {description && (
                  <DialogPrimitive.Description className="text-[13px] text-text-2 mt-1">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              {close}
            </div>
          ) : (
            close
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);

DialogContent.displayName = "DialogContent";
