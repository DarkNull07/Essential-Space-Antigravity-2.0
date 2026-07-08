import prisma from "@/lib/db";
import { cache } from "react";
import { getAuthUser } from "./auth";
import { maskKey } from "./crypto";

// Page-load identity. Wrapped in React cache() so multiple RSC calls in a
// single render tree share one result (zero duplicate DB round trips).
// Uses findUnique + create instead of upsert to avoid unnecessary write locks
// on the hot path when the profile already exists (the common case).
export const getCurrentUser = cache(async () => {
  try {
    const { id, email } = await getAuthUser();
    let profile = await prisma.userProfile.findUnique({ where: { email } });
    if (!profile) {
      profile = await prisma.userProfile.create({
        data: { id, email, selectedTheme: "light-gold" },
      });
    }
    return profile;
  } catch {
    return null;
  }
});

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
