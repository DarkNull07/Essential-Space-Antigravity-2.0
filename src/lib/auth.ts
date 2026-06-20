import prisma from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

// Helper to authenticate user and sync with Prisma UserProfile
export async function getAuthUser() {
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
