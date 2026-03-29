import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { updateWalkTitle } from '@/lib/db/walks';

interface WalkHeaderCardProps {
  walkId: string;
  title: string | null;
  startedAt: number;
  durationSeconds: number;
  onTitleChanged: (newTitle: string) => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function WalkHeaderCard({
  walkId,
  title,
  startedAt,
  durationSeconds,
  onTitleChanged,
}: WalkHeaderCardProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  const dateStr = formatDate(startedAt);
  const displayTitle = title ?? dateStr;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayTitle);

  // Keep draft in sync when external title changes (e.g. after save)
  useEffect(() => {
    if (!editing) setDraft(title ?? dateStr);
  }, [title, editing, dateStr]);

  function handleConfirm() {
    const trimmed = draft.trim();
    if (trimmed) {
      updateWalkTitle(walkId, trimmed);
      onTitleChanged(trimmed);
    }
    setEditing(false);
  }

  function handleCancel() {
    setDraft(title ?? dateStr);
    setEditing(false);
  }

  return (
    <View style={styles.card}>
      {/* Title row */}
      {editing ? (
        <View style={styles.editRow}>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            value={draft}
            onChangeText={setDraft}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />
          <Pressable onPress={handleConfirm} hitSlop={8} style={styles.editAction}>
            <Ionicons name="checkmark" size={22} color={colors.success} />
          </Pressable>
          <Pressable onPress={handleCancel} hitSlop={8} style={styles.editAction}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setEditing(true)} style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {displayTitle}
          </Text>
          <Ionicons name="pencil-outline" size={16} color={colors.textMuted} style={styles.editIcon} />
        </Pressable>
      )}

      {/* Date + duration metadata */}
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        {dateStr}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.lg,
    flex: 1,
  },
  editIcon: {
    marginTop: 2,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.base,
  },
  editAction: {
    padding: Spacing.xs,
  },
  meta: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
  },
});
