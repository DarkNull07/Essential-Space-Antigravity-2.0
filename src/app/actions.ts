"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt, maskKey } from "@/lib/crypto";
import { stripHashtags } from "@/lib/utils";

async function fetchYouTubeOEmbedData(url: string): Promise<{ title: string; author_name: string } | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data && typeof data.title === "string" ? data.title : "",
      author_name: data && typeof data.author_name === "string" ? data.author_name : "",
    };
  } catch (err) {
    console.error("Server-side YouTube oEmbed fetch failed:", err);
    return null;
  }
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

export async function updateCategoryOrder(categoryIds: string[]) {
  return updateCategoriesOrder(categoryIds);
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

  // Verify the target category belongs to this user.
  if (categoryId) {
    const ownedCategory = await prisma.category.count({
      where: { id: categoryId, userId: user.id },
    });
    if (ownedCategory === 0) {
      throw new Error("Category not found or unauthorized");
    }
  }

  let finalContent = content;
  if (type === "API_KEY") {
    finalContent = encrypt(content);
  }

  let updatedMetadata = metadata || null;
  let finalTitle = title;
  
  if (type === "LINK") {
    try {
      const isYouTube = content.includes("youtube.com") || content.includes("youtu.be");
      if (isYouTube) {
        const incomingMetadata = metadata || {};
        const currentDesc = incomingMetadata.description;
        if (!currentDesc || typeof currentDesc !== "string" || currentDesc.trim() === "") {
          const oEmbedData = await fetchYouTubeOEmbedData(content);
          console.log("[YT DEBUG]", JSON.stringify(oEmbedData)); // ADD THIS LINE
          if (oEmbedData) {
            updatedMetadata = {
              ...incomingMetadata,
              description: stripHashtags(oEmbedData.title),
            };
            if (!finalTitle || finalTitle.trim() === "") {
              finalTitle = oEmbedData.author_name;
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch oEmbed metadata for link card on create:", err);
    }
  }

  // Calculate next order value
  const count = await prisma.card.count({
    where: { userId: user.id, categoryId },
  });

  const card = await prisma.card.create({
    data: {
      type,
      content: finalContent,
      title: finalTitle || null,
      metadata: updatedMetadata,
      order: count,
      categoryId,
      userId: user.id,
    },
  });

  revalidatePath("/");
  
  return {
    ...card,
    content: type === "API_KEY" ? maskKey(card.content) : card.content
  };
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

  const existingCard = await prisma.card.findFirst({
    where: { id, userId: user.id },
    select: { type: true },
  });

  if (!existingCard) {
    throw new Error("Unauthorized or Card Not Found");
  }

  let finalContent = content;
  if (existingCard.type === "API_KEY") {
    finalContent = encrypt(content);
  }

  let finalTitle = title;
  let updatedMetadata = metadata;
  if (existingCard.type === "LINK") {
    try {
      const isYouTube = content.includes("youtube.com") || content.includes("youtu.be");
      if (isYouTube) {
        const incomingMetadata = metadata || {};
        const currentDesc = incomingMetadata.description;
        if (!currentDesc || typeof currentDesc !== "string" || currentDesc.trim() === "") {
          const oEmbedData = await fetchYouTubeOEmbedData(content);
          if (oEmbedData) {
            updatedMetadata = {
              ...incomingMetadata,
              description: stripHashtags(oEmbedData.title),
            };
            if (!finalTitle || finalTitle.trim() === "") {
              finalTitle = oEmbedData.author_name;
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch oEmbed metadata for link card on update:", err);
    }
  }

  // Scope mutations securely to card id AND user id to prevent ID enumeration exploits
  const result = await prisma.card.updateMany({
    where: { id, userId: user.id },
    data: {
      content: finalContent,
      title: finalTitle !== undefined ? finalTitle : undefined,
      metadata: updatedMetadata !== undefined ? updatedMetadata : undefined,
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
  
  if (updated && updated.type === "API_KEY") {
    return {
      ...updated,
      content: maskKey(updated.content)
    };
  }
  return updated!;
}

// Reveal/decrypt API key content for a card
export async function revealApiKey(cardId: string): Promise<string> {
  const user = await getAuthUser();
  const card = await prisma.card.findFirst({
    where: { id: cardId, userId: user.id },
  });
  if (!card) {
    throw new Error("Card not found or unauthorized");
  }
  if (card.type !== "API_KEY") {
    throw new Error("Card is not of type API_KEY");
  }
  return decrypt(card.content);
}

// Fetch the live disk size of the Card table from Supabase Postgres
export async function getLiveStorageMetrics(): Promise<number> {
  try {
    await getAuthUser();
    const supabase = await createClient();
    const { data: bytes, error } = await supabase.rpc("get_cards_disk_size");
    if (error) {
      console.error("Supabase RPC error fetching live storage metrics:", error);
      return 0.01;
    }
    const realBytes = typeof bytes === "number" ? bytes : Number(bytes || 0);
    return realBytes / (1024 * 1024);
  } catch (err) {
    console.error("Failed to fetch live storage metrics:", err);
    return 0.01;
  }
}

