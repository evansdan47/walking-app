import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppQuery } from '@/hooks/use-app-query';
import { useDisplayPreferences } from '@/hooks/use-display-preferences';
import {
  formatDistanceMetresShort,
  formatElevation,
  formatMovingTimeTotal,
  type DistanceUnit,
  type ElevationUnit,
} from '@/lib/format-units';

type StatTile = {
  value: string;
  label: string;
};

function StatsSkeleton() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={styles.grid}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View
          key={i}
          style={[styles.tile, { backgroundColor: colors.backgroundMuted, borderColor: colors.border }]}
        >
          <View style={[styles.skeletonValue, { backgroundColor: colors.border }]} />
          <View style={[styles.skeletonLabel, { backgroundColor: colors.border }]} />
        </View>
      ))}
    </View>
  );
}

export function ProgressStatsSection() {
  const stats = useAppQuery(api.users.getLifetimeStats);
  const { preferences } = useDisplayPreferences();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const distanceUnit: DistanceUnit = preferences.distanceUnit;
  const elevationUnit: ElevationUnit = preferences.elevationUnit;

  const tiles: StatTile[] | null =
    stats === undefined || stats === null
      ? null
      : [
            { value: stats.walkCount.toLocaleString(), label: 'Walks' },
            {
              value: formatDistanceMetresShort(stats.totalDistanceMetres, distanceUnit),
              label: 'Total distance',
            },
            {
              value: formatElevation(stats.totalElevationGainMetres, elevationUnit),
              label: 'Total ascent',
            },
            {
              value: formatMovingTimeTotal(stats.totalMovingTimeSeconds),
              label: 'Moving time',
            },
          ];

  return (
    <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.backgroundCard }]}>
      <ThemedText type="bodySemiBold" style={styles.heading}>
        Your progress
      </ThemedText>

      {tiles === null ? (
        <StatsSkeleton />
      ) : (
        <View style={styles.grid}>
          {tiles.map((tile) => (
            <View
              key={tile.label}
              style={[styles.tile, { backgroundColor: colors.background, borderColor: colors.border }]}
            >
              <ThemedText style={[styles.value, { fontFamily: Typography.fontBold }]}>
                {tile.value}
              </ThemedText>
              <ThemedText type="caption" style={{ color: colors.textMuted, textAlign: 'center' }}>
                {tile.label}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  heading: {
    fontSize: Typography.sizes.base,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tile: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '45%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  value: {
    fontSize: Typography.sizes.md,
    textAlign: 'center',
  },
  skeletonValue: {
    width: 48,
    height: 18,
    borderRadius: Radius.sm,
  },
  skeletonLabel: {
    width: 72,
    height: 10,
    borderRadius: Radius.sm,
  },
});
