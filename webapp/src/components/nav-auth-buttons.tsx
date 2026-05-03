'use client';

import { UserButton, useAuth, useClerk } from '@clerk/nextjs';
import Link from 'next/link';

export function NavAuthButtons() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => signOut({ redirectUrl: '/' })}
          className="text-sm font-semibold bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          Log Out
        </button>
        <UserButton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/sign-in"
        className="text-sm font-semibold bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
      >
        Log In
      </Link>
    </div>
  );
}
