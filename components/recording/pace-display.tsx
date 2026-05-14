import { StatCard } from '@/components/shared/stat-card';
import { METRIC_ICONS } from '@/constants/metric-icons';

interface PaceDisplayProps {
  paceSecsPerKm: number | undefined | null;
  unit?: 'km' | 'mi';
}

function formatPace(secsPerKm: number, unit: 'km' | 'mi'): string {
  const secs = unit === 'mi' ? secsPerKm * 1.60934 : secsPerKm;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function PaceDisplay({ paceSecsPerKm, unit = 'km' }: PaceDisplayProps) {
  const value = paceSecsPerKm ? formatPace(paceSecsPerKm, unit) : '--:--';
  const unitLabel = `/${unit}`;
  return <StatCard label="Pace" value={value} unit={unitLabel} size="md" align="center" icon={METRIC_ICONS.pace} />;
}
