import prisma from "@/lib/db";
import { getAuthUser } from "./auth";
import { maskKey } from "./crypto";

export async function getCurrentUser() {
  try {
    return await getAuthUser();
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
  return cards.map(card => {
    if (card.type === "API_KEY") {
      return {
        ...card,
        content: maskKey(card.content)
      };
    }
    return card;
  });
}
