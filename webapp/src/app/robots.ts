import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Crawl rules for search engines.
 * Public marketing: / and /newsletter only.
 * App routes are also auth-protected; disallow avoids accidental indexing.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/newsletter"],
      disallow: [
        "/home",
        "/map",
        "/planner",
        "/explore",
        "/walks",
        "/profile",
        "/sign-in",
        "/sign-up",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
