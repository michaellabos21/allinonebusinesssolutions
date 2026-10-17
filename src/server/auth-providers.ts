import "server-only";

import { cacheLife } from "next/cache";

/**
 * Whether Google sign-in is switched on in Supabase (Authentication → Sign In /
 * Providers). The button only appears when it is, so the app never shows a
 * button that leads to an error. Checked at most every few minutes.
 */
export async function isGoogleSignInEnabled(): Promise<boolean> {
  "use cache";
  cacheLife("minutes");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;
  try {
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } });
    if (!response.ok) return false;
    const settings = (await response.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
