import { StatCard } from '@/components/shared/stat-card';

interface DistanceDisplayProps {
  distanceMetres: number;
  unit?: 'km' | 'mi';
}

function format(metres: number, unit: 'km' | 'mi'): { value: string; unitLabel: string } {
  if (unit === 'mi') {
    const miles = metres / 1609.34;
    return { value: miles >= 1 ? miles.toFixed(1) : miles.toFixed(2), unitLabel: 'mi' };
  }
  const km = metres / 1000;
  return { value: km >= 1 ? km.toFixed(1) : (metres).toFixed(0), unitLabel: km >= 1 ? 'km' : 'm' };
}

export function DistanceDisplay({
  distanceMetres,
  unit = 'km',
}: DistanceDisplayProps) {
  const { value, unitLabel } = format(distanceMetres, unit);
  return <StatCard label="Distance" value={value} unit={unitLabel} size="md" align="center" />;
}
