'use client';

import type { AccountMenuView } from '@/components/account/account-menu-views';
import { BetaBadge } from '@/components/account/beta-badge';
import { BadgeGrid, BadgeGridCell } from '@/components/badges/badge-grid';
import { GoalProgressBar } from '@/components/account/goal-progress-bar';
import { GOAL_PROGRESS_COLORS } from '@/lib/goal-format';
import { UserAvatar, useUserDisplay } from '@/components/account/user-avatar';
import { useUserPreferences } from '@/components/user-preferences-context';
import {
  formatDistanceMetresShort,
  formatElevation,
  formatMovingTimeTotal,
} from '@/lib/format-units';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';

type AccountMenuOverviewProps = {
  onNavigate: (view: AccountMenuView) => void;
};

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="text-center px-1 space-y-1.5">
          <div className="h-4 bg-gray-100 rounded mx-auto w-12" />
          <div className="h-3 bg-gray-100 rounded mx-auto w-16" />
        </div>
      ))}
    </div>
  );
}

export function AccountMenuOverview({ onNavigate }: AccountMenuOverviewProps) {
  const { name, email } = useUserDisplay();
  const { distanceUnit, elevationUnit } = useUserPreferences();
  const stats = useQuery(api.users.getLifetimeStats);
  const recentGoals = useQuery(api.userGoals.listRecentForOverview, { limit: 3 });
  const recentBadges = useQuery(api.badges.listRecentUnlocked, { limit: 5 });

  const progressStats =
    stats === undefined
      ? null
      : stats === null
        ? []
        : [
            { value: stats.walkCount.toLocaleString(), sub: 'Walks' },
            {
              value: formatDistanceMetresShort(stats.totalDistanceMetres, distanceUnit),
              sub: 'Total distance',
            },
            {
              value: formatElevation(stats.totalElevationGainMetres, elevationUnit),
              sub: 'Total ascent',
            },
            {
              value: formatMovingTimeTotal(stats.totalMovingTimeSeconds),
              sub: 'Moving time',
            },
          ];

  return (
    <div className="space-y-4">
      {/* Profile header */}
      <section className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="relative px-4 py-4 bg-gradient-to-br from-emerald-50 via-white to-orange-50/30">
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            aria-hidden
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 80'%3E%3Cpath fill='%23a7f3d0' d='M0 80 L80 40 L160 55 L240 25 L320 50 L400 30 L400 80 Z'/%3E%3Cpath fill='%236ee7b7' opacity='.5' d='M0 80 L100 50 L200 60 L300 35 L400 45 L400 80 Z'/%3E%3C/svg%3E")`,
              backgroundSize: 'cover',
              backgroundPosition: 'bottom',
            }}
          />
          <div className="relative flex items-start gap-4">
            <UserAvatar size="xl" className="ring-2 ring-white shadow-sm" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-bold text-gray-900 text-sm">{name}</p>
                <BetaBadge />
              </div>
              {email && <p className="text-xs text-gray-500 truncate mt-0.5">{email}</p>}
              <p className="text-[11px] text-gray-600 mt-1.5 leading-snug">
                Thank you for being part of our journey.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="shrink-0 rounded-lg border-2 border-brand text-brand font-semibold text-[11px] px-2.5 py-1.5 hover:bg-orange-50 transition-colors"
            >
              View profile
            </button>
          </div>
        </div>
      </section>

      {/* Progress */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Your progress</h2>
        {progressStats === null ? (
          <StatsSkeleton />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {progressStats.map((stat) => (
              <div key={stat.sub} className="text-center px-1">
                <p className="text-sm font-bold text-gray-900 leading-tight">{stat.value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Goals */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900">Recent goals</h2>
          <button
            type="button"
            onClick={() => onNavigate('goals')}
            className="text-xs font-medium text-brand hover:underline"
          >
            View all goals
          </button>
        </div>
        {recentGoals === undefined ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded" />
            ))}
          </div>
        ) : recentGoals.length === 0 ? (
          <p className="text-[10px] text-gray-400">
            No active goals.{' '}
            <button
              type="button"
              onClick={() => onNavigate('goals')}
              className="text-brand font-medium hover:underline"
            >
              Create one
            </button>
          </p>
        ) : (
          <div className="space-y-3">
            {recentGoals.map((goal, i) => (
              <GoalProgressBar
                key={goal._id}
                title={goal.title}
                subtitle={goal.subtitle}
                challengeDay={goal.challengeDay}
                progressValue={goal.progressValue}
                targetValue={goal.targetValue}
                unit={goal.unit}
                progressPercent={goal.progressPercent}
                colorClass={GOAL_PROGRESS_COLORS[i % GOAL_PROGRESS_COLORS.length]}
              />
            ))}
          </div>
        )}
      </section>

      {/* Badges */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900">Recent badges</h2>
          <button
            type="button"
            onClick={() => onNavigate('badges')}
            className="text-xs font-medium text-brand hover:underline"
          >
            View all badges
          </button>
        </div>
        {recentBadges === undefined ? (
          <div className="grid grid-cols-5 gap-x-1 gap-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="h-14 w-full rounded bg-gray-100" />
                <div className="h-4 w-3/4 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : recentBadges.length === 0 ? (
          <p className="text-[10px] text-gray-400">
            No badges yet.{' '}
            <button
              type="button"
              onClick={() => onNavigate('badges')}
              className="text-brand font-medium hover:underline"
            >
              View catalogue
            </button>
          </p>
        ) : (
          <BadgeGrid ariaLabel="Recent badges">
            {recentBadges.map((badge) => (
              <BadgeGridCell
                key={badge.key}
                name={badge.name}
                icon={badge.icon}
                categoryColor={badge.categoryColor}
                tier={badge.tier}
                status="earned"
                isNew={badge.isNew}
                onClick={() => onNavigate('badges')}
              />
            ))}
          </BadgeGrid>
        )}
      </section>
    </div>
  );
}
