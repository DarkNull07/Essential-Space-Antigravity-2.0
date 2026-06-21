import prisma from "@/lib/db";
import { getAuthUser } from "./auth";

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
  return prisma.card.findMany({
    where: { userId },
    orderBy: { order: "asc" },
  });
}
