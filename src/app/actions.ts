"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
  type: "LINK" | "TEXT" | "IMAGE" | "FILE" | "CHECKLIST" | "API_KEY",
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
    data: { 
      selectedTheme: theme,
      theme: theme
    },
  });
  revalidatePath("/");
}

// Delete user account and all data
export async function deleteUserAccount() {
  const user = await getAuthUser();

  // Explicitly delete all Cards and Categories belonging to the target userId using separate 'deleteMany' transactions BEFORE deleting the UserProfile record.
  await prisma.card.deleteMany({
    where: { userId: user.id },
  });

  await prisma.category.deleteMany({
    where: { userId: user.id },
  });

  const profile = await prisma.userProfile.delete({
    where: { id: user.id },
  });

  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/");
  return profile;
}

// Rename category with secure user ownership scoping
export async function renameCategory(id: string, name: string) {
  const user = await getAuthUser();

  // Scope mutation using both category id AND active user id to prevent ID enumeration exploits
  const result = await prisma.category.updateMany({
    where: {
      id,
      userId: user.id,
    },
    data: {
      name,
    },
  });

  if (result.count === 0) {
    throw new Error("Category not found or unauthorized");
  }

  const updated = await prisma.category.findUnique({
    where: { id },
  });

  revalidatePath("/");
  return updated!;
}

// Update an existing card's content, title, and metadata
export async function updateCard(
  id: string,
  content: string,
  title?: string | null,
  metadata?: any
) {
  const user = await getAuthUser();

  if (content.length > 1024 * 1024) {
    throw new Error("Payload size limit exceeded (1MB)");
  }

  // Scope mutations securely to card id AND user id to prevent ID enumeration exploits
  const result = await prisma.card.updateMany({
    where: { id, userId: user.id },
    data: {
      content,
      title: title !== undefined ? title : undefined,
      metadata: metadata !== undefined ? metadata : undefined,
    },
  });

  // Explicit updateMany count verification (Constraint 2)
  if (result.count === 0) {
    throw new Error("Unauthorized or Card Not Found");
  }

  const updated = await prisma.card.findUnique({
    where: { id },
  });

  revalidatePath("/");
  return updated!;
}

