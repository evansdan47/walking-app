import { AccountScreen } from '@/components/account/account-screen';
import { PreferencesScreenContent } from '@/components/account/preferences-screen-content';

export default function PreferencesScreen() {
  return (
    <AccountScreen title="Preferences">
      <PreferencesScreenContent />
    </AccountScreen>
  );
}
