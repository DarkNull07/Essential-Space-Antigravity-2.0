"use client";

import React, { createContext, useContext, useState } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When "alert", the Cancel button is hidden — use for error/info notices. */
  mode?: "confirm" | "alert";
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<
    Array<{ options: ConfirmOptions; resolve: (value: boolean) => void }>
  >([]);

  const current = queue[0] || null;

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setQueue((prev) => [...prev, { options, resolve }]);
    });
  };

  const settle = (value: boolean) => {
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      const [head, ...rest] = prev;
      head.resolve(value);
      return rest;
    });
  };

  const handleCancel = () => settle(false);
  const handleConfirm = () => settle(true);

  const isAlert = current?.options.mode === "alert";

  React.useEffect(() => {
    if (!current) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleConfirm();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [current]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {current && (
        <div
          data-portal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancel();
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4"
        >
          <div className="bg-background text-foreground border-2 border-foreground shadow-[6px_6px_0px_0px_var(--foreground,#000)] max-w-md w-full p-6 space-y-6 animate-scale-in">
            <div className="space-y-2">
              <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold block">
                {isAlert ? "* 03. NOTICE" : "* 03. CONFIRMATION"}
              </span>
              <h3 className="font-display font-bold text-xl uppercase tracking-tight text-foreground">
                {current.options.title}
              </h3>
              <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                {current.options.message}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              {!isAlert && (
                <button
                  onClick={handleCancel}
                  className="font-mono text-xs uppercase border-2 border-foreground bg-background text-foreground px-4 py-2.5 font-bold hover:bg-muted transition-all active:translate-x-[1px] active:translate-y-[1px]"
                >
                  {current.options.cancelLabel || "Cancel"}
                </button>
              )}
              <button
                onClick={handleConfirm}
                className="font-mono text-xs uppercase border-2 border-foreground bg-accent text-white px-4 py-2.5 font-bold hover:bg-[#E04B28] shadow-[2px_2px_0px_0px_var(--foreground,#000)] hover:shadow-[1px_1px_0px_0px_var(--foreground,#000)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
              >
                {current.options.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context.confirm;
}
