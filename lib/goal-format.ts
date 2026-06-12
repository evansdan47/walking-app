import type { DistanceUnit, ElevationUnit } from '@/lib/format-units';
import { formatElevationCompact, formatMovingTimeTotal } from '@/lib/format-units';

export type GoalUnit = 'km' | 'walks' | 'seconds' | 'metres' | 'routes' | 'days';

const METRES_PER_MILE = 1609.344;

export function formatGoalProgress(
  value: number,
  unit: GoalUnit,
  distanceUnit: DistanceUnit,
  elevationUnit: ElevationUnit,
): string {
  switch (unit) {
    case 'km':
      if (distanceUnit === 'miles') {
        const miles = (value * 1000) / METRES_PER_MILE;
        return miles >= 10 ? `${miles.toFixed(1)} mi` : `${miles.toFixed(2)} mi`;
      }
      return value >= 10 ? `${value.toFixed(1)} km` : `${value.toFixed(2)} km`;
    case 'walks':
      return `${Math.round(value)} walk${Math.round(value) === 1 ? '' : 's'}`;
    case 'seconds':
      return formatMovingTimeTotal(value);
    case 'metres':
      return formatElevationCompact(value, elevationUnit);
    case 'routes':
      return `${Math.round(value)} route${Math.round(value) === 1 ? '' : 's'}`;
    case 'days':
      return `${Math.round(value)} day${Math.round(value) === 1 ? '' : 's'}`;
    default:
      return String(Math.round(value * 10) / 10);
  }
}

export function formatGoalTarget(
  value: number,
  unit: GoalUnit,
  distanceUnit: DistanceUnit,
  elevationUnit: ElevationUnit,
): string {
  return formatGoalProgress(value, unit, distanceUnit, elevationUnit);
}

export const GOAL_PROGRESS_COLORS = ['#2e7d32', '#e65100', '#0288d1'] as const;

export function formatChallengeDayLabel(day: number): string {
  return `Day ${day}`;
}
