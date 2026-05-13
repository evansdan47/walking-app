import { Ionicons } from '@expo/vector-icons';
import { useConvex } from 'convex/react';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    SectionList,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyWalkHistory } from '@/components/review/empty-walk-history';
import { PerspectiveSwitcher, type SessionPerspective } from '@/components/sessions/perspective-switcher';
import { SessionMemoryCard } from '@/components/sessions/session-memory-card';
import { WeeklySummaryCard } from '@/components/sessions/weekly-summary-card';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ensurePendingSyncJob } from '@/lib/db/sync-jobs';
import { getRouteCoordinatesForWalk } from '@/lib/db/track-points';
import { getFirstPhotosForWalks, getPhotoCountsForWalks } from '@/lib/db/walk-photos';
import { getWeeklyStats, listCompletedWalks, type Walk, type WeekBucket } from '@/lib/db/walks';
import { processPendingJobs } from '@/lib/sync/sync-manager';

// ---------------------------------------------------------------------------
// Date grouping helpers
// ---------------------------------------------------------------------------

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

function groupLabel(walkStartedAt: number): string {
  const now = Date.now();
  const todayStart = startOfDay(now);
  const walkDay = startOfDay(walkStartedAt);
  const thisWeekStart = startOfWeek(now);

  if (walkDay >= todayStart) return 'Today';
  if (walkDay >= thisWeekStart) {
    return new Date(walkStartedAt).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  // Check if same calendar month as today
  const nowMonth = new Date(now);
  const walkMonth = new Date(walkStartedAt);
  if (
    nowMonth.getFullYear() === walkMonth.getFullYear() &&
    nowMonth.getMonth() === walkMonth.getMonth()
  ) {
    return 'Earlier This Month';
  }

  return walkMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

interface SectionData {
  title: string;
  data: Walk[];
}

function groupWalksIntoSections(walks: Walk[]): SectionData[] {
  const sectionMap = new Map<string, Walk[]>();
  const sectionOrder: string[] = [];

  for (const walk of walks) {
    const label = groupLabel(walk.startedAt);
    if (!sectionMap.has(label)) {
      sectionMap.set(label, []);
      sectionOrder.push(label);
    }
    sectionMap.get(label)!.push(walk);
  }

  return sectionOrder.map((title) => ({ title, data: sectionMap.get(title)! }));
}

// ---------------------------------------------------------------------------
// Per-walk enrichment (photos + route coords) — loaded once on focus
// ---------------------------------------------------------------------------

interface WalkEnrichment {
  photos: import('@/lib/db/walk-photos').WalkPhoto[];
  totalPhotos: number;
  routeCoordinates: [number, number][];
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SessionsScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convex = useConvex();

  const [perspective, setPerspective] = useState<SessionPerspective>('recent');
  const [walks, setWalks] = useState<Walk[]>([]);
  const [weeklyBuckets, setWeeklyBuckets] = useState<WeekBucket[]>([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<number>(() => startOfWeek(Date.now()));
  const [enrichment, setEnrichment] = useState<Map<string, WalkEnrichment>>(new Map());
  const [syncing, setSyncing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const completed = listCompletedWalks();
      setWalks(completed);
      setWeeklyBuckets(getWeeklyStats(8));

      // Load photos + route coords for each walk
      const ids = completed.map((w) => w.id);
      const photoCounts = getPhotoCountsForWalks(ids);
      const firstPhotos = getFirstPhotosForWalks(ids, 5);

      const map = new Map<string, WalkEnrichment>();
      for (const walk of completed) {
        map.set(walk.id, {
          photos: firstPhotos.get(walk.id) ?? [],
          totalPhotos: photoCounts.get(walk.id) ?? 0,
          routeCoordinates: getRouteCoordinatesForWalk(walk.id, 80),
        });
      }
      setEnrichment(map);
    }, []),
  );

  const unsynced = useMemo(() => walks.filter((w) => w.convexId === null), [walks]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      for (const walk of unsynced) {
        ensurePendingSyncJob(walk.id, walk.deviceId, randomUUID());
      }
      await processPendingJobs(convex);
    } finally {
      setWalks(listCompletedWalks());
      setSyncing(false);
    }
  };

  const handleWalkPress = (walkId: string) => {
    router.push({ pathname: '/walk-summary', params: { walkId } });
  };

  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

  // Trim leading weeks with no sessions; always keep the current (last) week.
  // This means the chart only appears once there are ≥2 weeks of real data.
  const activeBuckets = useMemo(() => {
    const firstActive = weeklyBuckets.findIndex((b) => b.sessionCount > 0);
    if (firstActive === -1) return weeklyBuckets.slice(-1);
    return weeklyBuckets.slice(firstActive);
  }, [weeklyBuckets]);
  const filteredWalks = useMemo(
    () => walks.filter((w) => w.startedAt >= selectedWeekStart && w.startedAt < selectedWeekStart + MS_PER_WEEK),
    [walks, selectedWeekStart],
  );

  const sections = useMemo(() => groupWalksIntoSections(filteredWalks), [filteredWalks]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerLeft}>
            <Pressable
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.headerTitleBlock}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Sessions</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                Your walking adventures
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            {unsynced.length > 0 && (
              <Pressable
                style={[styles.headerActionBtn, { borderColor: colors.border }]}
                onPress={() => void handleSync()}
                disabled={syncing}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                    <Text style={[styles.headerActionLabel, { color: colors.primary }]}>Sync</Text>
                  </>
                )}
              </Pressable>
            )}
            <Pressable
              style={[styles.headerActionBtn, { borderColor: colors.border }]}
              onPress={() => router.push('/(tabs)/library')}
            >
              <Ionicons name="map-outline" size={18} color={colors.secondary} />
              <Text style={[styles.headerActionLabel, { color: colors.secondary }]}>Map</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <SectionList
        sections={perspective === 'recent' ? sections : []}
        keyExtractor={(w) => w.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + Spacing.lg }]}
        ListHeaderComponent={
          <>
            <PerspectiveSwitcher value={perspective} onChange={setPerspective} />
            {perspective === 'recent' && activeBuckets.length > 0 && (
              <WeeklySummaryCard
                buckets={activeBuckets}
                selectedWeekStart={selectedWeekStart}
                onSelectWeek={setSelectedWeekStart}
              />
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrapper}>
            {perspective === 'recent' ? (
              <EmptyWalkHistory />
            ) : (
              <View style={styles.comingSoon}>
                <Ionicons name="construct-outline" size={40} color={colors.textMuted} />
                <Text style={[styles.comingSoonText, { color: colors.textMuted }]}>Coming soon</Text>
              </View>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionHeader, { color: colors.secondary }]}>{section.title}</Text>
        )}
        renderItem={({ item }: { item: Walk }) => {
          const e = enrichment.get(item.id);
          return (
            <View style={styles.cardWrapper}>
              <SessionMemoryCard
                walk={item}
                photos={e?.photos ?? []}
                totalPhotos={e?.totalPhotos ?? 0}
                routeCoordinates={e?.routeCoordinates ?? []}
                onPress={() => handleWalkPress(item.id)}
              />
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  backBtn: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitleBlock: {
    gap: 2,
  },
  headerTitle: {
    fontFamily: Typography.fontDisplay,
    fontSize: Typography.sizes.xl,
    lineHeight: 34,
  },
  headerSubtitle: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    paddingTop: 4,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
  },
  headerActionLabel: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
  listContent: {
    paddingTop: Spacing.base,
  },
  sectionHeader: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.sm,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    marginBottom: Spacing.xs,
    letterSpacing: 0.3,
  },
  cardWrapper: {
    marginHorizontal: Spacing.base,
  },
  emptyWrapper: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.base,
  },
  comingSoon: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xl,
  },
  comingSoonText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.base,
  },
});
