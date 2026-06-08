'use client';

import { SubscriptionPanel } from '@/components/account/subscription-panel';

export function AccountMenuSubscription() {
  return (
    <div className="space-y-1">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-gray-900">Subscription</h2>
        <p className="text-xs text-gray-500 mt-0.5">Your plan and billing settings.</p>
      </div>
      <SubscriptionPanel variant="menu" />
    </div>
  );
}
