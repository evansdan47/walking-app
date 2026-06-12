'use client';

import { ADMIN_NAV } from '@/lib/admin/sections';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import Link from 'next/link';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-lg font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

export function AdminOverview() {
  const overview = useQuery(api.admin.getOverview);

  if (overview === undefined) {
    return <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />;
  }

  const sections = ADMIN_NAV.filter((s) => s.id !== 'overview' && !s.parentId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage badges, releases, experiments, and tagging from one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => {
          let stats: React.ReactNode = null;

          switch (section.id) {
            case 'badges':
              stats = (
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Categories" value={overview.badges.categoryCount} />
                  <Stat label="Badges" value={overview.badges.definitionCount} />
                  <Stat label="Active" value={overview.badges.activeDefinitionCount} />
                  <Stat label="Total unlocks" value={overview.badges.totalUnlocks} />
                </div>
              );
              break;
            case 'releases':
              stats = (
                <div className="space-y-1 text-xs text-gray-600">
                  {overview.releases.platforms.length === 0 ? (
                    <p>No release policies seeded yet.</p>
                  ) : (
                    overview.releases.platforms.map((p) => (
                      <p key={p.platform}>
                        {p.platform}: min {p.minimumBuild}, latest {p.latestBuild}
                      </p>
                    ))
                  )}
                </div>
              );
              break;
            case 'experiments':
              stats = (
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Configs" value={overview.experiments.configCount} />
                  <Stat label="Enabled" value={overview.experiments.enabledCount} />
                </div>
              );
              break;
            case 'tags':
              stats = (
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Definitions" value={overview.tags.definitionCount} />
                  <Stat label="Active" value={overview.tags.activeCount} />
                </div>
              );
              break;
          }

          return (
            <section
              key={section.id}
              className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-4"
            >
              <div>
                <h2 className="text-sm font-bold text-gray-900">{section.label}</h2>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{section.description}</p>
              </div>
              {stats}
              <Link
                href={section.href}
                className="text-xs font-semibold text-brand hover:underline mt-auto"
              >
                Open {section.label.toLowerCase()} →
              </Link>
            </section>
          );
        })}
      </div>

      {overview.badges.topBadge && overview.badges.topBadge.unlockCount > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-900">Most unlocked badge</h2>
          <p className="text-sm text-gray-700 mt-2">
            {overview.badges.topBadge.name}{' '}
            <span className="text-gray-500">
              ({overview.badges.topBadge.unlockCount} unlocks)
            </span>
          </p>
        </section>
      )}
    </div>
  );
}
