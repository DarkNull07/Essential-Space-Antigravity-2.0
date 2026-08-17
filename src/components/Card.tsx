"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, ExternalLink, FileText, Globe, Image as ImageIcon, CheckSquare, Key, Eye, EyeOff, Copy, Check, Pencil, Download, Loader2, FolderPlus, ArrowRightLeft } from "lucide-react";
import { deleteCard, updateCard, revealApiKey, duplicateCard, moveCardToCategory } from "@/app/actions";
import { useConfirm } from "./ConfirmDialog";
import { sanitizeTitle, base64ToString, stringToBase64, getDomain, stripHashtags } from "@/lib/utils";
import { Category } from "./CategoryPicker";

const NotepadModal = dynamic(() => import("./NotepadModal"), { ssr: false });
const ImageLightbox = dynamic(() => import("./ImageLightbox"), { ssr: false });

// Only allow safe URL schemes in hrefs to block javascript:/data: stored-XSS.
function safeExternalHref(raw: string | null | undefined): string {
  if (!raw) return "#";
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^mailto:/i.test(trimmed)) return trimmed;
  // Anything else that declares a scheme (javascript:, data:, vbscript:…) is rejected.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return "#";
  // Schemeless input like "example.com/path" → treat as https.
  return `https://${trimmed}`;
}


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
  categories?: Category[];
  onDelete?: (id: string) => void;
  onCardUpdate?: (updated: CardProps["card"]) => void;
  onCardCreated?: (newCard: CardProps["card"]) => void;
  isOverlay?: boolean;
}

