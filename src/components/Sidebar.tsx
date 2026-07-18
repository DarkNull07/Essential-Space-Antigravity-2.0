"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { createCategory, deleteCategory, updateCategoryOrder } from "@/app/actions";
import Logo from "@/components/Logo";
import { useConfirm } from "./ConfirmDialog";
import Link from "next/link";
import { Folder, FolderOpen, Plus, Trash2, Loader2 } from "lucide-react";


interface Category {
  id: string;
  name: string;
  order: number;
  parentId?: string | null;
}

interface SidebarProps {
  categories: Category[];
  activeCategoryId: string | null;
  activeSubcategoryId: string | null;
  cardCounts: Record<string, number>;
  onSelectCategory: (id: string | null) => void;
  onSelectSubcategory: (id: string | null) => void;
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
  } = useSortable({ id: String(category.id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border-2 border-foreground p-3 flex justify-between items-center transition-all ${
        category.parentId ? "ml-4 w-[calc(100%-1rem)]" : ""
      } ${
        isActive
          ? "bg-accent text-white shadow-[2px_2px_0px_0px_var(--foreground)]"
          : "bg-card hover:bg-muted text-foreground shadow-[2px_2px_0px_0px_var(--foreground)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_var(--foreground)]"
      }`}
    >
      {/* Clickable Area for Selection & Drag */}
      <div
        {...attributes}
        {...listeners}
        onClick={onClick}
        style={{ touchAction: "none" }}
        className="flex items-center space-x-3 flex-1 min-w-0 group/item cursor-grab active:cursor-grabbing touch-none select-none"
      >
        {isActive ? <FolderOpen className="w-4 h-4 shrink-0" /> : <Folder className="w-4 h-4 shrink-0" />}
        
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <span className="font-display font-semibold text-xs tracking-wider uppercase truncate">
            {category.name}
          </span>
        </div>

        <span
          className={`font-mono text-[9px] px-1.5 py-0.5 border shrink-0 ${
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
  activeSubcategoryId,
  cardCounts,
  onSelectCategory,
  onSelectSubcategory,
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
        distance: 5,
      },
    })
  );

  const topLevelCategories = categories
    .filter((c) => !c.parentId)
    .sort((a, b) => a.order - b.order);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = topLevelCategories.findIndex((c) => String(c.id) === String(active.id));
    const newIndex = topLevelCategories.findIndex((c) => String(c.id) === String(over.id));

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedTopLevel = arrayMove(topLevelCategories, oldIndex, newIndex);

    const updatedCategories: Category[] = [];
    reorderedTopLevel.forEach((parent) => {
      updatedCategories.push(parent);
      const parentSubcats = categories.filter((c) => c.parentId === parent.id).sort((a, b) => a.order - b.order);
      updatedCategories.push(...parentSubcats);
    });

    onCategoriesChange(updatedCategories);

    try {
      await updateCategoryOrder(reorderedTopLevel.map((c) => String(c.id)));
    } catch (err) {
      console.error("Error updating category order in DB:", err);
    }
  };

  const handleSubDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeSubcats = categories.filter((c) => c.parentId === activeCategoryId).sort((a, b) => a.order - b.order);
    const oldIndex = activeSubcats.findIndex((c) => String(c.id) === String(active.id));
    const newIndex = activeSubcats.findIndex((c) => String(c.id) === String(over.id));

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedSubcats = arrayMove(activeSubcats, oldIndex, newIndex);

    const updatedCategories: Category[] = [];
    const topLevel = categories.filter((c) => !c.parentId).sort((a, b) => a.order - b.order);
    topLevel.forEach((parent) => {
      updatedCategories.push(parent);
      if (parent.id === activeCategoryId) {
        updatedCategories.push(...reorderedSubcats);
      } else {
        const parentSubcats = categories.filter((c) => c.parentId === parent.id).sort((a, b) => a.order - b.order);
        updatedCategories.push(...parentSubcats);
      }
    });

    onCategoriesChange(updatedCategories);

    try {
      await updateCategoryOrder(reorderedSubcats.map((c) => String(c.id)));
    } catch (err) {
      console.error("Error updating subcategory order in DB:", err);
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

  return (
    <aside className="w-full lg:w-80 flex flex-col border-b lg:border-b-0 lg:border-r border-foreground bg-background p-6 space-y-8 select-none lg:h-screen lg:overflow-y-auto">
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
      <div className="flex flex-col space-y-4 pt-4">
        <span className="font-mono text-xs text-accent uppercase tracking-widest block font-semibold">
          * 01. ACTIVE CATEGORIES
        </span>

        {/* Default 'All Items' Slot */}
        <div
          onClick={() => onSelectCategory(null)}
          className={`border-2 border-foreground p-3 flex items-center justify-between cursor-pointer transition-all ${
            activeCategoryId === null
              ? "bg-foreground text-background shadow-[2px_2px_0px_0px_var(--accent)]"
              : "bg-card hover:bg-muted text-foreground shadow-[2px_2px_0px_0px_var(--foreground)] hover:translate-x-[-1px] hover:translate-y-[-1px]"
          }`}
        >
          <div className="flex items-center space-x-3">
            <FolderOpen className="w-4 h-4" />
            <span className="font-display font-semibold text-xs tracking-wider uppercase">
              ALL ITEMS
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
        {mounted && topLevelCategories.length > 0 ? (
          <DndContext
            id="sidebar-categories-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToParentElement]}
          >
            <SortableContext items={topLevelCategories.map((c) => String(c.id))} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {topLevelCategories.map((cat) => {
                  const subcats = categories
                    .filter((c) => c.parentId === cat.id)
                    .sort((a, b) => a.order - b.order);

                  return (
                    <div key={cat.id} className="space-y-3">
                      <SortableCategoryItem
                        category={cat}
                        isActive={activeCategoryId === cat.id && activeSubcategoryId === null}
                        count={cardCounts[cat.id] || 0}
                        onClick={() => onSelectCategory(cat.id)}
                        onDelete={handleDeleteCategory}
                      />
                      {activeCategoryId === cat.id && subcats.length > 0 && (
                        <div
                          onPointerDown={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="space-y-3"
                        >
                          <DndContext
                            id={`subcategories-dnd-${cat.id}`}
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleSubDragEnd}
                            modifiers={[restrictToParentElement]}
                          >
                            <SortableContext
                              items={subcats.map((c) => String(c.id))}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-3">
                                <AnimatePresence initial={false}>
                                  {subcats.map((sub) => (
                                    <motion.div
                                      key={sub.id}
                                      layout
                                      initial={{ opacity: 0, height: 0, overflow: "hidden" }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.2, ease: "easeInOut" }}
                                    >
                                      <SortableCategoryItem
                                        category={sub}
                                        isActive={activeSubcategoryId === sub.id}
                                        count={cardCounts[sub.id] || 0}
                                        onClick={() => onSelectSubcategory(sub.id)}
                                        onDelete={handleDeleteCategory}
                                      />
                                    </motion.div>
                                  ))}
                                </AnimatePresence>
                              </div>
                            </SortableContext>
                          </DndContext>
                        </div>
                      )}
                    </div>
                  );
                })}
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
            className="flex-1 bg-card border-2 border-foreground px-3 py-2 font-mono text-[10px] tracking-wider uppercase focus:outline-none focus:ring-1 focus:ring-accent"
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
      <div className="pt-4 border-t border-foreground/10 space-y-3 mt-auto flex-shrink-0">
        <span className="font-mono text-xs text-accent uppercase tracking-widest block font-semibold">
          * 02. SYSTEM LOGS
        </span>
        {uploadProgress ? (
          <div className="border border-foreground/15 bg-card p-3 space-y-2">
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
