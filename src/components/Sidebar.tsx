"use client";

import { useState, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
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
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createCategory, deleteCategory, updateCategoriesOrder, renameCategory } from "@/app/actions";
import Logo from "@/components/Logo";
import { useConfirm } from "./ConfirmDialog";
import Link from "next/link";
import { Folder, FolderOpen, Plus, Trash2, Loader2, Pencil } from "lucide-react";

interface Category {
  id: string;
  name: string;
  order: number;
}

interface SidebarProps {
  categories: Category[];
  activeCategoryId: string | null;
  cardCounts: Record<string, number>;
  onSelectCategory: (id: string | null) => void;
  onCategoriesChange: (categories: Category[]) => void;
  uploadProgress: { filename: string; progress: number } | null;
  theme?: string;
}

function SortableCategoryItem({
  category,
  isActive,
  count,
  onClick,
  onDelete,
  onRename,
}: {
  category: Category;
  isActive: boolean;
  count: number;
  onClick: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => Promise<void>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);

  // Focus ergonomics support
  const inputRef = useRef<HTMLInputElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === category.name) {
      setEditName(category.name);
      setIsEditing(false);
      return;
    }
    
    try {
      await onRename(category.id, trimmed);
    } catch (err) {
      console.error("Failed to rename:", err);
    } finally {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      setEditName(category.name);
      setIsEditing(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border-2 border-foreground p-3 flex justify-between items-center transition-all ${
        isActive
          ? "bg-accent text-white shadow-[2px_2px_0px_0px_var(--foreground)]"
          : "bg-white hover:bg-muted text-foreground shadow-[2px_2px_0px_0px_var(--foreground)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_var(--foreground)]"
      }`}
    >
      {/* Clickable Area for Selection & Drag */}
      <div className="flex items-center space-x-3 flex-1 min-w-0 group/item" onClick={onClick}>
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 -ml-1">
          {isActive ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
        </div>
        
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onMouseDown={(e) => {
              // Stop propagation to prevent DnD sensors from hijacking input focus/click ergonomics
              e.stopPropagation();
            }}
            className="flex-1 bg-background text-foreground border border-foreground/30 px-1.5 py-0.5 font-display font-semibold text-xs tracking-wider uppercase focus:outline-none focus:border-accent"
            autoFocus
          />
        ) : (
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <span className="font-display font-semibold text-xs tracking-wider uppercase truncate">
              {category.name}
            </span>
            <button
              onClick={handleStartEdit}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              className="opacity-0 group-hover/item:opacity-100 p-0.5 hover:text-accent transition-all cursor-pointer text-muted-foreground"
              title="Rename Category"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}

        <span
          className={`font-mono text-[9px] px-1.5 py-0.5 border ${
            isActive
              ? "bg-white/20 border-white/20 text-white"
              : "bg-muted border-foreground/10 text-muted-foreground"
          }`}
        >
          {count}
        </span>
      </div>

      {/* Delete Category */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(category.id);
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        className={`p-1 border border-transparent transition-all rounded ${
          isActive
            ? "hover:bg-white/20 hover:border-white text-white"
            : "hover:bg-accent/10 hover:border-accent text-muted-foreground hover:text-accent"
        }`}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function Sidebar({
  categories,
  activeCategoryId,
  cardCounts,
  onSelectCategory,
  onCategoriesChange,
  uploadProgress,
  theme = "light-gold",
}: SidebarProps) {
  const confirm = useConfirm();
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(categories, oldIndex, newIndex);
    onCategoriesChange(reordered);

    try {
      await updateCategoriesOrder(reordered.map((c) => c.id));
    } catch (err) {
      console.error("Error updating category order in DB:", err);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || addingCat) return;

    setAddingCat(true);
    try {
      const created = await createCategory(newCatName.trim());
      onCategoriesChange([...categories, created]);
      setNewCatName("");
    } catch (err: any) {
      console.error("Error adding category:", err);
      alert("A category with this name already exists. Please choose a unique name.");
    } finally {
      setAddingCat(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const confirmed = await confirm({
      title: "Delete Category",
      message: "Are you sure you want to delete this category? Cards inside will be uncategorized.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (confirmed) {
      try {
        await deleteCategory(id);
        const filtered = categories.filter((c) => c.id !== id);
        onCategoriesChange(filtered);
        if (activeCategoryId === id) {
          onSelectCategory(null);
        }
      } catch (err) {
        console.error("Error deleting category:", err);
      }
    }
  };

  const handleRenameCategory = async (id: string, newName: string) => {
    try {
      const updated = await renameCategory(id, newName);
      const updatedList = categories.map((c) => (c.id === id ? updated : c));
      onCategoriesChange(updatedList);
    } catch (err) {
      console.error("Error renaming category:", err);
    }
  };

  return (
    <aside className="w-full lg:w-80 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-foreground bg-background p-6 space-y-8 select-none lg:h-screen lg:overflow-y-auto">
      {/* Brand & User Profile */}
      <header className="flex justify-between items-end border-b border-foreground/10 pb-4 lg:h-16">
        <Link
          href="/"
          onClick={(e) => {
            onSelectCategory(null);
          }}
          className="flex items-center space-x-3.5 w-full cursor-pointer hover:opacity-90 transition-opacity"
        >
          <Logo size={36} className="text-foreground flex-shrink-0" theme={theme} />
          <span className="font-display font-bold uppercase tracking-wider text-2xl leading-none text-foreground">
            Essential Space
          </span>
        </Link>
      </header>

      {/* Category List */}
      <div className="flex-1 flex flex-col space-y-4 pt-4 min-h-[250px]">
        <span className="font-mono text-xs text-accent uppercase tracking-widest block font-semibold">
          * 01. ACTIVE CATEGORIES
        </span>

        {/* Default 'All Items' Slot */}
        <div
          onClick={() => onSelectCategory(null)}
          className={`border-2 border-foreground p-3 flex items-center justify-between cursor-pointer transition-all ${
            activeCategoryId === null
              ? "bg-foreground text-background shadow-[2px_2px_0px_0px_var(--accent)]"
              : "bg-white hover:bg-muted text-foreground shadow-[2px_2px_0px_0px_var(--foreground)] hover:translate-x-[-1px] hover:translate-y-[-1px]"
          }`}
        >
          <div className="flex items-center space-x-3">
            <FolderOpen className="w-4 h-4" />
            <span className="font-display font-semibold text-xs tracking-wider uppercase">
              SHOW ALL ITEMS
            </span>
          </div>
          <span
            className={`font-mono text-[9px] px-1.5 py-0.5 border ${
              activeCategoryId === null
                ? "bg-white/20 border-white/20 text-white"
                : "bg-muted border-foreground/10 text-muted-foreground"
            }`}
          >
            {cardCounts["all"] || 0}
          </span>
        </div>

        {/* Sortable Category List */}
        {mounted && categories.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={categories} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {categories.map((cat) => (
                  <SortableCategoryItem
                    key={cat.id}
                    category={cat}
                    isActive={activeCategoryId === cat.id}
                    count={cardCounts[cat.id] || 0}
                    onClick={() => onSelectCategory(cat.id)}
                    onDelete={handleDeleteCategory}
                    onRename={handleRenameCategory}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          mounted &&
          categories.length === 0 && (
            <p className="font-sans text-[11px] text-muted-foreground italic text-center py-4 bg-muted border border-dashed border-foreground/10">
              No categories created yet.
            </p>
          )
        )}

        {/* Add Category Form */}
        <form onSubmit={handleAddCategory} className="flex gap-2 pt-2">
          <input
            type="text"
            placeholder="NEW CATEGORY NAME"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            className="flex-1 bg-white border-2 border-foreground px-3 py-2 font-mono text-[10px] tracking-wider uppercase focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={addingCat}
            className="bg-accent text-white border-2 border-foreground p-2.5 shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-center cursor-pointer"
          >
            {addingCat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </form>
      </div>

      {/* Upload Status / Progress (Left Column Bottom) */}
      <div className="pt-4 border-t border-foreground/10 space-y-3">
        <span className="font-mono text-xs text-accent uppercase tracking-widest block font-semibold">
          * 02. SYSTEM LOGS
        </span>
        {uploadProgress ? (
          <div className="border border-foreground/15 bg-white p-3 space-y-2">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="truncate max-w-[150px] uppercase font-bold text-accent">
                {uploadProgress.filename}
              </span>
              <span>{uploadProgress.progress}%</span>
            </div>
            <div className="w-full bg-muted h-2.5 border border-foreground/20">
              <div
                className="bg-accent h-full transition-all duration-300"
                style={{ width: `${uploadProgress.progress}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <div className="font-mono text-[9px] text-muted-foreground uppercase leading-relaxed bg-muted border border-foreground/5 p-3 space-y-1">
            <p className="text-foreground/80 font-bold">READY // SYNC ACTIVE</p>
            <p>DRAG N DROP FILES FROM DESKTOP ANYTIME</p>
          </div>
        )}
      </div>
    </aside>
  );
}
