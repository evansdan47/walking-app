import { AccountMenuGoals } from '@/components/account/account-menu-goals';
import { AccountPageShell } from '@/components/account/account-page-shell';

export default function AccountGoalsPage() {
  return (
    <AccountPageShell title="Goals">
      <AccountMenuGoals />
    </AccountPageShell>
  );
}
