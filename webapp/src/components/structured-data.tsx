import { LANDING_SEO } from "@/lib/seo-content";
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from "@/lib/site";

type StructuredDataProps = {
  /** Defaults to landing page JSON-LD. Pass "newsletter" for the waitlist page. */
  page?: "landing" | "newsletter";
};

/**
 * JSON-LD for search engines (Organization, WebSite, SoftwareApplication).
 * @see https://developers.google.com/search/docs/appearance/structured-data
 */
export function StructuredData({ page = "landing" }: StructuredDataProps) {
  const pageUrl = page === "newsletter" ? `${SITE_URL}/newsletter` : SITE_URL;

  const graph = [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/Logo_Rambleio.png`,
      },
      email: CONTACT_EMAIL,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: LANDING_SEO.description,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-GB",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "SportsApplication",
      operatingSystem: "iOS, Android, Web",
      description: LANDING_SEO.description,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "GBP",
        description: "Closed beta — join the newsletter for early access",
      },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "WebPage",
      "@id": `${pageUrl}/#webpage`,
      url: pageUrl,
      name: page === "newsletter" ? "Newsletter" : LANDING_SEO.h1,
      description:
        page === "newsletter"
          ? "Sign up for Rambleio newsletter and closed beta"
          : LANDING_SEO.description,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#app` },
      inLanguage: "en-GB",
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": graph,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
