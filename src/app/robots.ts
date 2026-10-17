import type { MetadataRoute } from "next";

import { CANONICAL_ORIGIN, IS_PREVIEW_DEPLOYMENT } from "@/config/app";

/**
 * Crawlers may fetch every page. Private pages stay out of search results
 * through their own noindex tag (the workspace layout, lead forms and the
 * account pages), which a crawler can only read if robots.txt lets it fetch
 * the page. Only the sign-in callback and private photo files, which are not
 * pages, are blocked here. Preview builds block everything.
 */
export default function robots(): MetadataRoute.Robots {
  if (IS_PREVIEW_DEPLOYMENT) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/auth/", "/photos/"] },
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
  };
}
