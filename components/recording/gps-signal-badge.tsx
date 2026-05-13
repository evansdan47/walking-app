/**
 * GpsSignalBadge — map overlay pill showing GPS signal quality.
 *
 * Maps raw accuracy metres to a human-readable signal level.
 * Does NOT show raw metre values to the user.
 */
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface GpsSignalBadgeProps {
  accuracyMetres: number | null;
}

type SignalLevel = 'strong' | 'good' | 'weak' | 'searching';

function getSignalLevel(accuracy: number | null): SignalLevel {
  if (accuracy == null || accuracy > 50) return 'searching';
  if (accuracy <= 10) return 'strong';
  if (accuracy <= 25) return 'good';
  return 'weak';
}

const SIGNAL_CONFIG: Record<SignalLevel, { label: string; bars: 4 | 3 | 2 | 1; color: string }> = {
  strong:    { label: 'GPS Strong',    bars: 4, color: '#2e7d32' },
  good:      { label: 'GPS Good',      bars: 3, color: '#388e3c' },
  weak:      { label: 'GPS Weak',      bars: 2, color: '#f57c00' },
  searching: { label: 'GPS Searching', bars: 1, color: '#9e9e9e' },
};

function SignalBars({ bars, color }: { bars: 1 | 2 | 3 | 4; color: string }) {
  return (
    <View style={barStyles.container}>
      {([1, 2, 3, 4] as const).map((level) => (
        <View
          key={level}
          style={[
            barStyles.bar,
            { height: 5 + level * 3 },
            level <= bars
              ? { backgroundColor: color }
              : { backgroundColor: color + '44' },
          ]}
        />
      ))}
    </View>
  );
}

export function GpsSignalBadge({ accuracyMetres }: GpsSignalBadgeProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const level = getSignalLevel(accuracyMetres);
  const config = SIGNAL_CONFIG[level];

  return (
    <View style={[styles.badge, { backgroundColor: colors.backgroundCard }]}>
      <SignalBars bars={config.bars} color={config.color} />
      <Text style={[styles.label, { color: colors.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  label: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
});

const barStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 17,
  },
  bar: {
    width: 4,
    borderRadius: 1,
  },
});
