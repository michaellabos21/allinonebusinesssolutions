import type { MetadataRoute } from "next";

import { CANONICAL_ORIGIN } from "@/config/app";

/** The public pages, for search engines. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${CANONICAL_ORIGIN}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${CANONICAL_ORIGIN}/signup`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${CANONICAL_ORIGIN}/login`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
