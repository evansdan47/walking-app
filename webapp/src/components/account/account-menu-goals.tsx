'use client';

import { GoalProgressBar } from '@/components/account/goal-progress-bar';
import { GOAL_PROGRESS_COLORS } from '@/lib/goal-format';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useMemo, useRef, useState } from 'react';

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700 mb-1.5 block">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CreateGoalForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const catalog = useQuery(api.userGoals.getCatalog);
  const createGoal = useMutation(api.userGoals.create);

  const [categoryId, setCategoryId] = useState('');
  const [period, setPeriod] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = useMemo(
    () => catalog?.categories.find((c) => c.id === categoryId),
    [catalog, categoryId],
  );

  const isChallengeCategory = Boolean(category?.challenges?.length);

  useEffect(() => {
    if (!category) return;
    setPeriod(category.periods[0] ?? '');
    setTargetValue('');
    setChallengeId('');
  }, [category]);

  const periodOptions = useMemo(() => {
    if (!category) return [];
    const labels: Record<string, string> = {
      daily: 'Today',
      weekly: 'This week',
      monthly: 'This month',
      yearly: 'This year',
      lifetime: 'Lifetime',
    };
    return category.periods.map((p) => ({ value: p, label: labels[p] ?? p }));
  }, [category]);

  const targetOptions = useMemo(() => {
    if (!category?.targetPresets) return [];
    return category.targetPresets.map((p) => ({
      value: String(p.value),
      label: p.label,
    }));
  }, [category]);

  const challengeOptions = useMemo(() => {
    if (!category?.challenges) return [];
    return category.challenges.map((c) => ({
      value: c.id,
      label: `${c.label} (${c.targetValue.toLocaleString()} ${c.unit})`,
    }));
  }, [category]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) return;
    setSaving(true);
    setError(null);
    try {
      await createGoal({
        category: category.id,
        period: period as 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime',
        ...(isChallengeCategory
          ? { challengeId }
          : { targetValue: Number(targetValue) }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create goal');
    } finally {
      setSaving(false);
    }
  }

  if (!catalog) {
    return <p className="text-xs text-gray-400 py-4">Loading goal options…</p>;
  }

  const canSubmit =
    category &&
    period &&
    (isChallengeCategory ? challengeId : targetValue) &&
    !saving;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-gray-900">New goal</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] font-medium text-gray-500 hover:text-gray-800"
        >
          Cancel
        </button>
      </div>

      <SelectField
        label="Category"
        value={categoryId}
        onChange={setCategoryId}
        placeholder="Choose a category"
        disabled={saving}
        options={catalog.categories.map((c) => ({ value: c.id, label: c.label }))}
      />

      {category && (
        <p className="text-[10px] text-gray-500 -mt-1">{category.description}</p>
      )}

      {category && periodOptions.length > 1 && (
        <SelectField
          label="Time period"
          value={period}
          onChange={setPeriod}
          disabled={saving}
          options={periodOptions}
        />
      )}

      {category && isChallengeCategory && (
        <SelectField
          label="Challenge"
          value={challengeId}
          onChange={setChallengeId}
          placeholder="Choose a challenge"
          disabled={saving}
          options={challengeOptions}
        />
      )}

      {category && !isChallengeCategory && targetOptions.length > 0 && (
        <SelectField
          label="Target"
          value={targetValue}
          onChange={setTargetValue}
          placeholder="Choose a target"
          disabled={saving}
          options={targetOptions}
        />
      )}

      {error && <p className="text-[10px] text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-brand text-white text-xs font-semibold py-2.5 hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Creating…' : 'Create goal'}
      </button>
    </form>
  );
}

export function AccountMenuGoals() {
  const data = useQuery(api.userGoals.listForCurrentUser);
  const syncProgress = useMutation(api.userGoals.syncProgress);
  const archiveGoal = useMutation(api.userGoals.archive);

  const [showCreate, setShowCreate] = useState(false);
  const [archivingId, setArchivingId] = useState<Id<'userGoals'> | null>(null);

  const syncedRef = useRef(false);
  useEffect(() => {
    if (!data || syncedRef.current) return;
    if (data.goals.some((g) => g.status === 'active')) {
      syncedRef.current = true;
      void syncProgress({});
    }
  }, [data, syncProgress]);

  const activeGoals = data?.goals.filter((g) => g.status === 'active') ?? [];
  const completedGoals = data?.goals.filter((g) => g.status === 'completed') ?? [];
  const atCap = (data?.activeCount ?? 0) >= (data?.maxActiveGoals ?? 3);

  async function handleArchive(goalId: Id<'userGoals'>) {
    setArchivingId(goalId);
    try {
      await archiveGoal({ goalId });
    } finally {
      setArchivingId(null);
    }
  }

  if (data === undefined) {
    return <p className="text-xs text-gray-400 py-4">Loading goals…</p>;
  }

  if (data === null) {
    return <p className="text-xs text-gray-400 py-4">Sign in to manage goals.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Goals</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Track progress from your completed walks.{' '}
            <span className="tabular-nums">
              {data.activeCount} / {data.maxActiveGoals} active
            </span>
          </p>
        </div>
        {!showCreate && (
          <button
            type="button"
            disabled={atCap}
            title={atCap ? `Maximum ${data.maxActiveGoals} active goals` : undefined}
            onClick={() => setShowCreate(true)}
            className="shrink-0 rounded-lg border-2 border-brand text-brand font-semibold text-[11px] px-2.5 py-1.5 hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add goal
          </button>
        )}
      </div>

      {showCreate && (
        <CreateGoalForm onCancel={() => setShowCreate(false)} onCreated={() => setShowCreate(false)} />
      )}

      {activeGoals.length === 0 && !showCreate && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
          <p className="text-xs text-gray-500">No active goals yet.</p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-2 text-xs font-medium text-brand hover:underline"
          >
            Create your first goal
          </button>
        </div>
      )}

      {activeGoals.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Active</h3>
          {activeGoals.map((goal, i) => (
            <div key={goal._id} className="space-y-2">
              <GoalProgressBar
                title={goal.title}
                subtitle={goal.subtitle}
                challengeDay={goal.challengeDay}
                progressValue={goal.progressValue}
                targetValue={goal.targetValue}
                unit={goal.unit}
                progressPercent={goal.progressPercent}
                colorClass={GOAL_PROGRESS_COLORS[i % GOAL_PROGRESS_COLORS.length]}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={archivingId === goal._id}
                  onClick={() => void handleArchive(goal._id)}
                  className="text-[10px] font-medium text-gray-400 hover:text-gray-600"
                >
                  Archive
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {completedGoals.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Completed</h3>
          {completedGoals.map((goal) => (
            <div key={goal._id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{goal.title}</p>
                <p className="text-[10px] text-emerald-600">Completed</p>
              </div>
              <button
                type="button"
                disabled={archivingId === goal._id}
                onClick={() => void handleArchive(goal._id)}
                className="text-[10px] font-medium text-gray-400 hover:text-gray-600 shrink-0"
              >
                Archive
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
