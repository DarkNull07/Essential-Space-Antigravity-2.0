"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
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
import { Folder, FolderOpen, Plus, Trash2, LogOut, User, Loader2 } from "lucide-react";
import { createCategory, deleteCategory, updateCategoriesOrder } from "@/app/actions";
import Logo from "@/components/Logo";

interface Category {
  id: string;
  name: string;
  order: number;
}

interface SidebarProps {
  userEmail: string | null;
  categories: Category[];
  activeCategoryId: string | null;
  cardCounts: Record<string, number>;
  onSelectCategory: (id: string | null) => void;
  onCategoriesChange: (categories: Category[]) => void;
  uploadProgress: { filename: string; progress: number } | null;
}

function SortableCategoryItem({
  category,
  isActive,
  count,
  onClick,
  onDelete,
}: {
  category: Category;
  isActive: boolean;
  count: number;
  onClick: () => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border-2 border-foreground p-3 flex justify-between items-center transition-all ${
        isActive
          ? "bg-accent text-white shadow-[2px_2px_0px_0px_#0B0C10]"
          : "bg-white hover:bg-muted text-foreground shadow-[2px_2px_0px_0px_#0B0C10] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#0B0C10]"
      }`}
    >
      {/* Clickable Area for Selection & Drag */}
      <div className="flex items-center space-x-3 flex-1 min-w-0" onClick={onClick}>
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 -ml-1">
          {isActive ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
        </div>
        <span className="font-display font-semibold text-xs tracking-wider uppercase truncate">
          {category.name}
        </span>
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
  userEmail,
  categories,
  activeCategoryId,
  cardCounts,
  onSelectCategory,
  onCategoriesChange,
  uploadProgress,
}: SidebarProps) {
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [mounted, setMounted] = useState(false);

  const supabase = createClient();

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
    } catch (err) {
      console.error("Error adding category:", err);
    } finally {
      setAddingCat(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm("Are you sure you want to delete this category? Cards inside will be uncategorized.")) {
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <aside className="w-full lg:w-80 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-foreground bg-background p-6 space-y-8 select-none lg:h-screen lg:overflow-y-auto">
      {/* Brand & User Profile */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2.5">
            <Logo size={22} className="text-foreground" />
            <span className="font-display font-bold uppercase tracking-wider text-sm">
              Essential Space
            </span>
          </div>
        </div>

        {/* User Card */}
        <div className="border-2 border-foreground bg-white p-4 shadow-[3px_3px_0px_0px_#0B0C10] space-y-3">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-accent" />
            <span className="font-mono text-xs truncate max-w-[180px]">
              {userEmail || "anonymous@domain.com"}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-muted hover:bg-accent hover:text-white border border-foreground font-mono text-[10px] uppercase py-1.5 tracking-wider transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            End Session
          </button>
        </div>
      </div>

      {/* Category List */}
      <div className="flex-1 flex flex-col space-y-4 pt-4 border-t border-foreground/10 min-h-[250px]">
        <span className="font-mono text-xs text-accent uppercase tracking-widest block font-semibold">
          * 01. ACTIVE CATEGORIES
        </span>

        {/* Default 'All Items' Slot */}
        <div
          onClick={() => onSelectCategory(null)}
          className={`border-2 border-foreground p-3 flex items-center justify-between cursor-pointer transition-all ${
            activeCategoryId === null
              ? "bg-foreground text-background shadow-[2px_2px_0px_0px_#FF5A36]"
              : "bg-white hover:bg-muted text-foreground shadow-[2px_2px_0px_0px_#0B0C10] hover:translate-x-[-1px] hover:translate-y-[-1px]"
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
            className="bg-accent text-white border-2 border-foreground p-2.5 shadow-[2px_2px_0px_0px_#0B0C10] hover:shadow-[1px_1px_0px_0px_#0B0C10] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-center"
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
