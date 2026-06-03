import { StructuredData } from "@/components/structured-data";
import { newsletterPageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = newsletterPageMetadata;

export default function NewsletterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <StructuredData page="newsletter" />
      {children}
    </>
  );
}
