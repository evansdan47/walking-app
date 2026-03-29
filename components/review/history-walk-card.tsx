import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Walk } from '@/lib/db/walks';

interface HistoryWalkCardProps {
  walk: Walk;
  onPress: () => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDistance(metres: number): string {
  const km = metres / 1000;
  return km >= 1 ? `${km.toFixed(1)} km` : `${metres.toFixed(0)} m`;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function HistoryWalkCard({ walk, onPress }: HistoryWalkCardProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  const displayTitle =
    walk.title ??
    new Date(walk.startedAt).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

  return (
    <Pressable
      style={[
        styles.card,
        {
          backgroundColor: colors.backgroundCard,
          borderColor: colors.border,
          borderLeftColor: colors.primary,
        },
      ]}
      onPress={onPress}
      android_ripple={{ color: colors.primaryMuted }}
    >
      <View style={styles.body}>
        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {displayTitle}
        </Text>

        {/* Date + time */}
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {formatDate(walk.startedAt)} · {formatTime(walk.startedAt)}
        </Text>

        {/* Stat pills */}
        {walk.stats && (
          <View style={styles.pills}>
            <View style={[styles.pill, { backgroundColor: colors.primaryMuted }]}>
              <Text style={[styles.pillText, { color: colors.primary }]}>
                {formatDistance(walk.stats.distanceMetres)}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: colors.backgroundMuted }]}>
              <Text style={[styles.pillText, { color: colors.textMuted }]}>
                {formatDuration(walk.stats.durationSeconds)}
              </Text>
            </View>
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderRadius: Radius.md,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  body: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
  },
  meta: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
  },
  pills: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  pill: {
    borderRadius: Radius.full ?? 999,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  pillText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
  },
});
