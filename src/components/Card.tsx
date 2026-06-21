"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, ExternalLink, FileText, Globe, Image as ImageIcon, CheckSquare, Key, Eye, EyeOff, Copy, Check, Pencil, Download, Loader2 } from "lucide-react";
import { deleteCard, updateCard } from "@/app/actions";
import { useConfirm } from "./ConfirmDialog";
import { sanitizeTitle, base64ToString, stringToBase64 } from "@/lib/utils";


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
  
  const [items, setItems] = useState<any[]>(() => {
    if (card.type === "CHECKLIST" && card.metadata && Array.isArray(card.metadata.items)) {
      return card.metadata.items;
    }
    return [];
  });
  const [newChecklistItemText, setNewChecklistItemText] = useState("");
  const [revealKey, setRevealKey] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Notepad modal editor states
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [savingNotepad, setSavingNotepad] = useState(false);

  // Keep track of the request ref to avoid prop updates overriding active local edits (Constraint 3)
  const pendingRequests = useRef(0);

  useEffect(() => {
    if (pendingRequests.current === 0 && card.type === "CHECKLIST" && card.metadata && Array.isArray(card.metadata.items)) {
      setItems(card.metadata.items);
    }
  }, [card.metadata]);

  const handleToggleChecklistItem = async (itemId: string) => {
    // Instantly toggle local checkbox state visually to prevent desyncs/race conditions (Constraint 3)
    const updatedItems = items.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    setItems(updatedItems);

    pendingRequests.current += 1;
    try {
      await updateCard(card.id, card.content, card.title, {
        ...card.metadata,
        items: updatedItems,
      });
    } catch (err) {
      console.error("Failed to toggle checklist item:", err);
      // Revert if no other requests are pending
      if (pendingRequests.current === 1) {
        setItems(card.metadata?.items || []);
      }
    } finally {
      pendingRequests.current = Math.max(0, pendingRequests.current - 1);
    }
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newChecklistItemText.trim();
    if (!trimmed) return;

    const newItem = {
      id: `${Date.now()}-${items.length}`,
      text: trimmed,
      checked: false,
    };

    const updatedItems = [...items, newItem];
    setItems(updatedItems);
    setNewChecklistItemText("");

    pendingRequests.current += 1;
    try {
      await updateCard(card.id, card.content, card.title, {
        ...card.metadata,
        items: updatedItems,
      });
    } catch (err) {
      console.error("Failed to add checklist item:", err);
      if (pendingRequests.current === 1) {
        setItems(card.metadata?.items || []);
      }
    } finally {
      pendingRequests.current = Math.max(0, pendingRequests.current - 1);
    }
  };

  const handleCopyKey = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(card.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = (e: React.MouseEvent) => {
    e.stopPropagation();
    let textToDownload = card.content;
    
    if (card.type === "FILE") {
      textToDownload = base64ToString(card.content);
    }
    
    const blob = new Blob([textToDownload], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${card.title || "untitled"}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveNotepad = async (title: string, content: string) => {
    setSavingNotepad(true);
    try {
      let contentToSave = content;
      let newMetadata = card.metadata;
      if (card.type === "FILE") {
        const bytes = new TextEncoder().encode(content);
        contentToSave = "data:text/plain;base64," + stringToBase64(content);
        newMetadata = {
          ...card.metadata,
          size: bytes.byteLength,
          mimeType: "text/plain",
        };
      }
      await updateCard(card.id, contentToSave, title.trim() || null, newMetadata);
      setIsNotepadOpen(false);
    } catch (err) {
      console.error("Failed to save notepad card:", err);
      alert("Failed to save. Please try again.");
    } finally {
      setSavingNotepad(false);
    }
  };


  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: isNotepadOpen ? undefined : CSS.Transform.toString(transform),
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
      className="bg-card border-2 border-foreground shadow-[4px_4px_0px_0px_var(--foreground)] flex flex-col group relative overflow-hidden select-none hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--foreground)] transition-all"
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
                  {sanitizeTitle(card.title, card.content)}
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
              className="mt-3 w-full bg-background hover:bg-muted border-2 border-foreground py-1 text-center font-mono text-[10px] uppercase tracking-wider transition-colors block font-semibold cursor-pointer"
            >
              Download File
            </a>
          </div>
        )}

        {card.type === "CHECKLIST" && (
          <div className="flex-1 flex flex-col justify-between h-full space-y-3">
            <div className="space-y-2 flex-grow overflow-y-auto max-h-[160px] pr-1">
              {card.title && (
                <h4 className="font-sans font-bold text-sm uppercase tracking-tight line-clamp-1 border-b border-foreground/10 pb-1">
                  {card.title}
                </h4>
              )}
              {items.length === 0 ? (
                <p className="font-mono text-[10px] text-muted-foreground italic">No items yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleChecklistItem(item.id)}
                      className="flex items-center space-x-2.5 cursor-pointer group/item py-0.5"
                    >
                      <div
                        className={`w-4 h-4 border-2 border-foreground flex items-center justify-center transition-all ${
                          item.checked ? "bg-accent text-white border-accent" : "bg-background"
                        }`}
                      >
                        {item.checked && <Check className="w-3 h-3 stroke-[3px]" />}
                      </div>
                      <span
                        className={`font-mono text-[11px] select-none break-all line-clamp-2 ${
                          item.checked ? "line-through text-muted-foreground font-semibold" : "text-foreground"
                        }`}
                      >
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <form onSubmit={handleAddChecklistItem} className="flex gap-1.5 pt-2 border-t border-foreground/10">
              <input
                type="text"
                placeholder="ADD ITEM..."
                value={newChecklistItemText}
                onChange={(e) => setNewChecklistItemText(e.target.value)}
                className="flex-grow bg-background border-2 border-foreground px-2 py-1 font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-foreground/50 h-7 uppercase font-semibold"
              />
              <button
                type="submit"
                className="bg-accent hover:bg-[#E04B28] text-white border-2 border-foreground px-2.5 font-display font-bold text-[9px] uppercase tracking-wider shadow-[1px_1px_0px_0px_var(--foreground)] hover:shadow-none hover:translate-x-[0.5px] hover:translate-y-[0.5px] transition-all flex items-center justify-center h-7 cursor-pointer"
              >
                ADD
              </button>
            </form>
          </div>
        )}

        {card.type === "API_KEY" && (
          <div className="flex-1 flex flex-col justify-between h-full space-y-3">
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-accent" />
                <h4 className="font-sans font-bold text-sm uppercase tracking-tight line-clamp-1">
                  {card.title || "API KEY"}
                </h4>
              </div>
              <div className="flex items-center justify-between border-2 border-foreground bg-background p-2 font-mono text-xs select-all break-all shadow-[2px_2px_0px_0px_var(--foreground)]">
                <span className="tracking-widest font-bold">
                  {revealKey ? card.content : "••••••••••••••••"}
                </span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRevealKey(!revealKey);
                }}
                className="flex-1 bg-background hover:bg-muted border-2 border-foreground h-8 font-mono text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_0px_var(--foreground)] active:shadow-none active:translate-x-[0.5px] active:translate-y-[0.5px] font-bold"
              >
                {revealKey ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    HIDE
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    REVEAL
                  </>
                )}
              </button>
              <button
                onClick={handleCopyKey}
                className={`flex-1 border-2 border-foreground h-8 font-mono text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_0px_var(--foreground)] active:shadow-none active:translate-x-[0.5px] active:translate-y-[0.5px] font-bold ${
                  copied ? "bg-emerald-500 text-white border-emerald-600 shadow-none translate-x-[0.5px] translate-y-[0.5px]" : "bg-accent hover:bg-[#E04B28] text-white"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    COPIED
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    COPY
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons (Visible on hover) */}
      {(card.type === "TEXT" || card.type === "FILE") && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsNotepadOpen(true);
          }}
          className="absolute bottom-2 right-[72px] bg-background hover:bg-accent text-foreground hover:text-white border-2 border-foreground p-1.5 transition-all opacity-0 group-hover:opacity-100 shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[0.5px] hover:translate-y-[0.5px] cursor-pointer"
          title="Open Notepad Editor"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}

      {(card.type === "TEXT" || card.type === "FILE") && (
        <button
          onClick={handleDownloadTxt}
          className="absolute bottom-2 right-[40px] bg-background hover:bg-accent text-foreground hover:text-white border-2 border-foreground p-1.5 transition-all opacity-0 group-hover:opacity-100 shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[0.5px] hover:translate-y-[0.5px] cursor-pointer"
          title="Download as .txt"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      )}

      <button
        onClick={handleDelete}
        className="absolute bottom-2 right-[8px] bg-background hover:bg-accent text-foreground hover:text-white border-2 border-foreground p-1.5 transition-all opacity-0 group-hover:opacity-100 shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[0.5px] hover:translate-y-[0.5px] cursor-pointer"
        title="Delete Card"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Notepad Editor Modal */}
      {isNotepadOpen && (
        <NotepadModal
          isOpen={isNotepadOpen}
          initialTitle={card.title || ""}
          initialContent={card.type === "FILE" ? base64ToString(card.content) : card.content}
          cardType={card.type}
          saving={savingNotepad}
          onSave={handleSaveNotepad}
          onClose={() => setIsNotepadOpen(false)}
        />
      )}
    </div>
  );
}

interface NotepadModalProps {
  isOpen: boolean;
  initialTitle: string;
  initialContent: string;
  cardType: string;
  saving: boolean;
  onSave: (title: string, content: string) => Promise<void>;
  onClose: () => void;
}

function NotepadModal({
  isOpen,
  initialTitle,
  initialContent,
  cardType,
  saving,
  onSave,
  onClose,
}: NotepadModalProps) {
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted || typeof window === "undefined" || !document.body) {
    return null;
  }

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSave(title, content);
  };

  return createPortal(
    <div
      onClick={(e) => e.stopPropagation()}
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

        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="h-10 px-4 border-2 border-foreground font-mono text-xs uppercase bg-background hover:bg-muted text-foreground transition-all cursor-pointer shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] font-bold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-4 bg-accent hover:bg-[#E04B28] text-white border-2 border-foreground font-display font-bold text-xs uppercase tracking-widest transition-all cursor-pointer shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] flex items-center gap-1.5"
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
    </div>,
    document.body
  );
}
