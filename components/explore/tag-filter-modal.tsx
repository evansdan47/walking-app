import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useAppQuery } from '@/hooks/use-app-query';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { groupTagsByCategory } from '@/lib/tag-categories';

type TagFilterModalProps = {
  visible: boolean;
  selectedSlugs: string[];
  onApply: (slugs: string[]) => void;
  onClose: () => void;
};

function slugsToIds(slugs: string[], tags: Doc<'tagDefinitions'>[]): Set<Id<'tagDefinitions'>> {
  const bySlug = new Map(tags.map((t) => [t.slug, t._id]));
  return new Set(slugs.map((s) => bySlug.get(s)).filter((id): id is Id<'tagDefinitions'> => !!id));
}

function idsToSlugs(ids: Set<Id<'tagDefinitions'>>, tags: Doc<'tagDefinitions'>[]): string[] {
  const byId = new Map(tags.map((t) => [t._id, t.slug]));
  return [...ids].map((id) => byId.get(id)).filter((s): s is string => !!s);
}

export function TagFilterModal({ visible, selectedSlugs, onApply, onClose }: TagFilterModalProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const allTags = useAppQuery(api.tags.listActiveTags, visible ? {} : 'skip');
  const bootstrapTags = useMutation(api.tags.bootstrapTagDefinitionsIfEmpty);
  const [selectedIds, setSelectedIds] = useState<Set<Id<'tagDefinitions'>>>(new Set());
  const bootstrapAttempted = useRef(false);

  const tags = allTags ?? [];
  const groups = useMemo(() => groupTagsByCategory(tags), [tags]);

  useEffect(() => {
    if (!visible || !allTags?.length) return;
    setSelectedIds(slugsToIds(selectedSlugs, allTags));
  }, [visible, selectedSlugs, allTags]);

  useEffect(() => {
    if (!visible) {
      bootstrapAttempted.current = false;
      return;
    }
    if (allTags === undefined || allTags.length > 0 || bootstrapAttempted.current) return;
    bootstrapAttempted.current = true;
    void bootstrapTags({});
  }, [visible, allTags, bootstrapTags]);

  function toggleTag(id: Id<'tagDefinitions'>) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Filter by tags</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Routes matching any selected tag will appear, best matches first.
          </Text>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={{ padding: Spacing.base, paddingBottom: Spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          {allTags === undefined && (
            <Text style={[styles.hint, { color: colors.textMuted }]}>Loading tags…</Text>
          )}
          {groups.map((group) => (
            <View key={group.category} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{group.label}</Text>
              <View style={styles.chipRow}>
                {group.tags.map((tag) => {
                  const selected = selectedIds.has(tag._id);
                  return (
                    <Pressable
                      key={tag._id}
                      onPress={() => toggleTag(tag._id)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selected ? colors.primary : colors.backgroundMuted,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: selected ? '#fff' : colors.text },
                        ]}
                      >
                        {tag.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + Spacing.sm,
              backgroundColor: colors.backgroundCard,
            },
          ]}
        >
          <Pressable
            onPress={() => setSelectedIds(new Set())}
            disabled={selectedIds.size === 0}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Text style={[styles.clearText, { color: colors.textMuted, opacity: selectedIds.size === 0 ? 0.4 : 1 }]}>
              Clear tags
            </Text>
          </Pressable>
          <View style={styles.footerActions}>
            <Pressable
              onPress={onClose}
              style={[styles.secondaryBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onApply(idsToSlugs(selectedIds, tags));
                onClose();
              }}
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.primaryBtnText}>
                {selectedIds.size > 0 ? `Apply (${selectedIds.size})` : 'Show all'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontFamily: Typography.fontHeadline,
    fontSize: Typography.sizes.lg,
  },
  subtitle: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
    marginTop: 4,
    lineHeight: 20,
  },
  body: { flex: 1 },
  hint: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  section: { marginBottom: Spacing.md },
  sectionTitle: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
  footerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  secondaryBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
  primaryBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  primaryBtnText: {
    color: '#fff',
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.sm,
  },
  pressed: { opacity: 0.85 },
});
