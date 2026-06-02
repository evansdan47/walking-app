import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center px-4 max-w-sm">
        <p className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-4 py-2">
          Rambleio is currently in <strong>closed beta</strong> — invite only.{' '}
          <Link href="/newsletter" className="underline hover:text-amber-900">
            Sign up to our newsletter
          </Link>{' '}
          to receive updates and be notified when we open up.
        </p>
      </div>
      <SignIn
        forceRedirectUrl="/home"
        appearance={{
          elements: {
            footerAction: { display: 'none' },
          },
        }}
      />
    </div>
  );
}
