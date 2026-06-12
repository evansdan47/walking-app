import Image from 'next/image';
import Link from 'next/link';

/** Minimal full-page shell for Account / Help (opened in a new tab from the menu). */
export function AccountPageShell({
  title,
  showMapLink = true,
  children,
}: {
  title: string;
  /** When false, header shows only the logo and title (e.g. badges popup window). */
  showMapLink?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-30 h-14 shrink-0 border-b border-gray-200 bg-white">
        <div className="h-full px-4 flex items-center justify-between gap-4 max-w-3xl mx-auto w-full">
          <Link href="/home" className="shrink-0 flex items-center gap-2">
            <Image src="/Logo.png" alt="Rambleio" height={28} width={28} className="h-7 w-7" />
            <span className="text-sm font-semibold text-gray-900">{title}</span>
          </Link>
          {showMapLink && (
            <Link
              href="/map"
              className="text-sm font-medium text-gray-600 hover:text-brand transition-colors"
            >
              Open map
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full">{children}</main>
    </div>
  );
}
