import { noIndexMetadata } from "@/lib/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = noIndexMetadata;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {children}
    </div>
  );
}
