"use client";

import React, { createContext, useContext, useState, useRef } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: "Confirm Action",
    message: "Are you sure you want to proceed?",
  });

  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    setOptions(options);
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolveRef.current) {
      resolveRef.current(false);
    }
  };

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolveRef.current) {
      resolveRef.current(true);
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && (
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
                * 03. CONFIRMATION
              </span>
              <h3 className="font-display font-bold text-xl uppercase tracking-tight text-foreground">
                {options.title}
              </h3>
              <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                {options.message}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleCancel}
                className="font-mono text-xs uppercase border-2 border-foreground bg-background text-foreground px-4 py-2.5 font-bold hover:bg-muted transition-all active:translate-x-[1px] active:translate-y-[1px]"
              >
                {options.cancelLabel || "Cancel"}
              </button>
              <button
                onClick={handleConfirm}
                className="font-mono text-xs uppercase border-2 border-foreground bg-accent text-white px-4 py-2.5 font-bold hover:bg-[#E04B28] shadow-[2px_2px_0px_0px_var(--foreground,#000)] hover:shadow-[1px_1px_0px_0px_var(--foreground,#000)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
              >
                {options.confirmLabel || "Confirm"}
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
