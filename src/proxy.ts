import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/** Pages a signed-out visitor may open. Everything else needs a session. */
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/auth/",
  "/invite/",
  "/f/",
  // A shared invoice's public page.
  "/i/",
  // The landing page's video and other files in public/landing.
  "/landing/",
];
/** Pages that make no sense once signed in. */
const SIGNED_OUT_ONLY = ["/login", "/signup", "/forgot-password"];

/**
 * Runs before every page request: refreshes the Supabase session cookie and
 * redirects by sign-in state. This is a convenience, not the security
 * boundary. Pages and server actions check the session again themselves, and
 * the database enforces access with row-level security.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Without configuration there is no session to check; pages show the setup error.
  if (!url || !anonKey) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet)
          response.cookies.set(name, value, options);
      },
    },
  });

  // getUser() verifies the token with the auth server; it is not just a cookie read.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );

  const redirectTo = (path: string, next?: string, status = 307) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = next ? `?next=${encodeURIComponent(next)}` : "";
    const redirect = NextResponse.redirect(target, status);
    // Keep any refreshed session cookies on the redirect.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  // The landing page's one address is `/`; a direct link to /welcome moves
  // there for good, so search engines credit `/`.
  if (pathname === "/welcome") return redirectTo("/", undefined, 308);

  // Signed-out visitors see the landing page at the home address; signed-in
  // people get their workspace there as before.
  if (!user && pathname === "/") {
    const landing = request.nextUrl.clone();
    landing.pathname = "/welcome";
    const rewrite = NextResponse.rewrite(landing);
    for (const cookie of response.cookies.getAll()) rewrite.cookies.set(cookie);
    return rewrite;
  }
  if (!user && !isPublic) {
    return redirectTo("/login", pathname + request.nextUrl.search);
  }
  if (user && SIGNED_OUT_ONLY.some((prefix) => pathname.startsWith(prefix))) {
    return redirectTo("/");
  }
  return response;
}

export const config = {
  // Skip static assets and images; run on every page and route handler.
  matcher: [
    // Skipped: static files (the icons and share image included, by their
    // extension) and the exact robots, sitemap and manifest files that search
    // engines and phones fetch while signed out.
    "/((?!_next/static|_next/image|robots\\.txt$|sitemap\\.xml$|manifest\\.webmanifest$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm)$).*)",
  ],
};
