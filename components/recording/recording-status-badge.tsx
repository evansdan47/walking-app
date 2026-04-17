import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useWalkSessionContext } from '@/contexts/walk-session-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

type BadgeStatus = 'idle' | 'recording' | 'paused' | 'completing' | 'completed';

interface RecordingStatusBadgeProps {
  status: BadgeStatus;
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

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function RecordingStatusBadge({ status, onPress }: RecordingStatusBadgeProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const opacity = useRef(new Animated.Value(1)).current;
  const { state, pausedDurationMs } = useWalkSessionContext();
  const [elapsed, setElapsed] = useState('00:00');
  const showElapsed = status === 'recording' || status === 'paused';

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

  useEffect(() => {
    if (!showElapsed) return;
    const tick = () => {
      if (state.phase !== 'recording' && state.phase !== 'paused') return;
      const now = Date.now();
      const running = state.phase === 'recording';
      const rawMs = now - state.startedAt;
      const pauseOffset = running ? pausedDurationMs : pausedDurationMs + (now - state.pausedAt);
      setElapsed(formatElapsed(Math.max(0, rawMs - pauseOffset)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [showElapsed, state, pausedDurationMs]);

  const bgColor = BG_COLOR[status] ?? colors.backgroundMuted;

  const inner = (
    <Animated.View style={[styles.badge, { backgroundColor: bgColor, opacity }]}>
      <View style={styles.row}>
        <View style={styles.dot} />
        <Text style={styles.label}>{LABEL[status]}</Text>
      </View>
      {showElapsed && <Text style={styles.elapsed}>{elapsed}</Text>}
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
    gap: 2,
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
  elapsed: {
    color: '#fff',
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
    letterSpacing: 0.3,
    opacity: 0.9,
  },
});
