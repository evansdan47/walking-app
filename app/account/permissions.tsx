import { AccountScreen } from '@/components/account/account-screen';
import { PermissionsPanel } from '@/components/account/settings/permissions-panel';

export default function PermissionsScreen() {
  return (
    <AccountScreen title="Permissions">
      <PermissionsPanel />
    </AccountScreen>
  );
}
