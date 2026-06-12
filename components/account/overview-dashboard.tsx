import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useAuth } from '@clerk/expo';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AccountHamburgerMenu,
  type AccountMenuRoute,
} from '@/components/account/account-hamburger-menu';
import { ActiveGoalsSection } from '@/components/account/active-goals-section';
import { CommunitySection } from '@/components/account/community-section';
import { DashboardHeader } from '@/components/account/dashboard-header';
import { ProgressStatsSection } from '@/components/account/progress-stats-section';
import { QuickActionGrid } from '@/components/account/quick-action-grid';
import { RecentBadgesCarousel } from '@/components/account/recent-badges-carousel';
import { UserCard } from '@/components/account/user-card';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type OverviewDashboardProps = {
  /** When true, renders inside the Explore tab bottom sheet (not the profile route). */
  embedded?: boolean;
};

const TABLET_OVERVIEW_MIN_WIDTH = 768;

export function OverviewDashboard({ embedded = false }: OverviewDashboardProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = useState(false);
  const Scroll = embedded ? BottomSheetScrollView : ScrollView;
  const useTwoColumn = width >= TABLET_OVERVIEW_MIN_WIDTH;

  function handleSettingsPress() {
    router.push('/account/preferences' as Href);
  }

  function handleNavigate(route: AccountMenuRoute) {
    router.push(route as Href);
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <DashboardHeader
        embedded={embedded}
        onMenuPress={() => setMenuOpen(true)}
        onSettingsPress={handleSettingsPress}
      />

      <Scroll
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <UserCard />
        <ProgressStatsSection />
        {useTwoColumn ? (
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <ActiveGoalsSection />
            </View>
            <View style={styles.column}>
              <RecentBadgesCarousel />
            </View>
          </View>
        ) : (
          <>
            <ActiveGoalsSection />
            <RecentBadgesCarousel />
          </>
        )}
        <QuickActionGrid />
        <CommunitySection />
      </Scroll>

      <AccountHamburgerMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.base,
    gap: Spacing.base,
  },
  twoColumn: {
    flexDirection: 'row',
    gap: Spacing.base,
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
});
