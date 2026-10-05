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
            className={clsx(
              "pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-md shadow-2xl select-none",
              "bg-[var(--color-panel)] border border-[var(--color-line)] text-[var(--color-text)] text-[13px] font-medium",
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
                className="text-[12px] font-semibold text-[var(--color-accent)] hover:underline ml-2"
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
