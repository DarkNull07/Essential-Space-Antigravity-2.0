"use client";

import React from "react";
import { Folder, FolderOpen, ChevronRight, X } from "lucide-react";

export interface Category {
  id: string;
  name: string;
  order: number;
  parentId?: string | null;
}

interface CategoryPickerProps {
  categories: Category[];
  onSelect: (categoryId: string | null) => void;
  onCancel?: () => void;
  title?: string;
}

export default function CategoryPicker({
  categories,
  onSelect,
  onCancel,
  title = "SELECT DESTINATION CATEGORY",
}: CategoryPickerProps) {
  const topLevel = categories
    .filter((c) => !c.parentId)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="border-2 border-foreground bg-card p-4 space-y-3 shadow-[4px_4px_0px_0px_var(--foreground)] w-full">
      <div className="flex justify-between items-center border-b border-foreground/10 pb-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">
          * {title}
        </span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground font-mono text-xs cursor-pointer border border-foreground/20"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
        {/* Inbox / Uncategorized Option */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="w-full text-left p-2 border-2 border-foreground bg-background hover:bg-accent hover:text-white transition-all cursor-pointer font-bold flex items-center space-x-2 shadow-[2px_2px_0px_0px_var(--foreground)] hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <FolderOpen className="w-3.5 h-3.5 shrink-0" />
          <span>[INBOX / UNCATEGORIZED]</span>
        </button>

        {topLevel.map((cat) => {
          const subcats = categories
            .filter((c) => c.parentId === cat.id)
            .sort((a, b) => a.order - b.order);

          return (
            <div key={cat.id} className="space-y-1.5">
              <button
                type="button"
                onClick={() => onSelect(cat.id)}
                className="w-full text-left p-2 border-2 border-foreground bg-card hover:bg-muted font-bold transition-all cursor-pointer flex items-center space-x-2 shadow-[2px_2px_0px_0px_var(--foreground)] hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <Folder className="w-3.5 h-3.5 shrink-0 text-accent" />
                <span className="uppercase truncate">{cat.name}</span>
              </button>

              {subcats.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onSelect(sub.id)}
                  className="w-full text-left p-2 border-2 border-foreground bg-background hover:bg-accent hover:text-white transition-all cursor-pointer flex items-center space-x-2 ml-4 w-[calc(100%-1rem)] font-medium shadow-[2px_2px_0px_0px_var(--foreground)] hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <ChevronRight className="w-3 h-3 shrink-0 text-accent" />
                  <span className="uppercase truncate">{sub.name}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
