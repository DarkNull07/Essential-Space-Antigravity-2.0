"use server";

import prisma from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Helper to authenticate user and sync with Prisma UserProfile
async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    throw new Error("Unauthorized");
  }

  // Sync user with UserProfile database entity using thread-safe upsert
  const profile = await prisma.userProfile.upsert({
    where: { email: user.email },
    update: {},
    create: {
      id: user.id, // Use Supabase user ID as primary key
      email: user.email,
      selectedTheme: "light-gold",
    },
  });

  return profile;
}

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

// Create a new category
export async function createCategory(name: string) {
  const user = await getAuthUser();
  
  // Calculate next order value
  const count = await prisma.category.count({
    where: { userId: user.id },
  });

  const category = await prisma.category.create({
    data: {
      name,
      order: count,
      userId: user.id,
    },
  });

  revalidatePath("/");
  return category;
}

// Reorder categories
export async function updateCategoriesOrder(categoryIds: string[]) {
  const user = await getAuthUser();

  const updates = categoryIds.map((id, index) =>
    prisma.category.updateMany({
      where: { id, userId: user.id },
      data: { order: index },
    })
  );

  await prisma.$transaction(updates);
  revalidatePath("/");
}

// Delete category
export async function deleteCategory(id: string) {
  const user = await getAuthUser();

  const category = await prisma.category.delete({
    where: { id, userId: user.id },
  });

  revalidatePath("/");
  return category;
}

// Create a new card
export async function createCard(
  type: "LINK" | "TEXT" | "IMAGE" | "FILE",
  content: string,
  categoryId: string | null,
  title?: string,
  metadata?: any
) {
  const user = await getAuthUser();

  if (content.length > 1024 * 1024) {
    throw new Error("Payload size limit exceeded (1MB)");
  }

  // Calculate next order value
  const count = await prisma.card.count({
    where: { userId: user.id, categoryId },
  });

  const card = await prisma.card.create({
    data: {
      type,
      content,
      title: title || null,
      metadata: metadata || null,
      order: count,
      categoryId,
      userId: user.id,
    },
  });

  revalidatePath("/");
  return card;
}

// Reorder cards in a category
export async function updateCardsOrder(cardIds: string[]) {
  const user = await getAuthUser();

  const updates = cardIds.map((id, index) =>
    prisma.card.updateMany({
      where: { id, userId: user.id },
      data: { order: index },
    })
  );

  await prisma.$transaction(updates);
  revalidatePath("/");
}

// Move card to a different category
export async function moveCardToCategory(cardId: string, categoryId: string | null) {
  const user = await getAuthUser();

  // Calculate order in new category
  const count = await prisma.card.count({
    where: { userId: user.id, categoryId },
  });

  const card = await prisma.card.update({
    where: { id: cardId, userId: user.id },
    data: {
      categoryId,
      order: count,
    },
  });

  revalidatePath("/");
  return card;
}

// Delete a card
export async function deleteCard(id: string) {
  const user = await getAuthUser();

  const card = await prisma.card.delete({
    where: { id, userId: user.id },
  });

  revalidatePath("/");
  return card;
}

// Update user theme preference
export async function updateUserTheme(theme: string) {
  const user = await getAuthUser();
  await prisma.userProfile.update({
    where: { id: user.id },
    data: { selectedTheme: theme },
  });
  revalidatePath("/");
}

