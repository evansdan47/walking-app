import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';

interface RouteProximityBadgeProps {
  /** Current distance to the nearest route point in metres. */
  distanceM: number;
}

function getColors(distanceM: number): { bg: string; text: string; dot: string } {
  if (distanceM < 10)  return { bg: '#14532d', text: '#86efac', dot: '#4ade80' };
  if (distanceM < 30)  return { bg: '#713f12', text: '#fde68a', dot: '#fbbf24' };
  if (distanceM < 75)  return { bg: '#7c2d12', text: '#fed7aa', dot: '#fb923c' };
  return { bg: '#7f1d1d', text: '#fca5a5', dot: '#f87171' };
}

/**
 * Small pill badge that shows the user's distance from the planned route.
 * Colour shifts from green (on route) through amber and orange to red (off route).
 */
export function RouteProximityBadge({ distanceM }: RouteProximityBadgeProps) {
  const { bg, text, dot } = getColors(distanceM);
  const rounded = Math.round(distanceM);

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={[styles.value, { color: text }]}>
        {rounded}
        <Text style={[styles.unit, { color: text + 'bb' }]}> m</Text>
      </Text>
      <Text style={[styles.label, { color: text + '99' }]}>from path</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: Radius.sm * 3,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  value: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
    letterSpacing: 0.3,
  },
  unit: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
  },
  label: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
    letterSpacing: 0.2,
  },
});
