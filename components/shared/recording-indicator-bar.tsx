import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { useWalkSessionContext } from '@/contexts/walk-session-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { sheetEvents } from '@/lib/ui/sheet-events';

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function RecordingIndicatorBar() {
  const { state, pausedDurationMs } = useWalkSessionContext();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [elapsed, setElapsed] = useState('00:00');

  const isVisible = state.phase === 'recording' || state.phase === 'paused';

  // Pulsing dot animation
  useEffect(() => {
    if (!isVisible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.25, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isVisible, pulseAnim]);

  // Ticking elapsed timer
  useEffect(() => {
    if (!isVisible) return;
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
  }, [isVisible, state, pausedDurationMs]);

  if (!isVisible) return null;

  return (
    <TouchableOpacity
      onPress={() => sheetEvents.open('record')}
      activeOpacity={0.85}
      style={[styles.bar, { backgroundColor: colors.primary }]}
    >
      <View style={styles.left}>
        <Animated.View style={[styles.dot, { opacity: pulseAnim }]} />
        <Text style={styles.label}>Recording</Text>
      </View>
      <Text style={styles.timer}>{elapsed}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
  },
  left: {
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
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
    color: '#fff',
    letterSpacing: 0.3,
  },
  timer: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
    color: '#fff',
    letterSpacing: 0.5,
  },
});
