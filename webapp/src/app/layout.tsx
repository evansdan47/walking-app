import { Providers } from "@/components/providers";
import { rootMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = rootMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className={`${inter.variable} min-h-full flex flex-col text-slate`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
