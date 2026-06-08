'use client';

import { formatChallengeDayLabel, formatGoalProgress, formatGoalTarget, type GoalUnit } from '@/lib/goal-format';
import { useUserPreferences } from '@/components/user-preferences-context';

export type GoalProgressBarProps = {
  title: string;
  subtitle?: string;
  /** Open-ended challenge day counter (Day 1 = created). */
  challengeDay?: number;
  progressValue: number;
  targetValue: number;
  unit: GoalUnit;
  progressPercent: number;
  colorClass?: string;
};

export function GoalProgressBar({
  title,
  subtitle,
  challengeDay,
  progressValue,
  targetValue,
  unit,
  progressPercent,
  colorClass = 'bg-emerald-500',
}: GoalProgressBarProps) {
  const { distanceUnit, elevationUnit } = useUserPreferences();
  const currentLabel = formatGoalProgress(progressValue, unit, distanceUnit, elevationUnit);
  const targetLabel = formatGoalTarget(targetValue, unit, distanceUnit, elevationUnit);
  const pct = Math.min(100, progressPercent);

  return (
    <div>
      <div className="flex justify-between gap-2 mb-1">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-900 leading-snug">{title}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {subtitle && <p className="text-[10px] text-gray-500">{subtitle}</p>}
            {challengeDay != null && (
              <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-800 text-[9px] font-semibold px-1.5 py-0.5 tabular-nums">
                {formatChallengeDayLabel(challengeDay)}
              </span>
            )}
          </div>
        </div>
        <p className="text-[10px] text-gray-600 shrink-0 tabular-nums">
          {currentLabel} / {targetLabel}
        </p>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