function Card({ card, categories = [], onDelete, onCardUpdate, onCardCreated, isOverlay = false }: CardProps) {
  const confirm = useConfirm();
  
  const [items, setItems] = useState<any[]>(() => {
    if (card.type === "CHECKLIST" && card.metadata && Array.isArray(card.metadata.items)) {
      return card.metadata.items;
    }
    return [];
  });
  const [newChecklistItemText, setNewChecklistItemText] = useState("");
  const [revealKey, setRevealKey] = useState(false);
  const [decryptedKey, setDecryptedKey] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Notepad modal editor states
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [savingNotepad, setSavingNotepad] = useState(false);

  // Lightbox modal states
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [savingLightbox, setSavingLightbox] = useState(false);

  // Keep track of the request ref to avoid prop updates overriding active local edits (Constraint 3)
  const pendingRequests = useRef(0);

  const [localContent, setLocalContent] = useState(card.content);

  useEffect(() => {
    setLocalContent(card.content);
  }, [card.content]);

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

  const handleToggleTextLineChecklist = (cardId: string, index: number) => {
    const lines = localContent.split("\n");
    const updatedLines = [...lines];
    const targetLine = updatedLines[index];
    if (targetLine.startsWith("- [ ]")) {
      updatedLines[index] = targetLine.replace("- [ ]", "- [x]");
    } else if (targetLine.startsWith("- [x]")) {
      updatedLines[index] = targetLine.replace("- [x]", "- [ ]");
    }
    const newContent = updatedLines.join("\n");
    setLocalContent(newContent);

    const updateCardContentAction = (id: string, content: string) =>
      updateCard(id, content, card.title, card.metadata);

    updateCardContentAction(cardId, newContent).catch((err) => {
      console.error("Failed to toggle inline checklist line silently:", err);
      setLocalContent(card.content);
    });
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

  const handleCopyKey = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      let keyToCopy = decryptedKey;
      if (!keyToCopy) {
        keyToCopy = await revealApiKey(card.id);
        setDecryptedKey(keyToCopy);
      }
      await navigator.clipboard.writeText(keyToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy API key:", err);
    }
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

  // Idempotent prefetch: fetches the decrypted key at most once per card mount.
  // Only triggered by explicit user intent (hover/focus/click) — never on mount.
  const ensureDecryptedKey = async () => {
    if (decryptedKey || isRevealing) return;
    setIsRevealing(true);
    try {
      const raw = await revealApiKey(card.id);
      setDecryptedKey(raw);
    } catch (err) {
      console.error("Failed to reveal API key:", err);
    } finally {
      setIsRevealing(false);
    }
  };

  const handleSaveNotepad = async (title: string, content: string, description?: string) => {
    setSavingNotepad(true);
    // Snapshot previous values for rollback
    const prevTitle = card.title;
    const prevContent = card.content;
    const prevMetadata = card.metadata;
    try {
      let contentToSave = content;
      let newMetadata = card.metadata || {};
      if (card.type === "FILE") {
        const bytes = new TextEncoder().encode(content);
        contentToSave = "data:text/plain;base64," + stringToBase64(content);
        newMetadata = {
          ...card.metadata,
          size: bytes.byteLength,
          mimeType: "text/plain",
        };
      } else if (card.type === "LINK") {
        let domain = "";
        try {
          domain = new URL(content || "").hostname;
        } catch {
          domain = content || "";
        }
        newMetadata = {
          ...(card.metadata || {}),
          domain,
          favicon: `/api/favicon?domain=${domain}&sz=64`,
          description: description || "",
        };
      }
      // Optimistic update — show new values immediately
      const optimisticCard = {
        ...card,
        title: title.trim() || null,
        content: contentToSave,
        metadata: newMetadata,
      };
      onCardUpdate?.(optimisticCard);
      setLocalContent(contentToSave);
      await updateCard(card.id, contentToSave, title.trim() || null, newMetadata);
      setIsNotepadOpen(false);
    } catch (err) {
      console.error("Failed to save notepad card:", err);
      // Rollback to previous values
      onCardUpdate?.({ ...card, title: prevTitle, content: prevContent, metadata: prevMetadata });
      setLocalContent(prevContent);
      await confirm({ title: "Save Failed", message: "Failed to save. Please try again.", confirmLabel: "OK", mode: "alert" });
    } finally {
      setSavingNotepad(false);
    }
  };


  const handleSaveLightbox = async (newTitle: string) => {
    setSavingLightbox(true);
    const prevTitle = card.title;
    // Optimistic update — show new title immediately
    onCardUpdate?.({ ...card, title: newTitle.trim() || null });
    try {
      await updateCard(card.id, card.content, newTitle.trim() || null, card.metadata);
      setIsLightboxOpen(false);
    } catch (err) {
      console.error("Failed to save lightbox title:", err);
      // Rollback to previous title
      onCardUpdate?.({ ...card, title: prevTitle });
      await confirm({ title: "Save Failed", message: "Failed to save title. Please try again.", confirmLabel: "OK", mode: "alert" });
    } finally {
      setSavingLightbox(false);
    }
  };

  const getEstimatedRowSpan = (type: string) => {
    switch (type) {
      case "LINK": return 6;      // ~126px
      case "CHECKLIST": return 8; // ~176px
      case "API_KEY": return 6;   // ~126px
      case "IMAGE": return 12;    // ~276px
      case "FILE": return 6;      // ~126px
      default: return 8;          // ~176px
    }
  };

  const [rowSpan, setRowSpan] = useState(() => getEstimatedRowSpan(card.type));
  const cardRef = useRef<HTMLDivElement | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(card.id), disabled: isOverlay });

  const setCombinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    cardRef.current = node;
  };

  useEffect(() => {
    if (isOverlay) return;
    const element = cardRef.current;
    if (!element) return;

    const child = element.firstElementChild as HTMLElement;
    if (!child) return;

    const updateSpanHeight = () => {
      const height = child.getBoundingClientRect().height;
      const gap = 24;
      const newSpan = Math.ceil((height + gap) / 25);
      setRowSpan((prevSpan) => (newSpan !== prevSpan ? newSpan : prevSpan));
    };

    updateSpanHeight();

    const resizeObserver = new ResizeObserver(updateSpanHeight);
    resizeObserver.observe(child);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isOverlay, card.content, card.title, items]);

  const style = isOverlay ? undefined : {
    transform: (isNotepadOpen || isLightboxOpen) ? undefined : CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const combinedStyle = {
    gridRowEnd: rowSpan ? `span ${rowSpan}` : undefined,
    ...style,
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
      ref={isOverlay ? null : setCombinedRef}
      style={combinedStyle}
      className={`bg-card border-2 border-foreground shadow-[4px_4px_0px_0px_var(--foreground)] flex flex-col group relative overflow-hidden select-text transition-all ${
        isOverlay ? "pointer-events-none select-none" : "hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[5px_5px_0px_0px_var(--foreground)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
      } ${
        isDragging ? "opacity-30 border-dashed border-foreground/30 bg-background/50 shadow-none hover:translate-x-0 hover:translate-y-0 hover:shadow-none" : ""
      }`}
    >
      <div className="w-full flex flex-col h-fit">
        {/* Drag Handle Top Bar */}
        <div
          {...(isOverlay ? {} : attributes)}
          {...(isOverlay ? {} : listeners)}
        style={{ touchAction: "none" }}
        className={`h-6 border-b border-foreground bg-muted flex items-center justify-between px-2 transition-colors select-none touch-none ${
          isOverlay ? "" : "cursor-grab active:cursor-grabbing hover:bg-accent/10"
        }`}
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
      <div className="p-4 pb-10 flex flex-col space-y-4">
        {/* Render polymorphic contents */}
        {card.type === "TEXT" && (() => {
          const lines = localContent.split("\n");
          
          return (
            <div 
              onClick={() => {
                if (!isOverlay) setIsNotepadOpen(true);
              }}
              className="space-y-2 cursor-pointer relative select-text"
            >
              {card.title && (
                <h4 className="font-sans font-bold text-sm uppercase tracking-tight line-clamp-1">
                  {card.title}
                </h4>
              )}
              
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                {lines.map((line, idx) => {
                  // A. Checklist check
                  const checklistMatch = line.match(/^-\s*\[([ xX])\]\s*(.*)/);
                  if (checklistMatch) {
                    const checked = checklistMatch[1].toLowerCase() === "x";
                    const text = checklistMatch[2].trim();
                    return (
                      <div 
                        key={idx}
                        onClick={(e) => e.stopPropagation()}
                        data-no-dnd="true"
                        className="flex items-center space-x-2.5 cursor-pointer group/line-item py-0.5"
                      >
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleTextLineChecklist(card.id, idx);
                          }}
                          className={`w-4 h-4 border-2 border-foreground flex items-center justify-center transition-all ${
                            checked ? "bg-accent text-white border-accent" : "bg-background"
                          }`}
                        >
                          {checked && <Check className="w-3 h-3 stroke-[3px]" />}
                        </div>
                        <span
                          className={`font-mono text-[11px] select-none break-all line-clamp-2 ${
                            checked ? "line-through text-muted-foreground opacity-50 font-semibold" : "text-foreground"
                          }`}
                        >
                          {text}
                        </span>
                      </div>
                    );
                  }

                  // B. Embedded Link Check
                  const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
                  if (urlMatch) {
                    const url = urlMatch[0];
                    const textBefore = line.replace(url, "").trim();
                    return (
                      <div key={idx} className="space-y-1.5 w-full">
                        {textBefore && (
                          <p className="font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-left">
                            {textBefore}
                          </p>
                        )}
                        <InlineLinkWidget url={url} />
                      </div>
                    );
                  }

                  // C. Credentials / API Keys Check
                  const isKey = line.includes("KEY:") || (line.startsWith("`") && line.endsWith("`"));
                  if (isKey) {
                    const cleanText = line.startsWith("`") && line.endsWith("`") ? line.slice(1, -1) : line;
                    return (
                      <div 
                        key={idx}
                        onClick={(e) => e.stopPropagation()}
                        data-no-dnd="true"
                        className="flex items-center justify-between bg-muted border-2 border-black p-2 my-1 font-mono text-[10px] select-all w-full rounded-none shadow-[2px_2px_0px_0px_var(--foreground)]"
                      >
                        <span className="truncate font-bold tracking-wider mr-2">{cleanText}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(cleanText);
                          }}
                          data-no-dnd="true"
                          className="px-2 py-0.5 border border-black bg-background hover:bg-accent hover:text-white text-[9px] uppercase font-bold transition-colors cursor-pointer"
                        >
                          [ COPY ]
                        </button>
                      </div>
                    );
                  }

                  // D. Plain Text
                  return (
                    <p 
                      key={idx} 
                      className="font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-left"
                    >
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {card.type === "LINK" && (() => {
          let rootDomain = "";
          try {
            rootDomain = new URL(card.content || "").hostname;
          } catch {
            rootDomain = card.content || "";
          }

          const isYouTube = rootDomain.includes("youtube.com") || rootDomain.includes("youtu.be");
          const description = card.metadata?.description || card.metadata?.summary || null;
          const bodyText = description || (isYouTube 
            ? (card.metadata?.videoTitle || card.metadata?.title || card.title || null)
            : null);

          return (
            <div className="space-y-4">
              <div className="flex items-start gap-4 w-full">
                <CardHeaderFavicon domain={rootDomain} />
                
                <div className="flex flex-col min-w-0 flex-grow">
                  <h4 className="font-sans font-bold text-sm uppercase tracking-tight leading-tight">
                    {sanitizeTitle(card.title, card.content)}
                  </h4>
                  <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground line-clamp-1 mt-0.5">
                    {rootDomain.toLowerCase()}
                  </span>
                </div>

                <a
                  href={safeExternalHref(card.content)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 border border-foreground/10 hover:border-accent hover:text-accent transition-colors bg-background flex-shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {bodyText ? (
                <p className="font-mono text-[10px] text-muted-foreground break-words line-clamp-3 leading-relaxed whitespace-pre-wrap">
                  {bodyText}
                </p>
              ) : null}
            </div>
          );
        })()}

        {card.type === "IMAGE" && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setIsLightboxOpen(true);
            }}
            className="cursor-pointer group/image space-y-3"
          >
            <div className="border border-foreground/10 overflow-hidden bg-muted relative group-hover/image:border-accent transition-colors">
              <img
                src={card.content}
                alt={card.title || "Uploaded asset"}
                className="w-full h-auto"
                draggable={false}
              />
            </div>
            <div className="mt-3 space-y-1">
              <h4 className="font-sans font-bold text-xs uppercase tracking-tight line-clamp-1 group-hover/image:text-accent transition-colors">
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
          <div className="space-y-3">
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
          <div className="space-y-3">
            <div className="space-y-2">
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
                        className={`w-4 h-4 shrink-0 border-2 border-foreground flex items-center justify-center transition-all ${
                          item.checked ? "bg-accent text-white border-accent" : "bg-background"
                        }`}
                      >
                        {item.checked && <Check className="w-3 h-3 stroke-[3px]" />}
                      </div>
                      <span
                        className={`font-mono text-[11px] select-none break-words ${
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
                className="bg-accent hover:bg-[#E04B28] text-white border-2 border-foreground px-2.5 font-display font-bold text-[9px] uppercase tracking-wider shadow-[1px_1px_0px_0px_var(--foreground)] hover:-translate-x-[0.5px] hover:-translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_0px_var(--foreground)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center justify-center h-7 cursor-pointer"
              >
                ADD
              </button>
            </form>
          </div>
        )}

        {card.type === "API_KEY" && (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-accent" />
                <h4 className="font-sans font-bold text-sm uppercase tracking-tight line-clamp-1">
                  {card.title || "API KEY"}
                </h4>
              </div>
              {/* ph-no-capture: PostHog session replay must never record the decrypted key value */}
              <div className="ph-no-capture flex items-center justify-between border-2 border-foreground bg-background p-2 font-mono text-xs select-all break-all shadow-[2px_2px_0px_0px_var(--foreground)]">
                <span className="ph-no-capture tracking-widest font-bold">
                  {revealKey && decryptedKey ? decryptedKey : "••••••••••••••••"}
                </span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onMouseEnter={ensureDecryptedKey}
                onFocus={ensureDecryptedKey}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!revealKey) {
                    await ensureDecryptedKey();
                    setRevealKey(true);
                  } else {
                    setRevealKey(false);
                  }
                }}
                className="flex-1 bg-background hover:bg-muted border-2 border-foreground h-8 font-mono text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_0px_var(--foreground)] hover:-translate-x-[0.5px] hover:-translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_0px_var(--foreground)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none font-bold"
              >
                {revealKey ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    HIDE
                  </>
                ) : isRevealing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    REVEAL
                  </>
                )}
              </button>
              <button
                onClick={handleCopyKey}
                className={`flex-1 border-2 border-foreground h-8 font-mono text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_0px_var(--foreground)] hover:-translate-x-[0.5px] hover:-translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_0px_var(--foreground)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none font-bold ${
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

      </div>

      {/* Action Buttons (Visible on hover) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsNotepadOpen(true);
        }}
        className="absolute bottom-2 right-[40px] bg-background hover:bg-accent text-foreground hover:text-white border-2 border-foreground p-1.5 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shadow-[2px_2px_0px_0px_var(--foreground)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_0px_var(--foreground)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
        title="Card Options & Details"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {(card.type === "TEXT" || card.type === "FILE") && (
        <button
          onClick={handleDownloadTxt}
          className="absolute bottom-2 right-[72px] bg-background hover:bg-accent text-foreground hover:text-white border-2 border-foreground p-1.5 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shadow-[2px_2px_0px_0px_var(--foreground)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_0px_var(--foreground)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
          title="Download as .txt"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      )}

      <button
        onClick={handleDelete}
        className="absolute bottom-2 right-[8px] bg-background hover:bg-accent text-foreground hover:text-white border-2 border-foreground p-1.5 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shadow-[2px_2px_0px_0px_var(--foreground)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_0px_var(--foreground)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
        title="Delete Card"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Notepad Editor Modal */}
      {isNotepadOpen && (
        <NotepadModal
          isOpen={isNotepadOpen}
          card={card}
          categories={categories}
          initialTitle={card.title || ""}
          initialContent={card.type === "FILE" ? base64ToString(card.content) : card.content}
          initialDescription={card.metadata?.description || ""}
          cardType={card.type}
          saving={savingNotepad}
          onSave={handleSaveNotepad}
          onClose={() => setIsNotepadOpen(false)}
          onCardCreated={onCardCreated}
          onCardUpdate={onCardUpdate}
        />
      )}

      {/* Image Lightbox Preview Modal */}
      {isLightboxOpen && (
        <ImageLightbox
          isOpen={isLightboxOpen}
          initialTitle={card.title || ""}
          imageUrl={card.content}
          saving={savingLightbox}
          onSave={handleSaveLightbox}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </div>
  );
}

function InlineLinkWidget({ url }: { url: string }) {
  const [title, setTitle] = useState("");
  const [isDark, setIsDark] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  
  useEffect(() => {
    const checkDark = () => {
      if (typeof window !== "undefined") {
        const darkActive = document.documentElement.classList.contains("dark") || 
                           document.documentElement.getAttribute("data-theme")?.startsWith("dark-") || 
                           false;
        setIsDark(darkActive);
      }
    };
    
    checkDark();
    
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"]
    });
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const isYT = url.includes("youtube.com") || url.includes("youtu.be");
    if (!isYT) return;
    
    let active = true;
    const fetchTitle = async () => {
      try {
        const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.title && active) {
          setTitle(stripHashtags(data.title));
        }
      } catch (err) {
        console.error("Inline oEmbed fetch failed:", err);
      }
    };
    fetchTitle();
    return () => {
      active = false;
    };
  }, [url]);

  let domain = "";
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = url;
  }

  return (
    <div 
      onClick={(e) => e.stopPropagation()}
      data-no-dnd="true"
      className={`p-3 my-2 flex items-center justify-between w-full rounded-none gap-3 ${
        isDark 
          ? "border border-white bg-[#181a23] text-white shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]" 
          : "border border-black bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
      }`}
    >
      {faviconError ? (
        <Globe className={`w-5 h-5 flex-shrink-0 ${isDark ? "text-zinc-400" : "text-zinc-600"}`} />
      ) : (
        <img
          src={`/api/favicon?domain=${domain}&sz=64`}
          alt=""
          loading="lazy"
          className="w-5 h-5 object-contain flex-shrink-0"
          onError={() => setFaviconError(true)}
          draggable={false}
        />
      )}

      <div className="flex flex-col flex-1 min-w-0 text-left">
        <span className={`text-xs break-all whitespace-pre-wrap line-clamp-1 ${
          isDark ? "text-zinc-400" : "text-zinc-600"
        }`}>
          {url}
        </span>
        <span className={`text-sm font-bold break-words ${
          isDark ? "text-white" : "text-black"
        }`}>
          {title || url}
        </span>
      </div>

      <a
        href={safeExternalHref(url)}
        target="_blank"
        rel="noopener noreferrer"
        className={`p-2 flex items-center justify-center rounded-none flex-shrink-0 transition-colors ${
          isDark
            ? "border border-white bg-[#1c1e27] text-white shadow-[1px_1px_0px_0px_rgba(255,255,255,1)]"
            : "border border-black bg-white text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
        }`}
        onClick={(e) => e.stopPropagation()}
        data-no-dnd="true"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

function CardHeaderFavicon({ domain }: { domain: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="w-12 h-12 flex-shrink-0 border-2 border-black bg-white rounded-none flex items-center justify-center p-1">
        <Globe className="w-6 h-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={`/api/favicon?domain=${domain}&sz=64`}
      alt=""
      loading="lazy"
      className="w-12 h-12 flex-shrink-0 border-2 border-black bg-white rounded-none object-contain p-1"
      draggable={false}
      onError={() => setHasError(true)}
    />
  );
}

function LinkFavicon({ domain }: { domain: string }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const faviconUrl = `/api/favicon?domain=${domain}&sz=64`;

  return (
    <div className="w-4 h-4 shrink-0 border border-foreground rounded-none bg-muted flex items-center justify-center relative overflow-hidden">
      {status !== "success" && (
        <Globe className="w-2.5 h-2.5 text-muted-foreground absolute inset-0 m-auto" />
      )}
      {status !== "error" && (
        <img
          src={faviconUrl}
          alt=""
          loading="lazy"
          className={`w-full h-full object-contain absolute inset-0 transition-opacity duration-200 ${
            status === "success" ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setStatus("success")}
          onError={() => setStatus("error")}
          draggable={false}
        />
      )}
    </div>
  );
}

export default React.memo(Card);
