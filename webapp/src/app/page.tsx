import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { LandingPage } from "@/app/components/landing-page";

export default async function RootPage() {
  const { userId } = await auth();
  if (userId) {
    redirect('/home');
  }
  return <LandingPage />;
}

