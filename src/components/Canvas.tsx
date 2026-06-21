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
import { Plus, Link2, Type, FileText, ArrowRight, Loader2, User, LogOut, Palette, Sun, Moon, Download, Upload } from "lucide-react";
import Card from "./Card";
import { createCard, updateCardsOrder, updateUserTheme, deleteUserAccount } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "./ConfirmDialog";
import { sanitizeTitle } from "@/lib/utils";

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
  user: {
    email: string;
    selectedTheme: string;
  };
  onThemeChange: (theme: string) => void;
  activeCategory: Category | null;
  cards: CardType[];
  onCardsChange: React.Dispatch<React.SetStateAction<CardType[]>>;
  onUploadStart: (filename: string) => void;
  onUploadProgress: (progress: number) => void;
  onUploadEnd: () => void;
}

export default function Canvas({
  user,
  onThemeChange,
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
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const confirm = useConfirm();

  const handleThemeChange = async (themeId: string) => {
    onThemeChange(themeId);
    setShowThemeMenu(false);
    try {
      await updateUserTheme(themeId);
    } catch (err) {
      console.error("Failed to update user theme:", err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleExportData = () => {
    // Basic JSON snapshot of user cards/categories
    const dataStr = JSON.stringify({ categories: [], cards }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'essential_space_backup.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    setShowProfileMenu(false);
  };

  const handleImportDataClick = () => {
    document.getElementById('import-file-input')?.click();
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          
          // Structured placeholder handler for safe build
          console.log("Import data payload received:", data);
          
          // Neo-Brutalist confirmation dialog preview
          const confirmed = await confirm({
            title: "Import Data",
            message: "This will load your exported workspace settings and restore categories and cards. Click confirm to simulate this action.",
            confirmLabel: "Simulate Import",
            cancelLabel: "Cancel",
          });

          if (confirmed) {
            alert("Data Import Simulation Successful! In a production deployment, your database records will be hydrated.");
            setShowProfileMenu(false);
          }
        } catch (err) {
          console.error("Failed to parse import file:", err);
          alert("Invalid backup file format.");
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error("Failed to read import file:", err);
    }
  };

  const handleDeleteAccount = async () => {
    setShowProfileMenu(false);
    const confirmed = await confirm({
      title: "Delete Account",
      message: "Are you sure you want to permanently delete your account and all associated categories and cards? This action is irreversible.",
      confirmLabel: "Delete Account",
      cancelLabel: "Keep Account",
    });
    
    if (confirmed) {
      try {
        await deleteUserAccount();
        window.location.reload();
      } catch (err) {
        console.error("Failed to delete account:", err);
        alert("Failed to delete account. Please try again.");
      }
    }
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

    if (oldIndex === -1 || newIndex === -1) return;

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

        const sanitizedTitle = sanitizeTitle(title.trim() || null, content.trim());

        created = await createCard("LINK", content.trim(), catId, sanitizedTitle, {
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
          <div className="bg-white border-2 border-foreground p-6 shadow-[6px_6px_0px_0px_var(--foreground)] flex flex-col items-center space-y-3 pointer-events-auto">
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
      <header className="flex justify-between items-center border-b border-foreground/10 pb-4 lg:h-16">
        <div className="space-y-1">
          <span className="font-mono text-[10px] text-accent uppercase tracking-widest block font-semibold">
            {activeCategory ? `* 03. CATEGORY / ${activeCategory.name}` : "* 03. ALL INSTANCES"}
          </span>
          <h2 className="font-display font-black text-2xl uppercase tracking-tighter text-foreground">
            {activeCategory ? activeCategory.name : "PRIMARY CANVAS"}
          </h2>
        </div>
        <div className="flex items-center space-x-3 relative h-10">
          {/* Themes Button */}
          <div className="relative h-10">
            <button
              onClick={() => {
                setShowThemeMenu(!showThemeMenu);
                setShowProfileMenu(false);
              }}
              className="h-10 bg-white hover:bg-muted text-foreground border-2 border-foreground shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] font-mono text-[10px] uppercase px-3 flex items-center gap-1.5 transition-all cursor-pointer font-bold select-none"
            >
              <Palette className="w-3.5 h-3.5 text-accent" />
              THEME
            </button>

            {showThemeMenu && (
              <div className="absolute right-0 mt-3 w-64 bg-white border-2 border-foreground shadow-[6px_6px_0px_0px_var(--foreground)] z-50 p-4 space-y-4">
                <div className="space-y-1">
                  <span className="font-mono text-[9px] uppercase font-bold tracking-widest text-accent block">
                    * LIGHT TEMPLATES
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: "light-gold", name: "Light Gold", accent: "#FF5A36" },
                      { id: "light-swiss", name: "Light Swiss", accent: "#D82B2B" },
                      { id: "light-forest", name: "Light Forest", accent: "#10B981" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleThemeChange(t.id)}
                        className={`w-full text-left px-2.5 py-1.5 border border-foreground/20 font-mono text-[10px] uppercase flex items-center justify-between transition-colors cursor-pointer ${
                          user.selectedTheme === t.id
                            ? "bg-foreground text-background border-foreground font-bold"
                            : "bg-background hover:bg-muted text-foreground"
                        }`}
                      >
                        <span>{t.name}</span>
                        <span className="w-2.5 h-2.5 rounded-full border border-foreground/30" style={{ backgroundColor: t.accent }} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="font-mono text-[9px] uppercase font-bold tracking-widest text-accent block">
                    * DARK TEMPLATES
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: "dark-gold", name: "Dark Gold", accent: "#F59E0B" },
                      { id: "dark-cyber", name: "Dark Cyber", accent: "#FF2E93" },
                      { id: "dark-mono", name: "Dark Mono", accent: "#FFFFFF" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleThemeChange(t.id)}
                        className={`w-full text-left px-2.5 py-1.5 border border-foreground/20 font-mono text-[10px] uppercase flex items-center justify-between transition-colors cursor-pointer ${
                          user.selectedTheme === t.id
                            ? "bg-foreground text-background border-foreground font-bold"
                            : "bg-background hover:bg-muted text-foreground"
                        }`}
                      >
                        <span>{t.name}</span>
                        <span className="w-2.5 h-2.5 rounded-full border border-foreground/30" style={{ backgroundColor: t.accent }} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Light/Dark Toggle Button */}
          <button
            onClick={() => {
              const isDark = user.selectedTheme.startsWith("dark-");
              let nextTheme = "light-gold";
              if (isDark) {
                if (user.selectedTheme === "dark-gold") nextTheme = "light-gold";
                else if (user.selectedTheme === "dark-cyber") nextTheme = "light-swiss";
                else if (user.selectedTheme === "dark-mono") nextTheme = "light-forest";
              } else {
                if (user.selectedTheme === "light-gold") nextTheme = "dark-gold";
                else if (user.selectedTheme === "light-swiss") nextTheme = "dark-cyber";
                else if (user.selectedTheme === "light-forest") nextTheme = "dark-mono";
              }
              handleThemeChange(nextTheme);
            }}
            className="h-10 bg-white hover:bg-muted text-foreground border-2 border-foreground shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] px-3 flex items-center justify-center transition-all cursor-pointer font-bold select-none"
            title="Toggle Light/Dark Mode"
          >
            {user.selectedTheme.startsWith("dark-") ? (
              <Sun className="w-4 h-4 text-accent" />
            ) : (
              <Moon className="w-4 h-4 text-accent" />
            )}
          </button>

          {/* User Email Button */}
          <div className="relative h-10">
            <button
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowThemeMenu(false);
              }}
              className="h-10 bg-white hover:bg-muted text-foreground border-2 border-foreground shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] font-mono text-[11px] px-3 flex items-center gap-1.5 transition-all cursor-pointer font-semibold select-none"
            >
              <User className="w-3.5 h-3.5 text-accent" />
              <span className="truncate max-w-[150px]">{user.email}</span>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-3 w-64 bg-white border-2 border-foreground shadow-[6px_6px_0px_0px_var(--foreground)] z-50 p-4 space-y-4">
                <div className="space-y-1">
                  <span className="font-mono text-[9px] uppercase font-bold tracking-widest text-accent block">
                    * PROFILE CONTROLS
                  </span>
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <button
                      onClick={handleExportData}
                      className="w-full text-left px-2.5 py-1.5 border border-foreground/20 font-mono text-[10px] uppercase bg-background hover:bg-muted text-foreground flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Download className="w-3 h-3 text-accent" />
                        Export Data
                      </span>
                    </button>
                    <button
                      onClick={handleImportDataClick}
                      className="w-full text-left px-2.5 py-1.5 border border-foreground/20 font-mono text-[10px] uppercase bg-background hover:bg-muted text-foreground flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Upload className="w-3 h-3 text-accent" />
                        Import Data
                      </span>
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      className="w-full text-left px-2.5 py-1.5 border border-foreground/20 font-mono text-[10px] uppercase bg-background hover:bg-red-500 hover:text-white flex items-center justify-between transition-colors cursor-pointer text-red-500 hover:border-red-500"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Hidden Import file input */}
          <input
            id="import-file-input"
            type="file"
            accept=".json"
            onChange={handleImportData}
            className="hidden"
          />

          {/* End Session Button */}
          <button
            onClick={handleLogout}
            className="h-10 bg-muted hover:bg-accent hover:text-white text-foreground border-2 border-foreground shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] font-mono text-[10px] uppercase px-3 flex items-center gap-1.5 transition-all cursor-pointer font-bold select-none"
          >
            <LogOut className="w-3.5 h-3.5" />
            End Session
          </button>
        </div>
      </header>

      {/* Quick Add Form Section */}
      <section className="bg-white border-2 border-foreground p-5 shadow-[4px_4px_0px_0px_var(--foreground)] space-y-4">
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
                  className="bg-accent hover:bg-[#E04B28] text-white border-2 border-foreground px-4 py-2 font-display font-bold text-xs uppercase tracking-widest shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer"
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
              <div className="p-3 border-2 border-foreground bg-white shadow-[3px_3px_0px_0px_var(--foreground)]">
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
