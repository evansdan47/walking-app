'use client';

import { BadgeHex } from '@/components/badges/badge-hex';
import { CATEGORY_COLORS } from '@/lib/badges/tier-styles';
import { formatRuleSummary, RULE_TYPE_OPTIONS, TIER_OPTIONS } from '@/lib/badges/rule-summary';
import { api } from '@convex/_generated/api';
import type { BadgeRuleType } from '@convex/badgeRuleValidators';
import type { Id } from '@convex/_generated/dataModel';
import { useConvex, useMutation, useQuery } from 'convex/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type BadgeEditorProps = {
  badgeKey?: string;
};

function toDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

function defaultRuleConfig(ruleType: BadgeRuleType): Record<string, unknown> {
  switch (ruleType) {
    case 'total_distance':
    case 'single_walk_distance':
    case 'total_elevation_gain':
      return { targetMetres: 1000, period: 'lifetime' };
    case 'walk_count':
    case 'planned_route_count':
      return { target: 1, period: 'lifetime' };
    case 'walk_on_weekend':
      return { target: 1 };
    default:
      return {};
  }
}

export function AdminBadgeEditor({ badgeKey }: BadgeEditorProps) {
  const isNew = !badgeKey;
  const router = useRouter();
  const existing = useQuery(
    api.badgeAdmin.getBadgeByKey,
    badgeKey ? { key: badgeKey } : 'skip',
  );
  const categories = useQuery(api.badgeAdmin.listCategories);
  const convex = useConvex();
  const upsert = useMutation(api.badgeAdmin.upsertBadgeDefinition);
  const grant = useMutation(api.badgeAdmin.grantBadgeManual);

  const [key, setKey] = useState('');
  const [categoryKey, setCategoryKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lockedDescription, setLockedDescription] = useState('');
  const [icon, setIcon] = useState('award');
  const [tier, setTier] = useState<string>('bronze');
  const [ruleType, setRuleType] = useState<BadgeRuleType>('walk_count');
  const [ruleConfig, setRuleConfig] = useState<Record<string, unknown>>({ target: 1, period: 'lifetime' });
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [isHiddenUntilUnlocked, setIsHiddenUntilUnlocked] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [testUserId, setTestUserId] = useState('');
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setKey(existing.key);
    setCategoryKey(existing.categoryKey);
    setName(existing.name);
    setDescription(existing.description);
    setLockedDescription(existing.lockedDescription ?? '');
    setIcon(existing.icon);
    setTier(existing.tier ?? 'bronze');
    setRuleType(existing.ruleType);
    setRuleConfig(existing.ruleConfig);
    setDisplayOrder(existing.displayOrder);
    setIsActive(existing.isActive);
    setIsHiddenUntilUnlocked(existing.isHiddenUntilUnlocked);
    setStartsAt(existing.startsAt ? toDatetimeLocal(existing.startsAt) : '');
    setEndsAt(existing.endsAt ? toDatetimeLocal(existing.endsAt) : '');
  }, [existing]);

  useEffect(() => {
    if (categoryKey || !categories?.length) return;
    setCategoryKey(categories[0]!.key);
  }, [categories, categoryKey]);

  const categoryColor = useMemo(() => {
    const cat = categories?.find((c) => c.key === categoryKey);
    return cat?.color ?? CATEGORY_COLORS[categoryKey] ?? '#607D8B';
  }, [categories, categoryKey]);

  function updateRuleConfig(field: string, value: string | number) {
    setRuleConfig((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await upsert({
        key: key.trim(),
        categoryKey,
        name: name.trim(),
        description: description.trim(),
        lockedDescription: lockedDescription.trim() || undefined,
        icon: icon.trim() || 'award',
        tier: tier as 'bronze' | 'silver' | 'gold' | 'platinum',
        ruleType,
        ruleConfig,
        displayOrder,
        isActive,
        isHiddenUntilUnlocked,
        startsAt: fromDatetimeLocal(startsAt),
        endsAt: fromDatetimeLocal(endsAt),
      });
      if (isNew) {
        router.push(`/admin/badges/${key.trim()}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    if (!testUserId.trim() || !key.trim()) return;
    setPreviewResult(null);
    try {
      const result = await convex.query(api.badgeAdmin.previewEvaluation, {
        userId: testUserId.trim() as Id<'users'>,
        badgeKey: key.trim(),
      });
      setPreviewResult(
        `${result.met ? 'PASS' : 'FAIL'} — ${result.currentValue} / ${result.targetValue}${
          result.alreadyUnlocked ? ' (already unlocked)' : ''
        }`,
      );
    } catch (err) {
      setPreviewResult(err instanceof Error ? err.message : 'Preview failed');
    }
  }

  async function handleGrant() {
    if (!testUserId.trim() || !key.trim()) return;
    try {
      await grant({
        userId: testUserId.trim() as Id<'users'>,
        badgeKey: key.trim(),
      });
      setPreviewResult('Badge granted manually.');
    } catch (err) {
      setPreviewResult(err instanceof Error ? err.message : 'Grant failed');
    }
  }

  if (!isNew && existing === undefined) {
    return <div className="h-48 rounded-xl bg-gray-100 animate-pulse" />;
  }

  if (!isNew && existing === null) {
    return <p className="text-sm text-gray-500">Badge not found.</p>;
  }

  const showDistanceFields =
    ruleType === 'total_distance' ||
    ruleType === 'single_walk_distance' ||
    ruleType === 'total_elevation_gain';
  const showCountFields =
    ruleType === 'walk_count' || ruleType === 'planned_route_count' || ruleType === 'walk_on_weekend';
  const showPeriod =
    showDistanceFields ||
    ruleType === 'walk_count' ||
    ruleType === 'planned_route_count';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{isNew ? 'New badge' : name}</h1>
          {!isNew && <p className="text-xs text-gray-400 font-mono mt-0.5">{key}</p>}
        </div>
        <Link href="/admin/badges" className="text-sm text-brand hover:underline">
          ← Back to list
        </Link>
      </div>

      <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-900">Basic</h2>
            {isNew && (
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Key (immutable)</span>
                <input
                  required
                  value={key}
                  onChange={(e) => setKey(e.target.value.replace(/\s+/g, '_').toLowerCase())}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
                  placeholder="distance_250km"
                />
              </label>
            )}
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Name</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Category</span>
              <select
                value={categoryKey}
                onChange={(e) => setCategoryKey(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                {categories?.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Description</span>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Locked description</span>
              <textarea
                value={lockedDescription}
                onChange={(e) => setLockedDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Display order</span>
                <input
                  type="number"
                  min={1}
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-end gap-2 pb-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className="text-xs text-gray-700">Active</span>
              </label>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isHiddenUntilUnlocked}
                onChange={(e) => setIsHiddenUntilUnlocked(e.target.checked)}
              />
              <span className="text-xs text-gray-700">Hidden until unlocked</span>
            </label>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Seasonal start</span>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Seasonal end</span>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <p className="text-[10px] text-gray-400">
              Optional availability window — badge is hidden outside these dates.
            </p>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-900">Visual</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Icon key</span>
                <input
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Tier</span>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {TIER_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-900">Rule</h2>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Rule type</span>
              <select
                value={ruleType}
                onChange={(e) => {
                  const next = e.target.value as BadgeRuleType;
                  setRuleType(next);
                  setRuleConfig(defaultRuleConfig(next));
                }}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                {RULE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {showDistanceFields && (
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Target (metres)</span>
                <input
                  type="number"
                  min={1}
                  value={Number(ruleConfig.targetMetres ?? 0)}
                  onChange={(e) => updateRuleConfig('targetMetres', Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
            )}
            {showCountFields && (
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Target count</span>
                <input
                  type="number"
                  min={1}
                  value={Number(ruleConfig.target ?? 1)}
                  onChange={(e) => updateRuleConfig('target', Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
            )}
            {showPeriod && (
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Period</span>
                <select
                  value={String(ruleConfig.period ?? 'lifetime')}
                  onChange={(e) => updateRuleConfig('period', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="lifetime">Lifetime</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </label>
            )}
            <p className="text-xs text-gray-500">
              {formatRuleSummary(ruleType, ruleConfig)}
            </p>
          </section>

          {!isNew && (
            <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <h2 className="text-sm font-bold text-gray-900">Test</h2>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">User ID</span>
                <input
                  value={testUserId}
                  onChange={(e) => setTestUserId(e.target.value)}
                  placeholder="Convex users document id"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handlePreview}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  Preview rule
                </button>
                <button
                  type="button"
                  onClick={handleGrant}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  Grant manually
                </button>
              </div>
              {previewResult && (
                <p className="text-xs text-gray-600 font-mono">{previewResult}</p>
              )}
              {existing && (
                <p className="text-xs text-gray-500">{existing.unlockCount} total unlocks</p>
              )}
            </section>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand text-white text-sm font-semibold px-4 py-2 hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save badge'}
          </button>
        </div>

        <aside className="flex flex-col items-center gap-2">
          <p className="text-xs font-medium text-gray-500">Preview</p>
          <BadgeHex
            name={name || 'Badge'}
            icon={icon}
            categoryColor={categoryColor}
            tier={tier as 'bronze' | 'silver' | 'gold' | 'platinum'}
            status="locked"
            lockedDescription={lockedDescription}
            size="lg"
          />
        </aside>
      </form>
    </div>
  );
}
