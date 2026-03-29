import { DistanceDisplay } from '@/components/recording/distance-display';
import { DurationDisplay } from '@/components/recording/duration-display';
import { PaceDisplay } from '@/components/recording/pace-display';
import { StatCard } from '@/components/shared/stat-card';
import { StatGrid } from '@/components/shared/stat-grid';
import type { WalkStats } from '@/lib/db/walks';

interface WalkStatSummaryProps {
  stats: WalkStats | null;
}

export function WalkStatSummary({ stats }: WalkStatSummaryProps) {
  const elevGain = stats?.elevationGainMetres;
  const elevLoss = stats?.elevationLossMetres;

  const elevValue =
    elevGain != null
      ? elevLoss != null
        ? `↑${Math.round(elevGain)} ↓${Math.round(elevLoss)}`
        : `↑${Math.round(elevGain)}`
      : '--';
  const elevUnit = elevGain != null ? 'm' : undefined;

  return (
    <StatGrid columns={3}>
      {/* Row 1: Distance | Elevation | Pace */}
      <DistanceDisplay distanceMetres={stats?.distanceMetres ?? 0} />
      <StatCard
        label="Elevation"
        value={elevValue}
        {...(elevUnit !== undefined ? { unit: elevUnit } : {})}
        size="md"
        align="center"
      />
      <PaceDisplay paceSecsPerKm={stats?.avgPaceSecsPerKm} />
      {/* Row 2: Duration | Moving | Stopped — all time, same row, smaller font */}
      <DurationDisplay durationSeconds={stats?.durationSeconds ?? 0} size="xs" />
      <DurationDisplay
        durationSeconds={stats?.movingTimeSeconds ?? 0}
        label="Moving"
        size="xs"
      />
      <DurationDisplay
        durationSeconds={stats?.stoppedTimeSeconds ?? 0}
        label="Stopped"
        size="xs"
      />
    </StatGrid>
  );
}
