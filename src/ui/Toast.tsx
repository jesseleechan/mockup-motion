/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useState } from "react";
import clsx from "clsx";

export interface ToastItem {
  id: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  durationMs?: number;
}

interface ToastContextValue {
  toast: (
    message: string,
    options?: { action?: { label: string; onClick: () => void }; durationMs?: number },
  ) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback(
    (
      message: string,
      options?: { action?: { label: string; onClick: () => void }; durationMs?: number },
    ) => {
      const id = crypto.randomUUID();
      const durationMs = options?.durationMs ?? 4000;
      const item: ToastItem = {
        id,
        message,
        action: options?.action,
        durationMs,
      };

      setToasts((prev) => [...prev, item]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            // The menu's surface (menu-styles.ts).
            className={clsx(
              "pointer-events-auto flex items-center gap-3 min-h-10 py-1.5 pl-3.5 rounded-[12px] select-none",
              "border border-line bg-paper text-text shadow-menu text-[12.5px] font-medium",
              // The action button brings its own inset.
              t.action ? "pr-1.5" : "pr-3.5",
              "animate-in fade-in-0 slide-in-from-bottom-2 duration-180",
            )}
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  setToasts((prev) => prev.filter((toast) => toast.id !== t.id));
                }}
                className="h-7 px-2.5 rounded-[8px] text-[12px] font-semibold text-accent hover:bg-field transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
