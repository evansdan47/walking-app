import type { MetadataRoute } from "next";
import { LANDING_SEO } from "@/lib/seo-content";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: LANDING_SEO.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2e7d32",
    lang: "en-GB",
    scope: "/",
    id: SITE_URL,
    // Add public/icon-192.png and icon-512.png when you have final brand assets.
  };
}
