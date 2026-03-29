import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type BadgeStatus = 'idle' | 'recording' | 'paused' | 'completing' | 'completed';

interface RecordingStatusBadgeProps {
  status: BadgeStatus;
}

const LABEL: Record<BadgeStatus, string> = {
  idle: 'Ready',
  recording: 'Recording',
  paused: 'Paused',
  completing: 'Processing…',
  completed: 'Done',
};

const BG_COLOR: Record<string, string> = {
  recording: '#1b6d24',
  paused: '#a43700',
  idle: '#4a7080',
  completing: '#4a7080',
  completed: '#1b6d24',
};

export function RecordingStatusBadge({ status }: RecordingStatusBadgeProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'recording') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    } else {
      opacity.setValue(1);
    }
    return undefined;
  }, [status, opacity]);

  const bgColor = BG_COLOR[status] ?? colors.backgroundMuted;

  return (
    <Animated.View
      style={[styles.badge, { backgroundColor: bgColor, opacity }]}
    >
      <View style={styles.dot} />
      <Text style={styles.label}>{LABEL[status]}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: Radius.sm * 3,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
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
});
