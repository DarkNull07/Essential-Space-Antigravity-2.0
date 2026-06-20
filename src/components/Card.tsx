"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, ExternalLink, FileText, Globe, Image as ImageIcon } from "lucide-react";
import { deleteCard } from "@/app/actions";
import { useConfirm } from "./ConfirmDialog";

interface CardProps {
  card: {
    id: string;
    type: string;
    title: string | null;
    content: string;
    metadata: any;
    order: number;
    categoryId: string | null;
  };
  onDelete?: (id: string) => void;
}

export default function Card({ card, onDelete }: CardProps) {
  const confirm = useConfirm();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: "Delete Item",
      message: "Are you sure you want to delete this item? Once deleted, this action cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (confirmed) {
      try {
        await deleteCard(card.id);
        if (onDelete) onDelete(card.id);
      } catch (err) {
        console.error("Error deleting card:", err);
      }
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border-2 border-foreground shadow-[4px_4px_0px_0px_#0B0C10] flex flex-col group relative overflow-hidden select-none hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_#0B0C10] transition-all"
    >
      {/* Drag Handle Top Bar */}
      <div
        {...attributes}
        {...listeners}
        className="h-6 border-b border-foreground bg-muted flex items-center justify-between px-2 cursor-grab active:cursor-grabbing hover:bg-accent/10 transition-colors"
      >
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {card.type} // 0{card.order}
        </span>
        <div className="flex items-center space-x-1">
          <div className="w-1.5 h-1.5 rounded-full bg-foreground/30"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-foreground/30"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-foreground/30"></div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between min-h-[140px] space-y-4">
        {/* Render polymorphic contents */}
        {card.type === "TEXT" && (
          <div className="flex-1 space-y-2">
            {card.title && (
              <h4 className="font-sans font-bold text-sm uppercase tracking-tight line-clamp-1">
                {card.title}
              </h4>
            )}
            <p className={`font-mono text-xs leading-relaxed break-words whitespace-pre-wrap`}>
              {card.content}
            </p>
          </div>
        )}

        {card.type === "LINK" && (
          <div className="flex-grow flex flex-col justify-between h-full">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-sans font-bold text-sm uppercase tracking-tight line-clamp-2">
                  {card.title || card.content}
                </h4>
                <a
                  href={card.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 border border-foreground/10 hover:border-accent hover:text-accent transition-colors bg-background"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground break-all line-clamp-2">
                {card.content}
              </p>
            </div>
            {card.metadata && (
              <div className="flex items-center space-x-2 pt-2 border-t border-foreground/5">
                {card.metadata.favicon ? (
                  <img
                    src={card.metadata.favicon}
                    alt=""
                    className="w-3.5 h-3.5 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground line-clamp-1">
                  {(() => {
                    if (card.metadata?.domain) return card.metadata.domain;
                    try {
                      return new URL(card.content).hostname;
                    } catch {
                      return card.content;
                    }
                  })()}
                </span>
              </div>
            )}
          </div>
        )}

        {card.type === "IMAGE" && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="border border-foreground/10 overflow-hidden bg-muted aspect-video flex items-center justify-center relative">
              <img
                src={card.content}
                alt={card.title || "Uploaded asset"}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
            <div className="mt-3 space-y-1">
              <h4 className="font-sans font-bold text-xs uppercase tracking-tight line-clamp-1">
                {card.title || "Image Asset"}
              </h4>
              <div className="flex justify-between items-center font-mono text-[9px] text-muted-foreground pt-1 border-t border-foreground/5">
                <span>
                  {card.metadata?.width && card.metadata?.height
                    ? `${card.metadata.width}x${card.metadata.height}`
                    : "IMAGE"}
                </span>
                <span>{formatBytes(card.metadata?.size)}</span>
              </div>
            </div>
          </div>
        )}

        {card.type === "FILE" && (
          <div className="flex-grow flex flex-col justify-between h-full">
            <div className="flex items-start space-x-3">
              <div className="p-2 border-2 border-foreground bg-muted">
                <FileText className="w-6 h-6 text-foreground" />
              </div>
              <div className="space-y-1">
                <h4 className="font-sans font-bold text-xs uppercase tracking-tight line-clamp-2">
                  {card.title || card.content.split("/").pop() || "Document"}
                </h4>
                <p className="font-mono text-[9px] text-muted-foreground">
                  {formatBytes(card.metadata?.size)}
                </p>
              </div>
            </div>
            <a
              href={card.content}
              download
              className="mt-3 w-full bg-background hover:bg-muted border border-foreground py-1 text-center font-mono text-[10px] uppercase tracking-wider transition-colors block"
            >
              Download File
            </a>
          </div>
        )}
      </div>

      {/* Delete Button (Visible on hover) */}
      <button
        onClick={handleDelete}
        className="absolute bottom-2 right-2 bg-background hover:bg-accent text-foreground hover:text-white border border-foreground p-1.5 transition-all opacity-0 group-hover:opacity-100 shadow-[2px_2px_0px_0px_#0B0C10] hover:shadow-[1px_1px_0px_0px_#0B0C10] hover:translate-x-[0.5px] hover:translate-y-[0.5px]"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
