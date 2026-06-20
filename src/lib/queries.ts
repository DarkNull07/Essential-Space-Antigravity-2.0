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
export async function getCategories() {
  const user = await getAuthUser();
  return prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { order: "asc" },
  });
}

// Get all cards for current user
export async function getCards() {
  const user = await getAuthUser();
  return prisma.card.findMany({
    where: { userId: user.id },
    orderBy: { order: "asc" },
  });
}
