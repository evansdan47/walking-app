import { LandingPage } from "@/app/components/landing-page";
import { StructuredData } from "@/components/structured-data";
import { landingPageMetadata } from "@/lib/metadata";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = landingPageMetadata;

export default async function RootPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/home");
  }
  return (
    <>
      <StructuredData page="landing" />
      <LandingPage />
    </>
  );
}

