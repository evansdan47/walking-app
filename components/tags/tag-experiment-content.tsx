import type { Doc } from '@/convex/_generated/dataModel';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WalkTaggingVariant } from '@/lib/experiments';
import type { QuestionnaireAnswers } from '@/lib/tag-questionnaire-mapping';

type TagDef = Doc<'tagDefinitions'>;
type Suggestion = {
  tagId: string;
  slug: string;
  label: string;
  confidence: number;
  reason: string;
};

type TagExperimentContentProps = {
  variant: WalkTaggingVariant;
  allTags: TagDef[];
  suggestions: Suggestion[];
  selectedIds: Set<string>;
  onChangeSelected: (ids: Set<string>) => void;
  maxQuestions?: number;
  onQuestionnaireChange?: (answers: QuestionnaireAnswers) => void;
};

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.backgroundMuted,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? '#fff' : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function Questionnaire({
  maxQuestions,
  onChange,
}: {
  maxQuestions: number;
  onChange: (answers: QuestionnaireAnswers) => void;
}) {
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({});

  function update(patch: Partial<QuestionnaireAnswers>) {
    const next = { ...answers, ...patch };
    setAnswers(next);
    onChange(next);
  }

  return (
    <View>
      <Text style={styles.qLabel}>What best describes the landscape?</Text>
      <View style={styles.chipRow}>
        {['coastal', 'woodland', 'countryside', 'mountain', 'urban'].map((id) => (
          <Chip
            key={id}
            label={id.charAt(0).toUpperCase() + id.slice(1)}
            selected={answers.landscape === id}
            onPress={() => update({ landscape: id })}
          />
        ))}
      </View>

      <Text style={styles.qLabel}>How challenging was the walk?</Text>
      <View style={styles.chipRow}>
        {[
          { id: 'easy', label: 'Easy' },
          { id: 'moderate', label: 'Moderate' },
          { id: 'hard', label: 'Hard' },
          { id: 'challenging', label: 'Challenging' },
        ].map((opt) => (
          <Chip
            key={opt.id}
            label={opt.label}
            selected={answers.difficulty === opt.id}
            onPress={() => update({ difficulty: opt.id })}
          />
        ))}
      </View>

      {maxQuestions >= 3 && (
        <>
          <Text style={styles.qLabel}>How were the views?</Text>
          <View style={styles.chipRow}>
            {['average', 'good', 'excellent'].map((id) => (
              <Chip
                key={id}
                label={id.charAt(0).toUpperCase() + id.slice(1)}
                selected={answers.views === id}
                onPress={() => update({ views: id })}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

export function TagExperimentContent({
  variant,
  allTags,
  suggestions,
  selectedIds,
  onChangeSelected,
  maxQuestions = 7,
  onQuestionnaireChange,
}: TagExperimentContentProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  const subjectiveQuick = useMemo(
    () => allTags.filter((t) => t.kind === 'subjective' || t.category === 'features').slice(0, 10),
    [allTags],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, TagDef[]>();
    for (const tag of allTags) {
      const list = map.get(tag.category) ?? [];
      list.push(tag);
      map.set(tag.category, list);
    }
    return [...map.entries()];
  }, [allTags]);

  useEffect(() => {
    if (variant === 'C') return;
    if (selectedIds.size > 0) return;
    if (suggestions.length > 0) {
      onChangeSelected(new Set(suggestions.map((s) => s.tagId)));
    }
  }, [variant, suggestions, selectedIds.size, onChangeSelected]);

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChangeSelected(next);
  }

  if (variant === 'C') {
    return (
      <Questionnaire
        maxQuestions={maxQuestions}
        onChange={(a) => onQuestionnaireChange?.(a)}
      />
    );
  }

  if (variant === 'B') {
    return (
      <View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>We&apos;ve identified</Text>
        <View style={styles.chipRow}>
          {suggestions.map((s) => (
            <Chip
              key={s.tagId}
              label={s.label}
              selected={selectedIds.has(s.tagId)}
              onPress={() => toggle(s.tagId)}
            />
          ))}
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.md }]}>
          Anything else?
        </Text>
        <View style={styles.chipRow}>
          {subjectiveQuick.map((tag) => (
            <Chip
              key={tag._id}
              label={tag.label}
              selected={selectedIds.has(tag._id)}
              onPress={() => toggle(tag._id)}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View>
      {byCategory.map(([category, tags]) => (
        <View key={category} style={styles.categoryBlock}>
          <Text style={[styles.categoryLabel, { color: colors.textMuted }]}>
            {category.replace('_', ' ')}
          </Text>
          <View style={styles.chipRow}>
            {tags.map((tag) => (
              <Chip
                key={tag._id}
                label={tag.label}
                selected={selectedIds.has(tag._id)}
                onPress={() => toggle(tag._id)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontMedium,
    marginBottom: Spacing.xs,
  },
  categoryBlock: {
    marginBottom: Spacing.md,
  },
  categoryLabel: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontBold,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  qLabel: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontMedium,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
});
