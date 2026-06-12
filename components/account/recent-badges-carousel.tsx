import { type Href, useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DashboardSection } from '@/components/account/dashboard-section';
import { BadgesSectionSkeleton } from '@/components/account/section-skeletons';
import { BadgeDetailSheet } from '@/components/badges/badge-detail-sheet';
import { BadgeHex } from '@/components/badges/badge-hex';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAppQuery } from '@/hooks/use-app-query';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { RecentUnlockedBadge } from '@/lib/badges/types';

const OVERVIEW_BADGE_COLUMNS = 5;
/** Match web `gap-x-1` (4px). */
const GRID_GAP = 4;

const BadgeGrid = memo(function BadgeGrid({
  badges,
  onSelect,
}: {
  badges: RecentUnlockedBadge[];
  onSelect: (badge: RecentUnlockedBadge) => void;
}) {
  return (
    <View style={styles.grid}>
      {badges.map((item) => (
        <View key={item.key} style={styles.cell}>
          <BadgeHex
            name={item.name}
            icon={item.icon}
            categoryColor={item.categoryColor}
            tier={item.tier}
            status="earned"
            isNew={item.isNew}
            fillWidth
            onPress={() => onSelect(item)}
          />
        </View>
      ))}
    </View>
  );
});

export function RecentBadgesCarousel() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const badges = useAppQuery(api.badges.listRecentUnlocked, { limit: 5 });
  const [selected, setSelected] = useState<RecentUnlockedBadge | null>(null);

  const displayBadges = Array.isArray(badges) ? badges.slice(0, OVERVIEW_BADGE_COLUMNS) : [];
  const isPending = badges === undefined;
  const showEmpty = badges !== undefined && displayBadges.length === 0;

  return (
    <>
      <DashboardSection
        title="Recent badges"
        actionLabel="View all"
        onAction={() => router.push('/account/badges' as Href)}
      >
        <View style={styles.body}>
          {displayBadges.length > 0 ? (
            <BadgeGrid badges={displayBadges} onSelect={setSelected} />
          ) : null}
          {displayBadges.length === 0 && isPending ? <BadgesSectionSkeleton /> : null}
          {showEmpty ? (
            <ThemedText type="caption" style={{ color: colors.textMuted }}>
              No badges yet.
            </ThemedText>
          ) : null}
        </View>
      </DashboardSection>

      {selected ? (
        <BadgeDetailSheet
          badge={selected}
          categoryColor={selected.categoryColor}
          open
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    minHeight: 68,
  },
  grid: {
    flexDirection: 'row',
    gap: GRID_GAP,
    width: '100%',
  },
  cell: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
});
