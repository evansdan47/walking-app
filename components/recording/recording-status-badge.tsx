import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useWalkSessionContext } from '@/contexts/walk-session-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

type BadgeStatus = 'idle' | 'recording' | 'paused' | 'completing' | 'completed';

type SignalLevel = 'strong' | 'good' | 'weak' | 'searching';

interface RecordingStatusBadgeProps {
  status: BadgeStatus;
  /** Pass the GPS accuracy (metres) to show signal bars inline. */
  accuracyMetres?: number | null;
  onPress?: () => void;
}

const LABEL: Record<BadgeStatus, string> = {
  idle: 'Ready',
  recording: 'Recording',
  paused: 'Paused',
  completing: 'Processing…',
  completed: 'Done',
};

const BG_COLOR: Record<string, string> = {
  recording: '#b91c1c',
  paused: '#a43700',
  idle: '#4a7080',
  completing: '#4a7080',
  completed: '#1b6d24',
};

function getSignalLevel(accuracy: number | null | undefined): SignalLevel {
  if (accuracy == null || accuracy > 50) return 'searching';
  if (accuracy <= 10) return 'strong';
  if (accuracy <= 25) return 'good';
  return 'weak';
}

const SIGNAL_COLOR: Record<SignalLevel, string> = {
  strong:    '#4ade80',
  good:      '#86efac',
  weak:      '#fbbf24',
  searching: '#9ca3af',
};

function SignalBars({ bars, color }: { bars: 1 | 2 | 3 | 4; color: string }) {
  return (
    <View style={barStyles.container}>
      {([1, 2, 3, 4] as const).map((level) => (
        <View
          key={level}
          style={[
            barStyles.bar,
            { height: 4 + level * 2 },
            level <= bars
              ? { backgroundColor: color }
              : { backgroundColor: color + '55' },
          ]}
        />
      ))}
    </View>
  );
}

const BARS: Record<SignalLevel, 1 | 2 | 3 | 4> = {
  strong: 4, good: 3, weak: 2, searching: 1,
};

export function RecordingStatusBadge({ status, accuracyMetres, onPress }: RecordingStatusBadgeProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const opacity = useRef(new Animated.Value(1)).current;
  // useWalkSessionContext is kept for the pulsing animation trigger only
  useWalkSessionContext();

  useEffect(() => {
    if (status === 'recording') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    } else {
      opacity.setValue(1);
    }
    return undefined;
  }, [status, opacity]);

  const bgColor = BG_COLOR[status] ?? '#4a7080';
  const showSignal = status === 'recording' || status === 'paused';
  const level = getSignalLevel(accuracyMetres);
  const sigColor = SIGNAL_COLOR[level];

  const inner = (
    <Animated.View style={[styles.badge, { backgroundColor: bgColor, opacity }]}>
      <View style={styles.row}>
        <View style={styles.dot} />
        <Text style={styles.label}>{LABEL[status]}</Text>
        {showSignal && (
          <>
            <View style={styles.divider} />
            <SignalBars bars={BARS[level]} color={sigColor} />
            <Text style={[styles.gpsLabel, { color: sigColor }]}>GPS</Text>
          </>
        )}
      </View>
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: Radius.sm * 3,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  label: {
    color: '#fff',
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
    letterSpacing: 0.5,
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginHorizontal: Spacing.xs,
  },
  gpsLabel: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
    letterSpacing: 0.3,
  },
});

const barStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: {
    width: 4,
    borderRadius: 1,
  },
});

