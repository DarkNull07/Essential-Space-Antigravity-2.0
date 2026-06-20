import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const isRelativePath = next.startsWith("/");
      const redirectTo = isRelativePath ? next : "/";
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  // Redirect to login page with error param if code exchange fails
  return NextResponse.redirect(`${origin}/login?error=auth-code-exchange-failed`);
}
