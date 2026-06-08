import { AccountPageShell } from '@/components/account/account-page-shell';
import { AccountSectionPlaceholder } from '@/components/account/account-section-placeholder';

export default function AccountSettingsPage() {
  return (
    <AccountPageShell title="Account">
      <AccountSectionPlaceholder
        title="Account"
        description="Security, sessions, and account management — coming soon."
      />
    </AccountPageShell>
  );
}
