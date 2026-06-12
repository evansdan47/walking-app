import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useConvex, useMutation } from 'convex/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAppQuery } from '@/hooks/use-app-query';
import { useWalkTaggingExperiment, EXPERIMENT_EVENTS } from '@/hooks/use-experiment';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ensureWalkOnConvex } from '@/lib/sync/ensure-walk-on-convex';
import {
  mapQuestionnaireToSlugs,
  slugsToTagIds,
  type QuestionnaireAnswers,
} from '@/lib/tag-questionnaire-mapping';
import { TagExperimentContent } from './tag-experiment-content';

type WalkTaggingSheetProps = {
  localWalkId: string;
  plannedRouteId?: string | null;
  visible: boolean;
  onClose: () => void;
};

export function WalkTaggingSheet({
  localWalkId,
  plannedRouteId,
  visible,
  onClose,
}: WalkTaggingSheetProps) {
  const convex = useConvex();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const experiment = useWalkTaggingExperiment();

  const [convexWalkId, setConvexWalkId] = useState<Id<'walks'> | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const allTags = useAppQuery(api.tags.listActiveTags, visible ? {} : 'skip');
  const suggestions = useAppQuery(
    api.tags.suggestForWalk,
    convexWalkId ? { walkId: convexWalkId } : 'skip',
  );
  const taggingStatus = useAppQuery(
    api.walks.getForTagging,
    convexWalkId ? { walkId: convexWalkId } : 'skip',
  );

  const bootstrapTags = useMutation(api.tags.bootstrapTagDefinitionsIfEmpty);
  const submitWalkTags = useMutation(api.tags.submitWalkTags);

  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<QuestionnaireAnswers>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const promptRecorded = useRef(false);
  const bootstrapAttempted = useRef(false);

  useEffect(() => {
    if (!visible) {
      setConvexWalkId(null);
      setPrepareError(null);
      promptRecorded.current = false;
      bootstrapAttempted.current = false;
      return;
    }

    let cancelled = false;
    setPreparing(true);
    setPrepareError(null);
    void ensureWalkOnConvex(localWalkId, convex)
      .then((id) => {
        if (!cancelled) setConvexWalkId(id as Id<'walks'>);
      })
      .catch((e) => {
        if (!cancelled) {
          setPrepareError(e instanceof Error ? e.message : 'Could not prepare walk for tagging');
        }
      })
      .finally(() => {
        if (!cancelled) setPreparing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, localWalkId, convex]);

  useEffect(() => {
    if (!experiment.enabled || experiment.isLoading || !visible) return;
    if (experiment.variant) return;
    void experiment.assign();
  }, [experiment, visible]);

  useEffect(() => {
    if (!visible || allTags === undefined || allTags.length > 0 || bootstrapAttempted.current) return;
    bootstrapAttempted.current = true;
    void bootstrapTags({});
  }, [visible, allTags, bootstrapTags]);

  useEffect(() => {
    if (!visible || !experiment.enabled || !experiment.variant || !convexWalkId || promptRecorded.current) {
      return;
    }
    promptRecorded.current = true;
    void experiment.recordEvent(EXPERIMENT_EVENTS.promptShown, {
      variant: experiment.variant,
      entityType: 'walk',
      entityId: convexWalkId,
    });
  }, [visible, experiment, convexWalkId]);

  useEffect(() => {
    if (taggingStatus?.taggingCompletedAt || taggingStatus?.taggingSkipped) {
      onClose();
    }
  }, [taggingStatus, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!convexWalkId) return;
    setSubmitting(true);
    setError('');
    try {
      await submitWalkTags({
        walkId: convexWalkId,
        tagIds: [...selectedTagIds] as Id<'tagDefinitions'>[],
        ...(plannedRouteId ? { plannedRouteId: plannedRouteId as Id<'plannedRoutes'> } : {}),
        ...(experiment.variant ? { experimentVariant: experiment.variant } : {}),
        ...(experiment.variant === 'C' ? { questionnaireAnswers } : {}),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save tags');
    } finally {
      setSubmitting(false);
    }
  }, [convexWalkId, selectedTagIds, plannedRouteId, experiment.variant, questionnaireAnswers, submitWalkTags, onClose]);

  const handleSkip = useCallback(async () => {
    if (!convexWalkId) return;
    setSubmitting(true);
    setError('');
    try {
      await submitWalkTags({
        walkId: convexWalkId,
        tagIds: [],
        skipped: true,
        ...(plannedRouteId ? { plannedRouteId: plannedRouteId as Id<'plannedRoutes'> } : {}),
        ...(experiment.variant ? { experimentVariant: experiment.variant } : {}),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not skip');
    } finally {
      setSubmitting(false);
    }
  }, [convexWalkId, plannedRouteId, experiment.variant, submitWalkTags, onClose]);

  if (!visible || !experiment.enabled) return null;

  const taggingAlreadyDone =
    Boolean(taggingStatus?.taggingCompletedAt) || Boolean(taggingStatus?.taggingSkipped);
  const taggingStatusLoaded = convexWalkId !== null && taggingStatus !== undefined;
  const canShowPrompt = taggingStatusLoaded && !taggingAlreadyDone;

  const showSkip = experiment.config?.showSkip ?? true;
  const maxQuestions = experiment.config?.maxQuestions ?? 7;
  const ready =
    !preparing &&
    !prepareError &&
    convexWalkId &&
    experiment.variant &&
    allTags !== undefined &&
    suggestions !== undefined;

  // Avoid flashing the dimmed backdrop while syncing the walk or loading tagging state.
  if (!canShowPrompt) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.backgroundCard,
              paddingBottom: insets.bottom + Spacing.md,
            },
          ]}
        >
          <View style={[styles.accent, { backgroundColor: colors.primary }]} />
          <Text style={[styles.title, { color: colors.text }]}>How was your walk?</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Help other walkers by sharing what the route was like.
          </Text>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {preparing && (
              <View style={styles.centered}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.hint, { color: colors.textMuted }]}>Preparing…</Text>
              </View>
            )}
            {prepareError && (
              <Text style={styles.error}>{prepareError}</Text>
            )}
            {ready && experiment.variant && (
              <TagExperimentContent
                variant={experiment.variant}
                allTags={allTags}
                suggestions={suggestions}
                selectedIds={selectedTagIds}
                onChangeSelected={setSelectedTagIds}
                maxQuestions={maxQuestions}
                onQuestionnaireChange={(answers) => {
                  setQuestionnaireAnswers(answers);
                  const slugs = mapQuestionnaireToSlugs(answers);
                  setSelectedTagIds(new Set(slugsToTagIds(slugs, allTags)));
                }}
              />
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            {showSkip && (
              <Pressable
                onPress={handleSkip}
                disabled={submitting || !convexWalkId}
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Skip</Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleSubmit}
              disabled={submitting || !ready}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
                (submitting || !ready) && styles.disabled,
              ]}
            >
              <Text style={styles.primaryBtnText}>{submitting ? 'Saving…' : 'Submit'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  accent: {
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.sizes.lg,
    fontFamily: Typography.fontHeadline,
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontRegular,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  body: {
    maxHeight: 360,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  hint: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontRegular,
  },
  error: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontRegular,
    color: '#c62828',
    marginTop: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  primaryBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
  },
  secondaryBtnText: {
    fontWeight: '500',
    fontSize: 15,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
