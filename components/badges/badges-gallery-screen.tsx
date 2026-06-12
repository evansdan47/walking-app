import { useMutation } from 'convex/react';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { BadgeDetailSheet } from '@/components/badges/badge-detail-sheet';
import {
  BadgeFilterChips,
  matchesStatusFilter,
  type StatusFilter,
} from '@/components/badges/badge-filter-chips';
import { BadgeHex } from '@/components/badges/badge-hex';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAppAuth } from '@/hooks/use-app-auth';
import { useAppQuery } from '@/hooks/use-app-query';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { BadgeGalleryItem } from '@/lib/badges/types';

export function BadgesGalleryScreen() {
  const { authLoading, isAuthenticated } = useAppAuth();
  const gallery = useAppQuery(api.badges.getGalleryForCurrentUser);
  const recalculate = useMutation(api.badges.recalculateForCurrentUser);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<{
    badge: BadgeGalleryItem;
    categoryColor: string;
    categoryName: string;
  } | null>(null);
  const [recalcState, setRecalcState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);

  const filteredCategories = useMemo(() => {
    if (!gallery) return [];
    return gallery.categories
      .filter((cat) => categoryFilter === null || cat.key === categoryFilter)
      .map((cat) => ({
        ...cat,
        badges: cat.badges.filter((badge) => matchesStatusFilter(badge.status, statusFilter)),
      }))
      .filter((cat) => cat.badges.length > 0);
  }, [gallery, statusFilter, categoryFilter]);

  async function handleRecalculate() {
    setRecalcState('loading');
    setRecalcMessage(null);
    try {
      const result = await recalculate({});
      const unlocked = result.newlyUnlocked.length;
      const progress = result.progressUpdated;
      if (unlocked === 0 && progress === 0) {
        setRecalcMessage('Your badges are up to date.');
      } else {
        const parts: string[] = [];
        if (unlocked > 0) parts.push(`${unlocked} badge${unlocked === 1 ? '' : 's'} unlocked`);
        if (progress > 0) parts.push(`progress updated on ${progress} badge${progress === 1 ? '' : 's'}`);
        setRecalcMessage(`${parts.join('; ')}.`);
      }
      setRecalcState('done');
    } catch {
      setRecalcState('error');
      setRecalcMessage('Could not recalculate. Try again.');
    }
  }

  if (gallery === undefined) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />;
  }

  if (gallery === null) {
    if (authLoading || isAuthenticated) {
      return <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />;
    }
    return (
      <ThemedText type="body" style={{ color: colors.textMuted }}>
        Sign in to view your badges.
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
        <View>
          <ThemedText type="caption" style={{ color: colors.textMuted }}>
            {gallery.earnedCount} of {gallery.totalCount} earned
            {gallery.unseenCount > 0 ? (
              <ThemedText type="caption" style={{ color: colors.primary }}>
                {' '}
                · {gallery.unseenCount} new
              </ThemedText>
            ) : null}
          </ThemedText>
        </View>

        <BadgeFilterChips
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          categories={gallery.categories.map((cat) => ({
            key: cat.key,
            name: cat.name,
            color: cat.color,
          }))}
        />

        {filteredCategories.length === 0 ? (
          <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.backgroundMuted }]}>
            <ThemedText type="body" style={{ color: colors.textMuted }}>
              No badges match these filters.
            </ThemedText>
          </View>
        ) : (
          filteredCategories.map((category) => (
            <View key={category.key} style={[styles.category, { borderColor: colors.border }]}>
              <ThemedText type="bodySemiBold">{category.name}</ThemedText>
              <View style={styles.grid}>
                {category.badges.map((badge) => (
                  <View key={badge.key} style={styles.gridCell}>
                    <BadgeHex
                      name={badge.name}
                      icon={badge.icon}
                      categoryColor={category.color}
                      tier={badge.tier}
                      status={badge.status}
                      progressPercent={badge.progressPercent}
                      isNew={badge.isNew}
                      size="sm"
                      onPress={() =>
                        setSelected({
                          badge,
                          categoryColor: category.color,
                          categoryName: category.name,
                        })
                      }
                    />
                  </View>
                ))}
              </View>
            </View>
          ))
        )}

        <View style={styles.footer}>
          <Pressable
            onPress={() => void handleRecalculate()}
            disabled={recalcState === 'loading'}
            style={[styles.recalcBtn, { borderColor: colors.border }]}
          >
            <ThemedText type="link" style={{ opacity: recalcState === 'loading' ? 0.5 : 1 }}>
              {recalcState === 'loading' ? 'Recalculating…' : 'Recalculate my badges'}
            </ThemedText>
          </Pressable>
          {recalcMessage ? (
            <ThemedText
              type="caption"
              style={{ color: recalcState === 'error' ? '#dc2626' : colors.textMuted }}
            >
              {recalcMessage}
            </ThemedText>
          ) : null}
        </View>
      </ScrollView>

      {selected ? (
        <BadgeDetailSheet
          badge={selected.badge}
          categoryColor={selected.categoryColor}
          categoryName={selected.categoryName}
          open
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.base,
    paddingBottom: Spacing.xl,
  },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  category: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.xs,
  },
  gridCell: {
    width: '25%',
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  footer: {
    gap: Spacing.xs,
    alignItems: 'flex-start',
  },
  recalcBtn: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
});
