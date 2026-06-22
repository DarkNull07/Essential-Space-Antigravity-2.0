"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Canvas from "./Canvas";
import { ConfirmProvider } from "./ConfirmDialog";

interface UserProfile {
  id: string;
  email: string;
  selectedTheme: string;
  theme?: string;
}

interface Category {
  id: string;
  name: string;
  order: number;
}

interface Card {
  id: string;
  type: string;
  title: string | null;
  content: string;
  metadata: any;
  order: number;
  categoryId: string | null;
}

interface DashboardClientProps {
  user: UserProfile;
  initialCategories: Category[];
  initialCards: Card[];
}

export default function DashboardClient({
  user,
  initialCategories,
  initialCards,
}: DashboardClientProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [theme, setTheme] = useState(user.theme || user.selectedTheme);

  // Synchronize state when initialCategories / initialCards change from server side (router.refresh())
  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  useEffect(() => {
    setTheme(user.theme || user.selectedTheme);
  }, [user.theme, user.selectedTheme]);

  // Dynamically update document element attributes on client side
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme.startsWith("dark-")) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Native drag-and-drop progress status
  const [uploadProgress, setUploadProgress] = useState<{
    filename: string;
    progress: number;
  } | null>(null);

  // Compute card counts dynamically
  const cardCounts = categories.reduce(
    (acc, cat) => {
      acc[cat.id] = cards.filter((c) => c.categoryId === cat.id).length;
      return acc;
    },
    { all: cards.length } as Record<string, number>
  );

  const activeCategory = activeCategoryId
    ? categories.find((c) => c.id === activeCategoryId) || null
    : null;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-background text-foreground transition-colors duration-300" data-theme={theme}>
      <ConfirmProvider>
        <Sidebar
          categories={categories}
          activeCategoryId={activeCategoryId}
          cardCounts={cardCounts}
          onSelectCategory={setActiveCategoryId}
          onCategoriesChange={setCategories}
          uploadProgress={uploadProgress}
          theme={theme}
        />
        <Canvas
          currentTheme={theme}
          user={{ ...user, selectedTheme: theme }}
          onThemeChange={setTheme}
          activeCategory={activeCategory}
          categories={categories}
          cards={cards}
          onCardsChange={setCards}
          onUploadStart={(filename) => setUploadProgress({ filename, progress: 0 })}
          onUploadProgress={(progress) =>
            setUploadProgress((prev) => (prev ? { ...prev, progress } : null))
          }
          onUploadEnd={() => setUploadProgress(null)}
        />
      </ConfirmProvider>
    </div>
  );
}
