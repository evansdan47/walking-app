'use client';

import { ADMIN_NAV, getAdminSection } from '@/lib/admin/sections';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminShell({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = getAdminSection(pathname ?? '/admin');

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-30 h-14 shrink-0 border-b border-gray-200 bg-white">
        <div className="h-full px-4 flex items-center gap-3 max-w-6xl mx-auto w-full">
          <Link href="/admin" className="shrink-0 flex items-center gap-2">
            <Image src="/Logo.png" alt="Rambleio" height={28} width={28} className="h-7 w-7" />
            <span className="text-sm font-semibold text-gray-900">Rambleio Admin</span>
          </Link>
          {title && title !== 'Overview' && (
            <>
              <span className="text-gray-300" aria-hidden>
                /
              </span>
              <span className="text-sm text-gray-600 truncate">{title}</span>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 max-w-6xl mx-auto w-full min-h-0">
        <aside className="w-52 shrink-0 border-r border-gray-200 bg-white hidden sm:block">
          <nav className="p-3 space-y-0.5 sticky top-14">
            {ADMIN_NAV.map((item) => {
              const isChild = Boolean(item.parentId);
              const isActive = active?.id === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isChild ? 'ml-3 text-[13px]' : ''
                  } ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
