"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Link2, Type, FileText, ArrowRight, Loader2, User, LogOut } from "lucide-react";
import Card from "./Card";
import { createCard, updateCardsOrder } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";

interface Category {
  id: string;
  name: string;
  order: number;
}

interface CardType {
  id: string;
  type: string;
  title: string | null;
  content: string;
  metadata: any;
  order: number;
  categoryId: string | null;
}

interface CanvasProps {
  userEmail: string | null;
  activeCategory: Category | null;
  cards: CardType[];
  onCardsChange: React.Dispatch<React.SetStateAction<CardType[]>>;
  onUploadStart: (filename: string) => void;
  onUploadProgress: (progress: number) => void;
  onUploadEnd: () => void;
}

export default function Canvas({
  userEmail,
  activeCategory,
  cards,
  onCardsChange,
  onUploadStart,
  onUploadProgress,
  onUploadEnd,
}: CanvasProps) {
  const [mounted, setMounted] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  // New card form states
  const [cardType, setCardType] = useState<"TEXT" | "LINK">("TEXT");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Drag over window listener for native files
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragActive(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      // Only set inactive if cursor actually leaves the window
      if (e.clientX === 0 && e.clientY === 0) {
        setIsDragActive(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.size > 750000) {
          alert(`File "${file.name}" exceeds the size limit (750KB). Please upload a smaller asset.`);
          continue;
        }

        onUploadStart(file.name);

        // Read file contents
        const reader = new FileReader();

        // Simulate upload progress
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += 10;
          onUploadProgress(Math.min(progress, 90));
        }, 100);

        reader.onload = async (event) => {
          clearInterval(progressInterval);
          onUploadProgress(100);

          const resultStr = event.target?.result as string;
          const catId = activeCategory ? activeCategory.id : null;

          try {
            if (file.type.startsWith("image/")) {
              // Extract image dimensions
              const img = new Image();
              img.onload = async () => {
                const created = await createCard("IMAGE", resultStr, catId, file.name, {
                  size: file.size,
                  width: img.width,
                  height: img.height,
                  mimeType: file.type,
                });
                onCardsChange((prev) => [...prev, created]);
                onUploadEnd();
              };
              img.src = resultStr;
            } else {
              // Regular document file
              const created = await createCard("FILE", resultStr, catId, file.name, {
                size: file.size,
                mimeType: file.type,
              });
              onCardsChange((prev) => [...prev, created]);
              onUploadEnd();
            }
          } catch (err) {
            console.error("Error creating dropped card:", err);
            onUploadEnd();
          }
        };

        if (file.type.startsWith("image/")) {
          reader.readAsDataURL(file);
        } else {
          // Read non-images as data URL too (e.g. PDF/text base64 encoding)
          reader.readAsDataURL(file);
        }
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [activeCategory, onCardsChange, onUploadStart, onUploadProgress, onUploadEnd]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (!activeCategory) return;

    const oldIndex = filteredCards.findIndex((c) => c.id === active.id);
    const newIndex = filteredCards.findIndex((c) => c.id === over.id);
    const reorderedFiltered = arrayMove(filteredCards, oldIndex, newIndex);

    // Reconstruct global cards state by replacing category cards with the reordered ones
    let filteredIndex = 0;
    const reorderedGlobal = cards.map((c) => {
      const isActiveCategoryMatch = c.categoryId === activeCategory.id;
      if (!isActiveCategoryMatch) return c;
      return reorderedFiltered[filteredIndex++];
    });

    onCardsChange(reorderedGlobal);

    try {
      // Reorder only the category-scoped cards
      await updateCardsOrder(reorderedFiltered.map((c) => c.id));
    } catch (err) {
      console.error("Error updating cards order:", err);
    }
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    const catId = activeCategory ? activeCategory.id : null;

    try {
      let created;
      if (cardType === "LINK") {
        // Scrape domain and favicon from URL
        let domain = "";
        try {
          domain = new URL(content.trim()).hostname;
        } catch {
          domain = content.trim();
        }
        const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

        created = await createCard("LINK", content.trim(), catId, title.trim() || domain, {
          domain,
          favicon,
        });
      } else {
        created = await createCard("TEXT", content.trim(), catId, title.trim() || undefined);
      }

      onCardsChange((prev) => [...prev, created]);
      setContent("");
      setTitle("");
    } catch (err) {
      console.error("Error creating card:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCards = cards.filter((c) =>
    activeCategory ? c.categoryId === activeCategory.id : true
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen relative p-6 space-y-6 overflow-y-auto bg-background selection:bg-accent selection:text-white">
      {/* Drag Border Outline Overlay */}
      {isDragActive && (
        <div
          className="absolute inset-4 border-4 border-dashed border-accent bg-accent/5 backdrop-blur-[2px] z-50 flex items-center justify-center pointer-events-none transition-all duration-300"
        >
          <div className="bg-white border-2 border-foreground p-6 shadow-[6px_6px_0px_0px_#0B0C10] flex flex-col items-center space-y-3 pointer-events-auto">
            <div className="w-12 h-12 rounded-full border-2 border-accent border-dashed flex items-center justify-center animate-bounce">
              <Plus className="w-6 h-6 text-accent" />
            </div>
            <h3 className="font-display font-bold uppercase tracking-wider text-sm">
              DROP ASSETS TO DEPOSIT
            </h3>
            <p className="font-mono text-[9px] text-muted-foreground uppercase">
              Images, PDFs, or code logs auto-categorized
            </p>
          </div>
        </div>
      )}

      {/* Canvas Top Navigation / Status Header */}
      <header className="flex justify-between items-center border-b border-foreground/10 pb-4">
        <div className="space-y-1">
          <span className="font-mono text-[10px] text-accent uppercase tracking-widest block font-semibold">
            {activeCategory ? `* 03. CATEGORY / ${activeCategory.name}` : "* 03. ALL INSTANCES"}
          </span>
          <h2 className="font-display font-black text-2xl uppercase tracking-tighter">
            {activeCategory ? activeCategory.name : "PRIMARY CANVAS"}
          </h2>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 border-2 border-foreground bg-white px-3 py-2 shadow-[2px_2px_0px_0px_#0B0C10] text-xs">
            <div className="flex items-center space-x-1.5 font-mono text-[11px] text-foreground">
              <User className="w-3.5 h-3.5 text-accent" />
              <span className="truncate max-w-[150px] font-semibold">{userEmail || "anonymous@domain.com"}</span>
            </div>
            <div className="border-l border-foreground/20 h-4" />
            <button
              onClick={handleLogout}
              className="bg-muted hover:bg-accent hover:text-white border border-foreground font-mono text-[9px] uppercase px-2 py-1 tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              End Session
            </button>
          </div>
        </div>
      </header>

      {/* Quick Add Form Section */}
      <section className="bg-white border-2 border-foreground p-5 shadow-[4px_4px_0px_0px_#0B0C10] space-y-4">
        <div className="flex justify-between items-center border-b border-foreground/10 pb-3">
          <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-accent">
            * ADD CARD TO {activeCategory ? activeCategory.name : "INBOX"}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setCardType("TEXT");
                setContent("");
              }}
              className={`px-3 py-1 border-2 border-foreground font-mono text-[9px] uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                cardType === "TEXT"
                  ? "bg-foreground text-background shadow-[2px_2px_0px_0px_#FF5A36]"
                  : "bg-background hover:bg-muted text-foreground"
              }`}
            >
              <Type className="w-3 h-3" />
              Text Snippet
            </button>
            <button
              onClick={() => {
                setCardType("LINK");
                setContent("");
              }}
              className={`px-3 py-1 border-2 border-foreground font-mono text-[9px] uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                cardType === "LINK"
                  ? "bg-foreground text-background shadow-[2px_2px_0px_0px_#FF5A36]"
                  : "bg-background hover:bg-muted text-foreground"
              }`}
            >
              <Link2 className="w-3 h-3" />
              Web Link
            </button>
          </div>
        </div>

        <form onSubmit={handleCreateCard} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1 space-y-1">
              <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                Card Title (Optional)
              </label>
              <input
                type="text"
                placeholder="LABEL / NAME"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-background border-2 border-foreground px-3 py-2 font-sans text-xs uppercase focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {cardType === "TEXT" ? "Snippet Text / Markdown" : "URL Address"}
              </label>
              <div className="flex gap-2">
                <input
                  type={cardType === "TEXT" ? "text" : "url"}
                  placeholder={cardType === "TEXT" ? "ENTER NOTES OR CODE LOGS" : "https://example.com/resource"}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  className="flex-grow bg-background border-2 border-foreground px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-accent hover:bg-[#E04B28] text-white border-2 border-foreground px-4 py-2 font-display font-bold text-xs uppercase tracking-widest shadow-[2px_2px_0px_0px_#0B0C10] hover:shadow-[1px_1px_0px_0px_#0B0C10] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-1.5"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  COMMIT
                </button>
              </div>
            </div>
          </div>
        </form>
      </section>

      {/* Grid Canvas Sortable Section */}
      <section className="flex-grow">
        {mounted && filteredCards.length > 0 ? (
          activeCategory !== null ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={filteredCards} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredCards.map((card) => (
                    <Card
                      key={card.id}
                      card={card}
                      onDelete={(id) => {
                        onCardsChange((prev) => prev.filter((c) => c.id !== id));
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCards.map((card) => (
                <Card
                  key={card.id}
                  card={card}
                  onDelete={(id) => {
                    onCardsChange((prev) => prev.filter((c) => c.id !== id));
                  }}
                />
              ))}
            </div>
          )
        ) : (
          mounted && (
            <div className="flex flex-col items-center justify-center border-4 border-dashed border-foreground/10 rounded bg-muted/30 py-20 px-6 text-center space-y-4">
              <div className="p-3 border-2 border-foreground bg-white shadow-[3px_3px_0px_0px_#0B0C10]">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-bold uppercase tracking-wider text-sm">
                  NO ASSETS IN THIS VIEW
                </h3>
                <p className="font-mono text-[9px] text-muted-foreground uppercase max-w-xs leading-relaxed mx-auto">
                  Drag and drop files onto the window, or use the quick add form above to place your first canvas card.
                </p>
              </div>
            </div>
          )
        )}
      </section>
    </div>
  );
}
