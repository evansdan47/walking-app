'use client';

import { AdminBadgeShineSettings } from '@/components/admin/admin-badge-shine-settings';
import { formatRuleSummary } from '@/lib/badges/rule-summary';
import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import Link from 'next/link';
import { useState } from 'react';

export function AdminBadgesList() {
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const badges = useQuery(api.badgeAdmin.listBadgeDefinitions, {
    search: search || undefined,
    activeOnly: activeOnly || undefined,
  });
  const seedCategories = useMutation(api.badgeAdmin.seedCategories);
  const seedBadges = useMutation(api.badgeAdmin.seedBadgesFromFile);
  const migrate = useMutation(api.badgeAdmin.migrateBadgeDefinitionsV2);
  const archive = useMutation(api.badgeAdmin.archiveBadge);
  const duplicate = useMutation(api.badgeAdmin.duplicateBadge);
  const [busy, setBusy] = useState<string | null>(null);

  async function runAction(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Badges</h1>
          <p className="text-sm text-gray-500 mt-1">Catalogue, rules, and unlock counts.</p>
        </div>
        <Link
          href="/admin/badges/new"
          className="rounded-lg bg-brand text-white text-sm font-semibold px-3 py-2 hover:opacity-90"
        >
          New badge
        </Link>
      </div>

      <AdminBadgeShineSettings />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => runAction('seed-cat', () => seedCategories({}))}
          className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
        >
          Seed categories
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => runAction('seed-badges', () => seedBadges({}))}
          className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
        >
          Seed badges
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => runAction('migrate', () => migrate({}))}
          className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
        >
          Migrate v2 fields
        </button>
        <Link
          href="/admin/badges/categories"
          className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          Manage categories
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or key…"
          className="flex-1 min-w-[12rem] rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          Active only
        </label>
      </div>

      {badges === undefined ? (
        <div className="h-48 rounded-xl bg-gray-100 animate-pulse" />
      ) : badges.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No badges yet. Run &quot;Seed badges&quot; or create one.
        </p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 font-semibold">Badge</th>
                <th className="px-3 py-2 font-semibold hidden md:table-cell">Category</th>
                <th className="px-3 py-2 font-semibold hidden lg:table-cell">Rule</th>
                <th className="px-3 py-2 font-semibold">Tier</th>
                <th className="px-3 py-2 font-semibold">Unlocks</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {badges.map((badge) => (
                <tr key={badge.id} className="hover:bg-gray-50/80">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/badges/${badge.key}`}
                      className="font-medium text-gray-900 hover:text-brand"
                    >
                      {badge.name}
                    </Link>
                    <p className="text-[10px] text-gray-400 font-mono">{badge.key}</p>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 hidden md:table-cell">
                    {badge.categoryName}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 hidden lg:table-cell max-w-xs truncate">
                    {formatRuleSummary(badge.ruleType, badge.ruleConfig)}
                  </td>
                  <td className="px-3 py-2.5 capitalize text-gray-600">{badge.tier ?? '—'}</td>
                  <td className="px-3 py-2.5 tabular-nums">{badge.unlockCount}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        badge.isActive
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {badge.isActive ? 'Active' : 'Archived'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          runAction(`dup-${badge.key}`, () => duplicate({ key: badge.key }))
                        }
                        className="text-[10px] font-medium text-gray-600 hover:text-brand"
                      >
                        Duplicate
                      </button>
                      {badge.isActive && (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            runAction(`arch-${badge.key}`, () => archive({ key: badge.key }))
                          }
                          className="text-[10px] font-medium text-gray-600 hover:text-red-600"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
