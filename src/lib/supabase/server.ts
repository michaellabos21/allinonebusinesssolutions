import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { getSupabaseEnv } from "@/lib/env";

/**
 * Supabase client for server components, server actions and route handlers.
 * It carries the signed-in user's session from cookies, so every query runs
 * as that user and is filtered by row-level security.
 */
export async function createClient() {
  // Everything done with this client depends on the current request (the
  // session, the clock), so it must never run during prerendering.
  await connection();
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet)
            cookieStore.set(name, value, options);
        } catch {
          // Server components cannot set cookies. The proxy refreshes the
          // session on every request, so this is safe to ignore there.
        }
      },
    },
  });
}
