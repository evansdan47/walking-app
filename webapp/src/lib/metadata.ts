import type { Metadata } from "next";
import { LANDING_SEO, NEWSLETTER_SEO } from "./seo-content";
import { SITE_NAME, SITE_URL, TWITTER_HANDLE } from "./site";

export const metadataBase = new URL(SITE_URL);

const defaultTitle = LANDING_SEO.title;

/** Shared across public marketing pages. */
export const rootMetadata: Metadata = {
  metadataBase,
  title: {
    default: defaultTitle,
    template: `%s | ${SITE_NAME}`,
  },
  description: LANDING_SEO.description,
  keywords: [...LANDING_SEO.keywords],
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: LANDING_SEO.shortTitle,
    description: LANDING_SEO.description,
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: LANDING_SEO.shortTitle,
    description: LANDING_SEO.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Uncomment and set the verification token from Search Console when ready:
  // verification: { google: "your-google-verification-code" },
};

export const landingPageMetadata: Metadata = {
  title: LANDING_SEO.title,
  description: LANDING_SEO.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: LANDING_SEO.shortTitle,
    description: LANDING_SEO.description,
    url: "/",
  },
  twitter: {
    title: LANDING_SEO.shortTitle,
    description: LANDING_SEO.description,
  },
};

export const newsletterPageMetadata: Metadata = {
  title: NEWSLETTER_SEO.title,
  description: NEWSLETTER_SEO.description,
  alternates: {
    canonical: "/newsletter",
  },
  openGraph: {
    title: `${NEWSLETTER_SEO.title} | ${SITE_NAME}`,
    description: NEWSLETTER_SEO.description,
    url: "/newsletter",
  },
  twitter: {
    title: `${NEWSLETTER_SEO.title} | ${SITE_NAME}`,
    description: NEWSLETTER_SEO.description,
  },
};

/** Auth and app shells should not compete with the marketing site in search. */
export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};
