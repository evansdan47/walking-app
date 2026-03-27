import { StyleSheet } from 'react-native';

import { AppHeader } from '@/components/shared/app-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function WalkLibraryScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="My Walks" />
      <ThemedView style={styles.body}>
        <ThemedText type="body" style={{ color: colors.textMuted }}>
          Your recorded walks will appear here.
        </ThemedText>
        <ThemedText type="caption" style={[styles.stage, { color: colors.textMuted }]}>
          Coming in Stage 2
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: 'transparent',
  },
  stage: {
    marginTop: Spacing.sm,
    opacity: 0.5,
  },
});
