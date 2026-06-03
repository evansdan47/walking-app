/**
 * Canonical site URL for metadata, sitemap, robots, and JSON-LD.
 * Override in local/staging via NEXT_PUBLIC_SITE_URL in .env.local.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://rambleio.com";

export const SITE_NAME = "Rambleio";

/** Update when you have official social handles. */
export const TWITTER_HANDLE = "@rambleio";

export const CONTACT_EMAIL = "hello@rambleio.com";
