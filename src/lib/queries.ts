import prisma from "@/lib/db";
import { getAuthUser } from "./auth";
import { maskKey } from "./crypto";

// Page-load identity. This is the ONE place that guarantees a UserProfile row
// exists (lazy creation moved here from getAuthUser) and returns the full
// profile including theme fields needed by DashboardClient. Runs once per load.
export async function getCurrentUser() {
  try {
    const { id, email } = await getAuthUser();
    const profile = await prisma.userProfile.upsert({
      where: { email },
      update: {},
      create: {
        id, // Use Supabase user ID as primary key
        email,
        selectedTheme: "light-gold",
      },
    });
    return profile;
  } catch {
    return null;
  }
}

// Get all categories for current user
export async function getCategories(userId: string) {
  return prisma.category.findMany({
    where: { userId },
    orderBy: { order: "asc" },
  });
}

// Get all cards for current user
export async function getCards(userId: string) {
  const cards = await prisma.card.findMany({
    where: { userId },
    orderBy: { order: "asc" },
  });
  return cards.map((card) => {
    if (card.type === "API_KEY") {
      return {
        ...card,
        content: maskKey(card.content),
      };
    }
    return card;
  });
}
