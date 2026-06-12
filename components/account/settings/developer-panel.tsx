import { Ionicons } from '@expo/vector-icons';
import { useConvex } from 'convex/react';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { RouteColourPicker } from '@/components/ui/route-colour-picker';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouteColours } from '@/hooks/use-route-colours';
import { downloadWalksFromCloud } from '@/lib/sync/download-walks';

export function DeveloperPanel() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { colours, setColour, resetColours } = useRouteColours();
  const convex = useConvex();
  const [syncing, setSyncing] = useState(false);

  const handleSyncFromCloud = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await downloadWalksFromCloud(convex);
      if (result.downloaded === 0 && result.failed === 0) {
        Alert.alert('Up to date', 'All cloud walks are already on this device.');
      } else if (result.failed > 0) {
        Alert.alert(
          'Sync complete',
          `Downloaded ${result.downloaded} walk${result.downloaded !== 1 ? 's' : ''}. ${result.failed} failed — check Diagnostics for details.`,
        );
      } else {
        Alert.alert(
          'Sync complete',
          `Downloaded ${result.downloaded} walk${result.downloaded !== 1 ? 's' : ''} from the cloud.`,
        );
      }
    } catch {
      Alert.alert('Sync failed', 'Could not reach the server. Please check your connection and try again.');
    } finally {
      setSyncing(false);
    }
  }, [convex]);

  return (
    <View style={styles.container}>
      <ThemedText type="caption" style={{ color: colors.textMuted }}>
        Download completed walks from the cloud that are missing on this device.
      </ThemedText>
      <Pressable
        style={[
          styles.actionButton,
          { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' },
          syncing && { opacity: 0.5 },
        ]}
        onPress={handleSyncFromCloud}
        disabled={syncing}
      >
        <Ionicons name={syncing ? 'sync' : 'cloud-download-outline'} size={16} color={colors.primary} />
        <ThemedText type="caption" style={{ color: colors.primary, fontWeight: '600' }}>
          {syncing ? 'Syncing…' : 'Sync from Cloud'}
        </ThemedText>
      </Pressable>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.devColourHeader}>
        <ThemedText type="caption" style={{ color: colors.textMuted, flex: 1 }}>
          Route colours
        </ThemedText>
        <Pressable onPress={resetColours} hitSlop={8}>
          <ThemedText type="caption" style={{ color: colors.primary }}>
            Reset
          </ThemedText>
        </Pressable>
      </View>

      <RouteColourPicker
        label="Positive (fast / descent)"
        colour={colours.positive}
        onChange={(hex) => setColour('positive', hex)}
      />
      <RouteColourPicker
        label="Neutral (flat / indeterminate)"
        colour={colours.neutral}
        onChange={(hex) => setColour('neutral', hex)}
      />
      <RouteColourPicker
        label="Negative (slow / ascent)"
        colour={colours.negative}
        onChange={(hex) => setColour('negative', hex)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  devColourHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
