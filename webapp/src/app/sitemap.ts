import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Only indexable public URLs. Add pages here when they go live. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/newsletter`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
