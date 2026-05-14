import { useEffect, useRef, useState } from 'react';
import { type ViewStyle } from 'react-native';

import { StatCard } from '@/components/shared/stat-card';
import { METRIC_ICONS } from '@/constants/metric-icons';

interface ElapsedTimerProps {
  startedAt: number;
  pausedDurationMs: number;
  running: boolean;
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'center' | 'right';
  style?: ViewStyle;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ElapsedTimer({
  startedAt,
  pausedDurationMs,
  running,
  size = 'md',
  align,
  style,
}: ElapsedTimerProps) {
  const [display, setDisplay] = useState('00:00:00');
  const pausedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      pausedAtRef.current = null;
      const tick = () => {
        const elapsed = Date.now() - startedAt - pausedDurationMs;
        setDisplay(formatElapsed(Math.max(0, elapsed)));
      };
      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    } else {
      // Paused — keep displaying last value, no more ticks
    }
    return undefined;
  }, [running, startedAt, pausedDurationMs]);

  return <StatCard label="Elapsed" value={display} size={size} accent align={align ?? 'center'} style={style} icon={METRIC_ICONS.duration} />;
}
