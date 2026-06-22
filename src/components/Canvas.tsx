"use client";

import { useState, useEffect, useRef } from "react";
import posthog from "posthog-js";
import {
  DndContext,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Link2, Type, FileText, ArrowRight, Loader2, User, LogOut, Palette, Sun, Moon, Download, Upload, Pencil, CheckSquare, Key } from "lucide-react";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import Card from "./Card";
import { createCard, updateCardsOrder, updateCard, updateUserTheme, deleteUserAccount, renameCategory, getLiveStorageMetrics } from "@/app/actions";
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
  currentTheme: string;
  onThemeChange: (theme: string) => void;
  activeCategory: Category | null;
  categories: Category[];
  cards: CardType[];
  onCardsChange: React.Dispatch<React.SetStateAction<CardType[]>>;
  onUploadStart: (filename: string) => void;
  onUploadProgress: (progress: number) => void;
  onUploadEnd: () => void;
}

export default function Canvas({
  user,
  currentTheme,
  onThemeChange,
  activeCategory,
  categories,
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

  const filteredCards = cards
    .filter((c) => (activeCategory ? c.categoryId === activeCategory.id : true))
    .sort((a, b) => a.order - b.order);

  const [activeId, setActiveId] = useState<string | null>(null);

  const [liveStorageMB, setLiveStorageMB] = useState<number | null>(null);

  useEffect(() => {
    if (showProfileMenu) {
      getLiveStorageMetrics()
        .then((mb) => {
          setLiveStorageMB(mb);
        })
        .catch((err) => {
          console.error("Error fetching live storage metrics:", err);
          setLiveStorageMB(0.01);
        });
    }
  }, [showProfileMenu]);

  const realMB = liveStorageMB !== null ? liveStorageMB : 0.01;
  const maxStorageMB = 10.00;
  const storagePercentage = Math.min(100, Math.round((realMB / maxStorageMB) * 100));

  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);

  const handleRenameCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCategory || renaming) return;
    const trimmed = renameName.trim();
    if (!trimmed) return;

    // Optimistically update the category name in the parent state before awaiting
    const prevCategories = categories;
    setRenaming(true);
    try {
      await renameCategory(activeCategory.id, trimmed);
      setIsRenameModalOpen(false);
    } catch (err) {
      console.error("Failed to rename category:", err);
      alert("Failed to rename category. Please make sure the name is unique.");
    } finally {
      setRenaming(false);
    }
  };

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
    posthog.reset(); // detach PostHog session before the auth cookie is cleared
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
  const [cardType, setCardType] = useState<"TEXT" | "LINK" | "CHECKLIST" | "API_KEY">("TEXT");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragCounter = useRef(0);
  const activeCategoryIdRef = useRef<string | null>(null);

  const themeMenuRef = useRef<HTMLDivElement>(null);
  const themeTriggerRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);

  // Global click-outside listener with bubbling protection, detached node interception, and portal-safe exception (Phase 6)
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 1. Detached Node Interception: if node unmounted during operation, skip click-away check
      if (!document.body.contains(target)) {
        return;
      }

      // 2. Portal-Safe Exception: if target is inside any portal, skip click-away check
      if (target.closest('[data-portal="true"]')) {
        return;
      }

      // 3. Bubbling Protection: check theme trigger before collapsing menu
      if (showThemeMenu && themeMenuRef.current && !themeMenuRef.current.contains(target)) {
        const isThemeTriggerClick = themeTriggerRef.current && themeTriggerRef.current.contains(target);
        if (!isThemeTriggerClick) {
          setShowThemeMenu(false);
        }
      }

      // 4. Bubbling Protection: check profile trigger before collapsing menu
      if (showProfileMenu && profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        const isProfileTriggerClick = profileTriggerRef.current && profileTriggerRef.current.contains(target);
        if (!isProfileTriggerClick) {
          setShowProfileMenu(false);
        }
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [showThemeMenu, showProfileMenu]);

  useEffect(() => {
    activeCategoryIdRef.current = activeCategory ? activeCategory.id : null;
  }, [activeCategory]);

  // Auto-expanding textarea handler (Constraint 1)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content, cardType]);

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

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  // Drag over window listener for native files (Phase 5)
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      const isFileDrag = e.dataTransfer?.types.includes("Files");
      if (!isFileDrag) return;

      const target = e.target as HTMLElement;
      const isInputOrTextarea = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isInputOrTextarea) return;

      e.preventDefault();
      dragCounter.current += 1;
      if (dragCounter.current === 1) {
        setIsDragActive(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      const isFileDrag = e.dataTransfer?.types.includes("Files");
      if (!isFileDrag) return;

      const target = e.target as HTMLElement;
      const isInputOrTextarea = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isInputOrTextarea) return;

      e.preventDefault();
    };

    const handleDragLeave = (e: DragEvent) => {
      const isFileDrag = e.dataTransfer?.types.includes("Files");
      if (!isFileDrag) return;

      const target = e.target as HTMLElement;
      const isInputOrTextarea = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isInputOrTextarea) return;

      e.preventDefault();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragActive(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      const target = e.target as HTMLElement;
      const isInputOrTextarea = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isInputOrTextarea) {
        return;
      }

      e.preventDefault();
      setIsDragActive(false);
      dragCounter.current = 0;

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);

      // Payload Safe Guardrails: 10MB per file check
      const maxSize = 10 * 1024 * 1024; // 10MB
      for (const file of fileArray) {
        if (file.size > maxSize) {
          await confirm({
            title: "Payload Limit Exceeded",
            message: `File "${file.name}" (${formatBytes(file.size)}) exceeds the maximum size limit of 10MB. Operation aborted.`,
            confirmLabel: "Understood",
          });
          return;
        }
      }

      onUploadStart(`${fileArray.length} Assets`);
      onUploadProgress(10);

      try {
        const catId = activeCategoryIdRef.current;
        const uploadOne = (file: File): Promise<any> => {
          return new Promise<any>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
              const resultStr = event.target?.result as string;
              try {
                if (file.type.startsWith("image/")) {
                  const img = new Image();
                  img.onload = async () => {
                    try {
                      const created = await createCard("IMAGE", resultStr, catId, file.name, {
                        size: file.size,
                        width: img.width,
                        height: img.height,
                        mimeType: file.type,
                      });
                      resolve(created);
                    } catch (err) {
                      reject(err);
                    }
                  };
                  img.onerror = () => reject(new Error("Failed to load image element"));
                  img.src = resultStr;
                } else {
                  const created = await createCard("FILE", resultStr, catId, file.name, {
                    size: file.size,
                    mimeType: file.type,
                  });
                  resolve(created);
                }
              } catch (err) {
                reject(err);
              }
            };
            reader.onerror = () => reject(new Error("File reading failed"));
            reader.readAsDataURL(file);
          });
        };

        // Upload sequentially so the server assigns `order` correctly
        // (parallel uploads race on count()), and track per-file failures.
        onUploadProgress(40);
        const createdCards: any[] = [];
        const failed: string[] = [];
        for (let i = 0; i < fileArray.length; i++) {
          try {
            createdCards.push(await uploadOne(fileArray[i]));
          } catch (err) {
            console.error(`Failed to upload "${fileArray[i].name}":`, err);
            failed.push(fileArray[i].name);
          }
          onUploadProgress(40 + Math.round(((i + 1) / fileArray.length) * 40));
        }
        onUploadProgress(80);

        if (createdCards.length > 0) {
          onCardsChange((prev) => [...prev, ...createdCards]);
        }
        onUploadProgress(100);

        if (failed.length > 0) {
          await confirm({
            title: "Some Uploads Failed",
            message: `${createdCards.length} saved, ${failed.length} failed: ${failed.join(", ")}`,
            confirmLabel: "Close",
          });
        }
      } catch (err) {
        console.error("Error uploading dropped assets:", err);
        await confirm({
          title: "Upload Failed",
          message: "An error occurred during file upload. Some assets might not have been saved.",
          confirmLabel: "Close",
        });
      } finally {
        onUploadEnd();
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [onCardsChange, onUploadStart, onUploadProgress, onUploadEnd]);

  // Clipboard Screenshot Paste Handler (Phase 5)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Focus Exclusion check
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.hasAttribute("contenteditable") ||
        (activeEl as HTMLElement).isContentEditable
      )) {
        return; // standard text copy-pasting functions normally
      }

      const files = e.clipboardData?.files;
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files).filter(file => file.type.startsWith("image/"));
      if (fileArray.length === 0) return;

      e.preventDefault();

      // Payload Safe Guardrails: 10MB per file check
      const maxSize = 10 * 1024 * 1024; // 10MB
      for (const file of fileArray) {
        if (file.size > maxSize) {
          await confirm({
            title: "Payload Limit Exceeded",
            message: `Pasted screenshot "${file.name}" (${formatBytes(file.size)}) exceeds the maximum size limit of 10MB. Operation aborted.`,
            confirmLabel: "Understood",
          });
          return;
        }
      }

      onUploadStart(`${fileArray.length} Pasted Assets`);
      onUploadProgress(20);

      try {
        const catId = activeCategoryIdRef.current;
        const uploadOne = (file: File): Promise<any> => {
          return new Promise<any>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
              const resultStr = event.target?.result as string;
              try {
                const img = new Image();
                img.onload = async () => {
                  try {
                    const created = await createCard("IMAGE", resultStr, catId, `Pasted Image - ${new Date().toLocaleTimeString()}`, {
                      size: file.size,
                      width: img.width,
                      height: img.height,
                      mimeType: file.type,
                    });
                    resolve(created);
                  } catch (err) {
                    reject(err);
                  }
                };
                img.onerror = () => reject(new Error("Failed to load image element"));
                img.src = resultStr;
              } catch (err) {
                reject(err);
              }
            };
            reader.onerror = () => reject(new Error("File reading failed"));
            reader.readAsDataURL(file);
          });
        };

        // Upload sequentially (correct `order`) and track per-file failures.
        onUploadProgress(50);
        const createdCards: any[] = [];
        const failed: string[] = [];
        for (let i = 0; i < fileArray.length; i++) {
          try {
            createdCards.push(await uploadOne(fileArray[i]));
          } catch (err) {
            console.error(`Failed to upload pasted "${fileArray[i].name}":`, err);
            failed.push(fileArray[i].name);
          }
        }
        onUploadProgress(80);

        if (createdCards.length > 0) {
          onCardsChange((prev) => [...prev, ...createdCards]);
        }
        onUploadProgress(100);

        if (failed.length > 0) {
          await confirm({
            title: "Some Pastes Failed",
            message: `${createdCards.length} saved, ${failed.length} failed.`,
            confirmLabel: "Close",
          });
        }
      } catch (err) {
        console.error("Error uploading pasted assets:", err);
        await confirm({
          title: "Paste Upload Failed",
          message: "An error occurred during paste upload.",
          confirmLabel: "Close",
        });
      } finally {
        onUploadEnd();
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [onCardsChange, onUploadStart, onUploadProgress, onUploadEnd]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) return;

    const activeIndex = filteredCards.findIndex((c) => String(c.id) === activeId);
    const overIndex = filteredCards.findIndex((c) => String(c.id) === overId);

    if (activeIndex === -1 || overIndex === -1) return;

    const reorderedFiltered = arrayMove(filteredCards, activeIndex, overIndex);

    const updatedFiltered = reorderedFiltered.map((c, index) => ({
      ...c,
      order: index,
    }));

    const updatedCards = cards.map((c) => {
      const match = updatedFiltered.find((uf) => uf.id === c.id);
      return match ? match : c;
    });

    onCardsChange(updatedCards);

    try {
      await updateCardsOrder(updatedFiltered.map((c) => c.id));
    } catch (err) {
      console.error("Failed to save reordered cards:", err);
      onCardsChange(cards); // revert the optimistic reorder
      await confirm({
        title: "Reorder Failed",
        message: "Your new card order couldn't be saved, so it's been reverted.",
        confirmLabel: "Close",
      });
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
      } else if (cardType === "CHECKLIST") {
        const lines = content.split("\n").map(l => l.trim()).filter(Boolean);
        const checklistItems = lines.map((text, idx) => ({
          id: `${Date.now()}-${idx}`,
          text,
          checked: false
        }));
        created = await createCard("CHECKLIST", content.trim(), catId, title.trim() || "Checklist", {
          items: checklistItems
        });
      } else if (cardType === "API_KEY") {
        created = await createCard("API_KEY", content.trim(), catId, title.trim() || "API Key", {});
      } else {
        created = await createCard("TEXT", content.trim(), catId, title.trim() || undefined);
      }

      onCardsChange((prev) => [...prev, created]);
      setContent("");
      setTitle("");
    } catch (err) {
      console.error("Error creating card:", err);
      await confirm({
        title: "Couldn't Save Card",
        message: "Something went wrong creating your card. Please try again.",
        confirmLabel: "Close",
      });
    } finally {
      setSubmitting(false);
    }
  };



  return (
    <div className="flex-1 flex flex-col min-h-screen relative p-6 space-y-6 overflow-y-auto bg-background selection:bg-accent selection:text-white">
      {/* Drag Border Outline Overlay */}
      {isDragActive && (
        <div
          className="absolute inset-4 border-4 border-dashed border-accent bg-accent/5 backdrop-blur-[2px] z-50 flex items-center justify-center pointer-events-none transition-all duration-300"
        >
          <div className="bg-card border-2 border-foreground p-6 shadow-[6px_6px_0px_0px_var(--foreground)] flex flex-col items-center space-y-3 pointer-events-auto">
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
          <div className="flex items-center space-x-2 group">
            <h2 className="font-display font-black text-2xl uppercase tracking-tighter text-foreground">
              {activeCategory ? activeCategory.name : "PRIMARY CANVAS"}
            </h2>
            {activeCategory && (
              <button
                onClick={() => {
                  setRenameName(activeCategory.name); // Pre-populate!
                  setIsRenameModalOpen(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-accent transition-all cursor-pointer text-muted-foreground"
                title="Rename Category"
              >
                <Pencil className="w-4 h-4 text-foreground hover:text-accent" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-3 relative h-10">
          {/* Themes Button */}
          <div className="relative h-10" ref={themeMenuRef}>
            <button
              ref={themeTriggerRef}
              onClick={() => {
                setShowThemeMenu(!showThemeMenu);
                setShowProfileMenu(false);
              }}
              className="h-10 bg-card hover:bg-muted text-foreground border-2 border-foreground shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] font-mono text-[10px] uppercase px-3 flex items-center gap-1.5 transition-all cursor-pointer font-bold select-none"
            >
              <Palette className="w-3.5 h-3.5 text-accent" />
              THEME
            </button>

            {showThemeMenu && (
              <div className="absolute right-0 mt-3 w-64 bg-card border-2 border-foreground shadow-[6px_6px_0px_0px_var(--foreground)] z-50 p-4 space-y-4">
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
                        className={`w-full text-left px-2.5 py-1.5 border border-foreground/20 font-mono text-[10px] uppercase flex items-center justify-between transition-colors cursor-pointer ${currentTheme === t.id
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
                        className={`w-full text-left px-2.5 py-1.5 border border-foreground/20 font-mono text-[10px] uppercase flex items-center justify-between transition-colors cursor-pointer ${currentTheme === t.id
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
              const isDark = currentTheme.startsWith("dark-");
              let nextTheme = "light-gold";
              if (isDark) {
                if (currentTheme === "dark-gold") nextTheme = "light-gold";
                else if (currentTheme === "dark-cyber") nextTheme = "light-swiss";
                else if (currentTheme === "dark-mono") nextTheme = "light-forest";
              } else {
                if (currentTheme === "light-gold") nextTheme = "dark-gold";
                else if (currentTheme === "light-swiss") nextTheme = "dark-cyber";
                else if (currentTheme === "light-forest") nextTheme = "dark-mono";
              }
              handleThemeChange(nextTheme);
            }}
            className="h-10 bg-card hover:bg-muted text-foreground border-2 border-foreground shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] px-3 flex items-center justify-center transition-all cursor-pointer font-bold select-none"
            title="Toggle Light/Dark Mode"
          >
            {currentTheme.startsWith("dark-") ? (
              <Sun className="w-4 h-4 text-accent" />
            ) : (
              <Moon className="w-4 h-4 text-accent" />
            )}
          </button>

          {/* User Email Button */}
          <div className="relative h-10" ref={profileMenuRef}>
            <button
              ref={profileTriggerRef}
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowThemeMenu(false);
              }}
              className="h-10 bg-card hover:bg-muted text-foreground border-2 border-foreground shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] font-mono text-[11px] px-3 flex items-center gap-1.5 transition-all cursor-pointer font-semibold select-none"
            >
              <User className="w-3.5 h-3.5 text-accent" />
              <span className="truncate max-w-[150px]">{user.email}</span>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-3 w-64 bg-card border-2 border-foreground shadow-[6px_6px_0px_0px_var(--foreground)] z-50 p-4 space-y-4">
                <div className="space-y-1">
                  <span className="font-mono text-[9px] uppercase font-bold tracking-widest text-accent block">
                    * PROFILE CONTROLS
                  </span>

                  <div className="flex flex-col gap-1.5 w-full my-3">
                    <div className="flex items-center justify-between w-full text-[10px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      <span>STORAGE // {realMB.toFixed(2)} MB OF {maxStorageMB.toFixed(2)} MB</span>
                      <span>{storagePercentage}%</span>
                    </div>
                    <div className="w-full h-4 border-2 border-black dark:border-white bg-zinc-100 dark:bg-zinc-900 rounded-none overflow-hidden relative shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(255,255,255,1)]">
                      <div
                        className="h-full bg-[#ff4500] dark:bg-[#ff551a] border-r-2 border-black dark:border-white transition-all duration-300"
                        style={{ width: `${storagePercentage}%` }}
                      />
                    </div>
                    <div className="w-full border-t border-dashed border-zinc-300 dark:border-zinc-700 mt-2.5" />
                  </div>

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
      <section className="bg-card border-2 border-foreground p-5 shadow-[4px_4px_0px_0px_var(--foreground)] space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-foreground/10 pb-3 gap-2">
          <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-accent">
            * ADD CARD TO {activeCategory ? activeCategory.name : "INBOX"}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setCardType("TEXT");
                setContent("");
              }}
              type="button"
              className={`h-10 px-3 border-2 border-foreground font-mono text-[9px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] ${cardType === "TEXT"
                  ? "bg-foreground text-background"
                  : "bg-card hover:bg-muted text-foreground"
                }`}
            >
              <Type className="w-3.5 h-3.5" />
              Text Snippet
            </button>
            <button
              onClick={() => {
                setCardType("LINK");
                setContent("");
              }}
              type="button"
              className={`h-10 px-3 border-2 border-foreground font-mono text-[9px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] ${cardType === "LINK"
                  ? "bg-foreground text-background"
                  : "bg-card hover:bg-muted text-foreground"
                }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              Web Link
            </button>
            <button
              onClick={() => {
                setCardType("CHECKLIST");
                setContent("");
              }}
              type="button"
              className={`h-10 px-3 border-2 border-foreground font-mono text-[9px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] ${cardType === "CHECKLIST"
                  ? "bg-foreground text-background"
                  : "bg-card hover:bg-muted text-foreground"
                }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Checklist
            </button>
            <button
              onClick={() => {
                setCardType("API_KEY");
                setContent("");
              }}
              type="button"
              className={`h-10 px-3 border-2 border-foreground font-mono text-[9px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] ${cardType === "API_KEY"
                  ? "bg-foreground text-background"
                  : "bg-card hover:bg-muted text-foreground"
                }`}
            >
              <Key className="w-3.5 h-3.5" />
              API Key
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
                className="w-full bg-background border-2 border-foreground px-3 py-2 font-sans text-xs uppercase focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-foreground/50"
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {cardType === "TEXT" && "Snippet Text / Markdown"}
                {cardType === "LINK" && "URL Address"}
                {cardType === "CHECKLIST" && "Checklist Items (One per line)"}
                {cardType === "API_KEY" && "Secret Key String"}
              </label>
              <div className="flex gap-2 items-start">
                {cardType === "TEXT" || cardType === "CHECKLIST" ? (
                  <textarea
                    ref={textareaRef}
                    placeholder={cardType === "TEXT" ? "Enter notes, code blocks, URLs, or checklists (- [ ] task)..." : "Item 1\nItem 2\nItem 3"}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                    rows={1}
                    className="flex-grow bg-background border-2 border-foreground px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-foreground/50 resize-none min-h-[40px] overflow-hidden"
                  />
                ) : (
                  <input
                    type={cardType === "LINK" ? "url" : "text"}
                    placeholder={cardType === "LINK" ? "https://example.com/resource" : "sk_live_..."}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                    className="flex-grow bg-background border-2 border-foreground px-3 py-2.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-foreground/50 h-10"
                  />
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-accent hover:bg-[#E04B28] text-white border-2 border-foreground px-4 py-2 font-display font-bold text-xs uppercase tracking-widest shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer h-10 flex-shrink-0"
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
        {filteredCards.length > 0 ? (
          (() => {
            const activeCard = mounted ? cards.find((c) => String(c.id) === activeId) : undefined;

            // SSR / pre-hydration: render a plain grid without dnd wrappers to avoid
            // dnd-kit hydration mismatches and to ship card HTML in the initial document.
            if (!mounted || activeCategory === null) {
              return (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gridAutoRows: "1px",
                    gap: "24px",
                    alignItems: "start",
                  }}
                >
                  {filteredCards.map((card) => (
                    <Card
                      key={card.id}
                      card={card}
                      onDelete={(id) => {
                        onCardsChange((prev) => prev.filter((c) => c.id !== id));
                      }}
                      onCardUpdate={(updated) => {
                        onCardsChange((prev) =>
                          prev.map((c) => (c.id === updated.id ? updated : c))
                        );
                      }}
                    />
                  ))}
                </div>
              );
            }

            // Post-hydration with an active category: full drag-and-drop grid.
            return (
              <DndContext
                id="canvas-cards-dnd"
                sensors={sensors}
                collisionDetection={rectIntersection}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveId(null)}
                modifiers={[restrictToWindowEdges]}
              >
                <SortableContext
                  items={filteredCards.map((c) => String(c.id))}
                  strategy={rectSortingStrategy}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                      gridAutoRows: "1px",
                      gap: "24px",
                      alignItems: "start",
                    }}
                  >
                    {filteredCards.map((card) => (
                      <Card
                        key={card.id}
                        card={card}
                        onDelete={(id) => {
                          onCardsChange((prev) => prev.filter((c) => c.id !== id));
                        }}
                        onCardUpdate={(updated) => {
                          onCardsChange((prev) =>
                            prev.map((c) => (c.id === updated.id ? updated : c))
                          );
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>

                <DragOverlay>
                  {activeCard ? (
                    <div className="w-full h-fit pointer-events-none select-none">
                      <Card card={activeCard} isOverlay />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            );
          })()
        ) : (
          mounted && (
            <div className="flex flex-col items-center justify-center border-4 border-dashed border-foreground/10 rounded bg-muted/30 py-20 px-6 text-center space-y-4">
              <div className="p-3 border-2 border-foreground bg-card shadow-[3px_3px_0px_0px_var(--foreground)]">
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

      {/* Neo-Brutalist Rename Category Modal */}
      {isRenameModalOpen && activeCategory && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsRenameModalOpen(false);
            }
          }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-card border-4 border-foreground p-6 shadow-[6px_6px_0px_0px_var(--foreground)] w-full max-w-md space-y-4">
            <div className="flex justify-between items-center border-b-2 border-foreground pb-2">
              <span className="font-mono text-xs uppercase font-bold tracking-widest text-accent">
                * RENAME CATEGORY
              </span>
              <button
                onClick={() => setIsRenameModalOpen(false)}
                className="font-mono text-xs font-bold hover:text-accent cursor-pointer"
              >
                [CLOSE]
              </button>
            </div>

            <form onSubmit={handleRenameCategorySubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  New Category Name
                </label>
                <input
                  type="text"
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  className="w-full bg-background border-2 border-foreground px-3 py-2 font-display font-semibold text-xs tracking-wider uppercase focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-foreground/50"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  className="px-4 py-2 border-2 border-foreground bg-muted hover:bg-foreground/10 font-mono text-[10px] uppercase font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renaming || !renameName.trim()}
                  className="px-4 py-2 border-2 border-foreground bg-accent text-white font-mono text-[10px] uppercase font-bold shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {renaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
