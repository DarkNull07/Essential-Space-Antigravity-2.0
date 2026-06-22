import { createClient } from "@/lib/supabase/server";

// Lightweight auth identity used by every server action.
// Returns ONLY what actions need (id/email) from the auth token check.
// No Prisma call here -> removes one cross-region DB round trip per action.
// Profile creation now lives in getCurrentUser() (runs once on page load).
export type AuthUser = { id: string; email: string };

export async function getAuthUser(): Promise<AuthUser> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    throw new Error("Unauthorized");
  }

  return { id: user.id, email: user.email };
}
