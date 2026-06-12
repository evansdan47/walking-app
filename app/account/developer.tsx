import { AccountScreen } from '@/components/account/account-screen';
import { DeveloperPanel } from '@/components/account/settings/developer-panel';

export default function DeveloperScreen() {
  return (
    <AccountScreen title="Developer">
      <DeveloperPanel />
    </AccountScreen>
  );
}
