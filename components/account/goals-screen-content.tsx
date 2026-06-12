import { useMutation } from 'convex/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { GoalProgressBar } from '@/components/account/goal-progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useAppAuth } from '@/hooks/use-app-auth';
import { useAppQuery } from '@/hooks/use-app-query';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { GOAL_PROGRESS_COLORS } from '@/lib/goal-format';

function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primaryMuted : colors.backgroundCard,
        },
      ]}
    >
      <ThemedText
        type="caption"
        style={{
          color: selected ? colors.primary : colors.text,
          fontFamily: Typography.fontMedium,
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

function CreateGoalForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const catalog = useAppQuery(api.userGoals.getCatalog);
  const createGoal = useMutation(api.userGoals.create);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

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

  const periodLabels: Record<string, string> = {
    daily: 'Today',
    weekly: 'This week',
    monthly: 'This month',
    yearly: 'This year',
    lifetime: 'Lifetime',
  };

  async function handleCreate() {
    if (!category || !period) return;
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

  const canSubmit =
    Boolean(category && period) &&
    (isChallengeCategory ? Boolean(challengeId) : Boolean(targetValue));

  if (!catalog) {
    return <ActivityIndicator color={colors.primary} />;
  }

  return (
    <View style={[styles.formCard, { borderColor: colors.border, backgroundColor: colors.backgroundCard }]}>
      <ThemedText type="bodySemiBold">New goal</ThemedText>

      <ThemedText type="caption" style={{ color: colors.textMuted }}>
        Category
      </ThemedText>
      <View style={styles.chipRow}>
        {catalog.categories.map((cat) => (
          <OptionChip
            key={cat.id}
            label={cat.label}
            selected={categoryId === cat.id}
            onPress={() => setCategoryId(cat.id)}
          />
        ))}
      </View>

      {category ? (
        <>
          <ThemedText type="caption" style={{ color: colors.textMuted }}>
            Period
          </ThemedText>
          <View style={styles.chipRow}>
            {category.periods.map((p) => (
              <OptionChip
                key={p}
                label={periodLabels[p] ?? p}
                selected={period === p}
                onPress={() => setPeriod(p)}
              />
            ))}
          </View>
        </>
      ) : null}

      {category && isChallengeCategory ? (
        <>
          <ThemedText type="caption" style={{ color: colors.textMuted }}>
            Challenge
          </ThemedText>
          <View style={styles.chipRow}>
            {category.challenges?.map((challenge) => (
              <OptionChip
                key={challenge.id}
                label={challenge.label}
                selected={challengeId === challenge.id}
                onPress={() => setChallengeId(challenge.id)}
              />
            ))}
          </View>
        </>
      ) : null}

      {category && !isChallengeCategory && category.targetPresets ? (
        <>
          <ThemedText type="caption" style={{ color: colors.textMuted }}>
            Target
          </ThemedText>
          <View style={styles.chipRow}>
            {category.targetPresets.map((preset) => (
              <OptionChip
                key={preset.value}
                label={preset.label}
                selected={targetValue === String(preset.value)}
                onPress={() => setTargetValue(String(preset.value))}
              />
            ))}
          </View>
        </>
      ) : null}

      {error ? (
        <ThemedText type="caption" style={{ color: '#dc2626' }}>
          {error}
        </ThemedText>
      ) : null}

      <View style={styles.formActions}>
        <Pressable onPress={onCancel} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
          <ThemedText type="bodyMed">Cancel</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => void handleCreate()}
          disabled={!canSubmit || saving}
          style={[
            styles.primaryBtn,
            { backgroundColor: colors.primary, opacity: !canSubmit || saving ? 0.5 : 1 },
          ]}
        >
          <ThemedText style={{ color: colors.textInverse, fontFamily: Typography.fontMedium }}>
            {saving ? 'Creating…' : 'Create goal'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

export function GoalsScreenContent() {
  const { authLoading, isAuthenticated } = useAppAuth();
  const data = useAppQuery(api.userGoals.listForCurrentUser);
  const syncProgress = useMutation(api.userGoals.syncProgress);
  const archiveGoal = useMutation(api.userGoals.archive);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [showCreate, setShowCreate] = useState(false);
  const [archivingId, setArchivingId] = useState<Id<'userGoals'> | null>(null);
  const [pendingRemove, setPendingRemove] = useState<{ id: Id<'userGoals'>; title: string } | null>(
    null,
  );
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

  async function handleRemoveGoal(goalId: Id<'userGoals'>) {
    setArchivingId(goalId);
    try {
      await archiveGoal({ goalId });
    } finally {
      setArchivingId(null);
    }
  }

  function requestRemoveGoal(goal: { _id: Id<'userGoals'>; title: string }) {
    setPendingRemove({ id: goal._id, title: goal.title });
  }

  async function confirmRemoveGoal() {
    if (!pendingRemove) return;
    const { id } = pendingRemove;
    setPendingRemove(null);
    await handleRemoveGoal(id);
  }

  if (data === undefined) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />;
  }

  if (data === null) {
    if (authLoading || isAuthenticated) {
      return <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />;
    }
    return (
      <ThemedText type="body" style={{ color: colors.textMuted }}>
        Sign in to manage goals.
      </ThemedText>
    );
  }

  return (
    <>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText type="body" style={{ color: colors.textMuted }}>
            Track progress from your completed walks.
          </ThemedText>
          <ThemedText type="caption" style={{ color: colors.textMuted, marginTop: 4 }}>
            {data.activeCount} / {data.maxActiveGoals} active
          </ThemedText>
        </View>
        {!showCreate ? (
          <Pressable
            disabled={atCap}
            onPress={() => setShowCreate(true)}
            style={[
              styles.addBtn,
              { borderColor: colors.primary, opacity: atCap ? 0.5 : 1 },
            ]}
          >
            <ThemedText style={{ color: colors.primary, fontFamily: Typography.fontMedium }}>
              Add goal
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {showCreate ? (
        <CreateGoalForm onCancel={() => setShowCreate(false)} onCreated={() => setShowCreate(false)} />
      ) : null}

      {activeGoals.length === 0 && !showCreate ? (
        <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.backgroundMuted }]}>
          <ThemedText type="body" style={{ color: colors.textMuted }}>
            No active goals yet.
          </ThemedText>
          <Pressable onPress={() => setShowCreate(true)}>
            <ThemedText type="link">Create your first goal</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {activeGoals.length > 0 ? (
        <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.backgroundCard }]}>
          <ThemedText type="label" style={{ color: colors.textMuted }}>
            ACTIVE
          </ThemedText>
          {activeGoals.map((goal, index) => (
            <View
              key={goal._id}
              style={[
                styles.goalBlock,
                index < activeGoals.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                  paddingBottom: Spacing.base,
                },
              ]}
            >
              <GoalProgressBar
                title={goal.title}
                subtitle={goal.subtitle}
                challengeDay={goal.challengeDay}
                progressValue={goal.progressValue}
                targetValue={goal.targetValue}
                unit={goal.unit}
                progressPercent={goal.progressPercent}
                color={GOAL_PROGRESS_COLORS[index % GOAL_PROGRESS_COLORS.length]}
              />
              <Pressable
                onPress={() => requestRemoveGoal(goal)}
                disabled={archivingId === goal._id}
                style={[styles.removeBtn, { borderTopColor: colors.border }]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color: archivingId === goal._id ? colors.textMuted : '#b91c1c',
                    fontFamily: Typography.fontMedium,
                  }}
                >
                  {archivingId === goal._id ? 'Removing…' : 'Remove goal'}
                </ThemedText>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {completedGoals.length > 0 ? (
        <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.backgroundCard }]}>
          <ThemedText type="label" style={{ color: colors.textMuted }}>
            COMPLETED
          </ThemedText>
          {completedGoals.map((goal, index) => (
            <View
              key={goal._id}
              style={[
                styles.completedBlock,
                index < completedGoals.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                  paddingBottom: Spacing.base,
                },
              ]}
            >
              <View style={styles.completedRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="bodyMed">{goal.title}</ThemedText>
                  <ThemedText type="caption" style={{ color: colors.success }}>
                    Completed
                  </ThemedText>
                </View>
              </View>
              <Pressable
                onPress={() => requestRemoveGoal(goal)}
                disabled={archivingId === goal._id}
                style={[styles.removeBtn, { borderTopColor: colors.border }]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color: archivingId === goal._id ? colors.textMuted : '#b91c1c',
                    fontFamily: Typography.fontMedium,
                  }}
                >
                  {archivingId === goal._id ? 'Removing…' : 'Remove goal'}
                </ThemedText>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>

    <ConfirmDialog
      visible={pendingRemove !== null}
      title="Remove goal?"
      message={
        pendingRemove
          ? `Remove "${pendingRemove.title}" from your goals? You can add it again later.`
          : ''
      }
      confirmLabel="Remove goal"
      cancelLabel="Keep goal"
      onCancel={() => setPendingRemove(null)}
      onConfirm={() => void confirmRemoveGoal()}
    />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.base,
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  addBtn: {
    borderWidth: 2,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  section: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.base,
  },
  goalBlock: {
    gap: Spacing.sm,
  },
  removeBtn: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    alignSelf: 'stretch',
  },
  completedBlock: {
    gap: Spacing.sm,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
});
