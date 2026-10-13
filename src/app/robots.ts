import type { MetadataRoute } from "next";

import { CANONICAL_ORIGIN } from "@/config/app";

/**
 * Search engines may crawl the public pages: the landing page, sign-up and
 * sign-in. Everything behind a sign-in is private and stays out of results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/signup", "/login"],
      disallow: [
        "/welcome",
        "/crm/",
        "/work/",
        "/money/",
        "/reports",
        "/team",
        "/settings",
        "/onboarding",
        "/invite/",
        "/auth/",
        "/photos/",
        "/f/",
        "/forgot-password",
        "/reset-password",
      ],
    },
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
    host: CANONICAL_ORIGIN,
  };
}
