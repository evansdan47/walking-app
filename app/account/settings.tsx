import { useUser } from '@clerk/expo';

import { AccountScreen } from '@/components/account/account-screen';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AccountSettingsScreen() {
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  return (
    <AccountScreen title="Account">
      <ThemedText type="body" style={{ color: colors.textMuted }}>
        Account management — more options coming soon.
      </ThemedText>
      {email ? (
        <ThemedText type="body" style={{ marginTop: Spacing.sm }}>
          Signed in as {email}
        </ThemedText>
      ) : null}
    </AccountScreen>
  );
}
