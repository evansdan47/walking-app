import { AccountScreen } from '@/components/account/account-screen';
import { DiagnosticsPanel } from '@/components/profile/diagnostics-panel';

export default function DiagnosticsScreen() {
  return (
    <AccountScreen title="Diagnostics">
      <DiagnosticsPanel />
    </AccountScreen>
  );
}
