import { StatCard } from '@/components/shared/stat-card';
import { METRIC_ICONS } from '@/constants/metric-icons';

interface AltitudeDisplayProps {
  altitudeMetres: number | null | undefined;
}

export function AltitudeDisplay({ altitudeMetres }: AltitudeDisplayProps) {
  const value =
    altitudeMetres != null ? Math.round(altitudeMetres).toString() : '--';
  return <StatCard label="Alt ≈" value={value} {...(altitudeMetres != null ? { unit: 'm' } : {})} size="md" align="center" icon={METRIC_ICONS.altitude} />;
}
