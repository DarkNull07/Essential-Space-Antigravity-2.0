"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Image as ImageIcon, Loader2, Check } from "lucide-react";

export interface ImageLightboxProps {
  isOpen: boolean;
  initialTitle: string;
  imageUrl: string;
  saving: boolean;
  onSave: (newTitle: string) => Promise<void>;
  onClose: () => void;
}

export default function ImageLightbox({
  isOpen,
  initialTitle,
  imageUrl,
  saving,
  onSave,
  onClose,
}: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "Enter") {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT") {
          e.preventDefault();
          e.stopPropagation();
          onSave(title);
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [isOpen, onClose, title, onSave]);

  if (!isOpen || !mounted || typeof window === "undefined" || !document.body) {
    return null;
  }

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSave(title);
  };

  return createPortal(
    <div
      data-portal="true"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 select-text"
    >
      <div className="bg-card border-4 border-foreground shadow-[8px_8px_0px_0px_var(--foreground)] w-full max-w-4xl max-h-[95vh] flex flex-col p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-foreground/10 pb-3">
          <div className="flex items-center space-x-2">
            <ImageIcon className="w-4 h-4 text-accent" />
            <span className="font-mono text-xs uppercase font-bold tracking-widest text-accent">
              * Image Preview & Renamer
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="font-mono text-xs uppercase border-2 border-foreground px-2.5 py-0.5 hover:bg-muted cursor-pointer font-bold"
          >
            Close [Esc]
          </button>
        </div>

        {/* Viewport Containment Image Presentation Block */}
        <div className="flex-grow flex items-center justify-center bg-muted border-2 border-foreground overflow-hidden min-h-0 relative p-2">
          <img
            src={imageUrl}
            alt={title || "Image Preview"}
            className="max-h-[60vh] sm:max-h-[65vh] md:max-h-[70vh] w-auto object-contain border border-foreground/10"
            draggable={false}
          />
        </div>

        {/* Input Selection Ergonomics */}
        <div className="space-y-1">
          <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
            Image Title
          </label>
          <input
            type="text"
            placeholder="UNTITLED IMAGE"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-background border-2 border-foreground px-3 py-2 font-display font-black uppercase text-base focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-foreground/50 h-10 text-foreground"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="h-10 px-4 border-2 border-foreground font-mono text-xs uppercase bg-background hover:bg-muted text-foreground transition-all cursor-pointer shadow-[2px_2px_0px_0px_var(--foreground)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_0px_var(--foreground)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none font-bold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-4 bg-accent hover:bg-[#E04B28] text-white border-2 border-foreground font-display font-bold text-xs uppercase tracking-widest transition-all cursor-pointer shadow-[2px_2px_0px_0px_var(--foreground)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_0px_var(--foreground)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                SAVING...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                SAVE TITLE
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
