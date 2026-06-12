import { AccountScreen } from '@/components/account/account-screen';
import { SubscriptionPanel } from '@/components/account/subscription-panel';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SubscriptionScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <AccountScreen title="Subscription">
      <ThemedText type="body" style={{ color: colors.textMuted }}>
        Manage your Rambleio membership.
      </ThemedText>
      <SubscriptionPanel />
    </AccountScreen>
  );
}
