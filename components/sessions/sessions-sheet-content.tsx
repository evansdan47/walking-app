import { Ionicons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useConvex } from 'convex/react';
import { BlurView } from 'expo-blur';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
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
import { getFirstPhotosForWalks, getPhotoCountsForWalks, type WalkPhoto } from '@/lib/db/walk-photos';
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
// Per-walk enrichment
// ---------------------------------------------------------------------------

interface WalkEnrichment {
  photos: WalkPhoto[];
  totalPhotos: number;
  routeCoordinates: [number, number][];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SessionsSheetContentProps {
  /** True while the sheet is open — triggers a data reload each time it becomes true. */
  isOpen: boolean;
  /** Called before navigating to a walk summary — use to collapse the sheet first. */
  onOpenWalk?: (walkId: string) => void;
}

export function SessionsSheetContent({ isOpen, onOpenWalk }: SessionsSheetContentProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convex = useConvex();

  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

  const [perspective, setPerspective] = useState<SessionPerspective>('recent');
  const [walks, setWalks] = useState<Walk[]>([]);
  const [weeklyBuckets, setWeeklyBuckets] = useState<WeekBucket[]>([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<number>(() => startOfWeek(Date.now()));
  const [enrichment, setEnrichment] = useState<Map<string, WalkEnrichment>>(new Map());
  const [syncing, setSyncing] = useState(false);

  // Reload data every time the sheet opens
  useEffect(() => {
    if (!isOpen) return;

    setSelectedWeekStart(startOfWeek(Date.now()));

    const completed = listCompletedWalks();
    setWalks(completed);
    setWeeklyBuckets(getWeeklyStats(8));

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
  }, [isOpen]);

  const unsynced = useMemo(() => walks.filter((w) => w.convexId === null), [walks]);

  const activeBuckets = useMemo(() => {
    const firstActive = weeklyBuckets.findIndex((b) => b.sessionCount > 0);
    if (firstActive === -1) return weeklyBuckets.slice(-1);
    return weeklyBuckets.slice(firstActive);
  }, [weeklyBuckets]);

  const filteredWalks = useMemo(
    () =>
      walks.filter(
        (w) => w.startedAt >= selectedWeekStart && w.startedAt < selectedWeekStart + MS_PER_WEEK,
      ),
    [walks, selectedWeekStart],
  );

  const sections = useMemo(() => groupWalksIntoSections(filteredWalks), [filteredWalks]);

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
    if (onOpenWalk) {
      onOpenWalk(walkId);
    } else {
      router.push({ pathname: '/walk-summary', params: { walkId } });
    }
  };

  return (
    <View style={styles.sheetContainer}>
      {/* ── Frosted glass header (title + subtitle + sync only) ── */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 0}
        tint={scheme === 'dark' ? 'dark' : 'light'}
        style={[styles.frostedHeader, { borderBottomColor: colors.border }]}
      >
        {/* Android: BlurView won't blur native views, overlay a tint instead */}
        {Platform.OS === 'android' && (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: colors.background + 'D8' },
            ]}
          />
        )}
        <View style={styles.headerTitleRow}>
          <View style={styles.headerTitleBlock}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Sessions</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              Your walking adventures
            </Text>
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
          </View>
        </View>
      </BlurView>

      {/* ── Scrollable content (solid background) ───────────────── */}
      <BottomSheetScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.lg }]}
      >
        {/* Perspective switcher — sits just below the frosted header divider */}
        <View style={styles.switcherWrapper}>
          <PerspectiveSwitcher value={perspective} onChange={setPerspective} />
        </View>

      {/* Weekly summary card */}
      {perspective === 'recent' && activeBuckets.length > 0 && (
        <WeeklySummaryCard
          buckets={activeBuckets}
          selectedWeekStart={selectedWeekStart}
          onSelectWeek={setSelectedWeekStart}
        />
      )}

      {/* Walk sections */}
      {perspective === 'recent' ? (
        sections.length === 0 ? (
          <View style={styles.emptyWrapper}>
            <EmptyWalkHistory />
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.title}>
              <Text style={[styles.sectionHeader, { color: colors.text }]}>
                {section.title}
              </Text>
              {section.data.map((walk) => {
                const e = enrichment.get(walk.id);
                return (
                  <View key={walk.id} style={styles.cardWrapper}>
                    <SessionMemoryCard
                      walk={walk}
                      photos={e?.photos ?? []}
                      totalPhotos={e?.totalPhotos ?? 0}
                      routeCoordinates={e?.routeCoordinates ?? []}
                      onPress={() => handleWalkPress(walk.id)}
                    />
                  </View>
                );
              })}
            </View>
          ))
        )
      ) : (
        <View style={styles.comingSoon}>
          <Ionicons name="construct-outline" size={40} color={colors.textMuted} />
          <Text style={[styles.comingSoonText, { color: colors.textMuted }]}>Coming soon</Text>
        </View>
      )}
      </BottomSheetScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    flex: 1,
  },
  frostedHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.base,
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
  switcherWrapper: {
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
