import { AccountPageShell } from '@/components/account/account-page-shell';
import { WEB_APP_VERSION } from '@/lib/app-version';
import Link from 'next/link';

export default function AccountHelpPage() {
  return (
    <AccountPageShell title="Help & support">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Help & support</h1>
        <p className="text-sm text-gray-500 mb-6">
          Get help with Rambleio and find useful links.
        </p>
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-900">App version</p>
            <p className="text-sm text-gray-500 mt-0.5">Rambleio web v{WEB_APP_VERSION}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Need help?</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Contact us at{' '}
              <a href="mailto:support@rambleio.app" className="text-brand hover:underline">
                support@rambleio.app
              </a>
            </p>
          </div>
          <Link href="/map" className="inline-block text-sm font-medium text-brand hover:underline">
            Open map
          </Link>
        </div>
      </div>
    </AccountPageShell>
  );
}
