"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Loader2, Copy, FolderPlus, ArrowRightLeft, Check } from "lucide-react";
import { duplicateCard, moveCardToCategory } from "@/app/actions";
import { useConfirm } from "./ConfirmDialog";
import { Category } from "./CategoryPicker";

const CategoryPicker = dynamic(() => import("./CategoryPicker"), { ssr: false });

export interface NotepadModalProps {
  isOpen: boolean;
  card: {
    id: string;
    type: string;
    title: string | null;
    content: string;
    metadata: any;
    order: number;
    categoryId: string | null;
  };
  categories: Category[];
  initialTitle: string;
  initialContent: string;
  initialDescription?: string;
  cardType: string;
  saving: boolean;
  onSave: (title: string, content: string, description?: string) => Promise<void>;
  onClose: () => void;
  onCardCreated?: (newCard: any) => void;
  onCardUpdate?: (updated: any) => void;
}

export default function NotepadModal({
  isOpen,
  card,
  categories,
  initialTitle,
  initialContent,
  initialDescription = "",
  cardType,
  saving,
  onSave,
  onClose,
  onCardCreated,
  onCardUpdate,
}: NotepadModalProps) {
  const confirm = useConfirm();
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [description, setDescription] = useState(initialDescription);

  const [pickerMode, setPickerMode] = useState<"copy" | "move" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSave = (e?: React.SyntheticEvent | KeyboardEvent) => {
    if (e) {
      if ("stopPropagation" in e) e.stopPropagation();
    }
    onSave(title, content, description);
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const duplicated = await duplicateCard(card.id);
      if (onCardCreated) {
        onCardCreated(duplicated);
      }
      onClose();
    } catch (err: any) {
      console.error("Failed to duplicate card:", err);
      await confirm({
        title: "Duplicate Failed",
        message: err instanceof Error ? err.message : "Failed to duplicate card.",
        confirmLabel: "Close",
        mode: "alert",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePickerSelect = async (selectedCategoryId: string | null) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      if (pickerMode === "copy") {
        const copiedCard = await duplicateCard(card.id, selectedCategoryId);
        if (onCardCreated) {
          onCardCreated(copiedCard);
        }
      } else if (pickerMode === "move") {
        const movedCard = await moveCardToCategory(card.id, selectedCategoryId);
        if (onCardUpdate) {
          onCardUpdate(movedCard);
        }
      }
      setPickerMode(null);
      onClose();
    } catch (err: any) {
      console.error(`Failed to ${pickerMode} card:`, err);
      await confirm({
        title: pickerMode === "copy" ? "Copy Failed" : "Move Failed",
        message: err instanceof Error ? err.message : `Failed to ${pickerMode} card.`,
        confirmLabel: "Close",
        mode: "alert",
      });
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || pickerMode) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "Enter") {
        const target = e.target as HTMLElement;
        if (target.tagName === "TEXTAREA") {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            handleSave(e);
          }
        } else if (target.tagName === "INPUT") {
          e.preventDefault();
          e.stopPropagation();
          handleSave(e);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, title, content, description, onSave, pickerMode]);

  if (!isOpen || !mounted || typeof window === "undefined" || !document.body) {
    return null;
  }

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
      <div className="bg-card border-4 border-foreground shadow-[8px_8px_0px_0px_var(--foreground)] w-full max-w-3xl h-[80vh] flex flex-col p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-foreground/10 pb-3">
          <span className="font-mono text-xs uppercase font-bold tracking-widest text-accent">
            * Notepad Editor / {cardType}
          </span>
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

        {pickerMode ? (
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
            <CategoryPicker
              categories={categories}
              title={pickerMode === "copy" ? "COPY CARD TO..." : "MOVE CARD TO..."}
              onSelect={handlePickerSelect}
              onCancel={() => setPickerMode(null)}
            />
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                Document Title
              </label>
              <input
                type="text"
                placeholder="UNTITLED NOTE"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-background border-2 border-foreground px-3 py-2 font-display font-black uppercase text-base focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-foreground/50 h-10"
              />
            </div>

            {cardType === "LINK" ? (
              <>
                <div className="space-y-1">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                    URL Address
                  </label>
                  <input
                    type="text"
                    placeholder="https://example.com/resource"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full bg-background border-2 border-foreground px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-foreground/50 h-10"
                  />
                </div>
                <div className="flex-1 flex flex-col min-h-0 space-y-1">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                    Link Description / Notes
                  </label>
                  <textarea
                    placeholder="Link description details..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full flex-grow bg-background border-2 border-foreground p-4 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-foreground/50 resize-none min-h-0 overflow-y-auto"
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 space-y-1">
                <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                  Document Body
                </label>
                <textarea
                  placeholder="Start writing..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full flex-grow bg-background border-2 border-foreground p-4 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-foreground/50 resize-none min-h-0 overflow-y-auto"
                />
              </div>
            )}
          </>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={saving || actionLoading}
              className="h-10 px-3 border-2 border-foreground bg-card hover:bg-muted text-foreground font-mono text-xs uppercase font-bold transition-all cursor-pointer shadow-[2px_2px_0px_0px_var(--foreground)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_0px_var(--foreground)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
              Duplicate
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPickerMode("copy");
              }}
              disabled={saving || actionLoading}
              className="h-10 px-3 border-2 border-foreground bg-card hover:bg-muted text-foreground font-mono text-xs uppercase font-bold transition-all cursor-pointer shadow-[2px_2px_0px_0px_var(--foreground)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_0px_var(--foreground)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Copy to...
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPickerMode("move");
              }}
              disabled={saving || actionLoading}
              className="h-10 px-3 border-2 border-foreground bg-card hover:bg-muted text-foreground font-mono text-xs uppercase font-bold transition-all cursor-pointer shadow-[2px_2px_0px_0px_var(--foreground)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_0px_var(--foreground)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Move to...
            </button>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 border-2 border-foreground bg-muted hover:bg-card text-foreground font-mono text-xs uppercase font-bold transition-all cursor-pointer shadow-[2px_2px_0px_0px_var(--foreground)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_0px_var(--foreground)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || actionLoading}
              className="h-10 px-4 bg-accent hover:bg-[#E04B28] text-white border-2 border-foreground font-display font-bold text-xs uppercase tracking-widest transition-all cursor-pointer shadow-[2px_2px_0px_0px_var(--foreground)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_0px_var(--foreground)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  SAVING...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  SAVE CHANGES
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
