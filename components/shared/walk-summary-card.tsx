import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { METRIC_ICONS } from '@/constants/metric-icons';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WalkStats } from '@/lib/db/walks';
import { StatCard } from './stat-card';
import { StatGrid } from './stat-grid';

interface WalkSummaryCardProps {
  walk: {
    title?: string | null;
    startedAt: number;
    endedAt: number;
    stats: WalkStats;
  };
  onViewMap?: () => void;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDistance(metres: number): string {
  if (metres >= 1000) return (metres / 1000).toFixed(1);
  return metres.toFixed(0);
}

function formatDistanceUnit(metres: number): string {
  return metres >= 1000 ? 'km' : 'm';
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatPace(secsPerKm: number | undefined): string {
  if (!secsPerKm) return '--:--';
  const m = Math.floor(secsPerKm / 60);
  const s = Math.round(secsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function WalkSummaryCard({ walk, onViewMap }: WalkSummaryCardProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const { stats } = walk;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.backgroundCard, borderColor: colors.border },
      ]}
    >
      {walk.title ? (
        <Text style={[styles.title, { color: colors.text }]}>{walk.title}</Text>
      ) : null}
      <Text style={[styles.date, { color: colors.textMuted }]}>
        {formatDate(walk.startedAt)}
      </Text>

      <StatGrid style={styles.grid}>
        <StatCard
          label="Distance"
          value={formatDistance(stats.distanceMetres)}
          unit={formatDistanceUnit(stats.distanceMetres)}
          size="md"
          icon={METRIC_ICONS.distance}
        />
        <StatCard
          label="Duration"
          value={formatDuration(stats.durationSeconds)}
          size="md"
          icon={METRIC_ICONS.duration}
        />
        <StatCard
          label="Avg. Pace"
          value={formatPace(stats.avgPaceSecsPerKm)}
          unit="/km"
          size="md"
          icon={METRIC_ICONS.pace}
        />
        <StatCard
          label="Moving Time"
          value={formatDuration(stats.movingTimeSeconds)}
          size="md"
          icon={METRIC_ICONS.movingTime}
        />
        {stats.elevationGainMetres !== undefined ? (
          <StatCard
            label="Elevation Gain"
            value={String(stats.elevationGainMetres)}
            unit="m"
            size="md"
            icon={METRIC_ICONS.elevationGain}
          />
        ) : null}
        {stats.elevationLossMetres !== undefined ? (
          <StatCard
            label="Elevation Loss"
            value={String(stats.elevationLossMetres)}
            unit="m"
            size="md"
            icon={METRIC_ICONS.elevationLoss}
          />
        ) : null}
      </StatGrid>

      {onViewMap ? (
        <TouchableOpacity
          style={[styles.mapButton, { borderColor: colors.border }]}
          onPress={onViewMap}
          disabled
          activeOpacity={0.6}
        >
          <Text style={[styles.mapButtonText, { color: colors.textMuted }]}>
            View on Map (coming soon)
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  title: {
    fontFamily: Typography.fontHeadline,
    fontSize: Typography.sizes.lg,
  },
  date: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
  },
  grid: {
    marginTop: Spacing.xs,
  },
  mapButton: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  mapButtonText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
});
