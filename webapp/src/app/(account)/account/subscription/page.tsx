import { AccountPageShell } from '@/components/account/account-page-shell';
import { SubscriptionPanel } from '@/components/account/subscription-panel';

export default function AccountSubscriptionPage() {
  return (
    <AccountPageShell title="Subscription">
      <SubscriptionPanel variant="page" />
    </AccountPageShell>
  );
}
