import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/server/safe-next";

/**
 * Landing point for links in auth emails (confirm sign-up, reset password)
 * and for Google sign-in. Exchanges the one-time code for a session, then
 * continues to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // Google sends the person back with an error when they cancel or something fails.
  if (searchParams.get("error")) return NextResponse.redirect(`${origin}/login?error=google`);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
