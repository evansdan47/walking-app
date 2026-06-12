import { AccountScreen } from '@/components/account/account-screen';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SharingScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <AccountScreen title="Sharing">
      <ThemedText type="body" style={{ color: colors.textMuted }}>
        Share walks and routes with friends — coming soon.
      </ThemedText>
    </AccountScreen>
  );
}
