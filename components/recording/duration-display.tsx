import { StatCard } from '@/components/shared/stat-card';

interface DurationDisplayProps {
  durationSeconds: number;
  label?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function DurationDisplay({
  durationSeconds,
  label = 'Duration',
  size = 'md',
}: DurationDisplayProps) {
  return (
    <StatCard
      label={label}
      value={formatDuration(durationSeconds)}
      size={size}
      align="center"
    />
  );
}
