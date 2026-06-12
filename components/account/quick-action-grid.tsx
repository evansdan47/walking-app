import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { DashboardSection } from '@/components/account/dashboard-section';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type QuickAction = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: Href;
  tint: string;
  background: string;
};

const ACTIONS: QuickAction[] = [
  {
    id: 'profile',
    title: 'Profile',
    subtitle: 'View & edit',
    icon: 'person-outline',
    route: '/account/profile' as Href,
    tint: '#00695c',
    background: '#e0f2f1',
  },
  {
    id: 'goals',
    title: 'Goals',
    subtitle: 'Track progress',
    icon: 'locate-outline',
    route: '/account/goals' as Href,
    tint: '#e65100',
    background: '#fde8dd',
  },
  {
    id: 'badges',
    title: 'Badges',
    subtitle: 'Your achievements',
    icon: 'ribbon-outline',
    route: '/account/badges' as Href,
    tint: '#7b1fa2',
    background: '#f3e5f5',
  },
  {
    id: 'subscription',
    title: 'Subscription',
    subtitle: 'Manage plan',
    icon: 'diamond-outline',
    route: '/account/subscription' as Href,
    tint: '#1565c0',
    background: '#e3f2fd',
  },
];

export function QuickActionGrid() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <DashboardSection title="Quick actions">
      <View style={styles.grid}>
        {ACTIONS.map((action) => (
          <Pressable
            key={action.id}
            style={[
              styles.card,
              {
                backgroundColor: colorScheme === 'dark' ? colors.backgroundMuted : action.background,
                borderColor: colors.border,
              },
            ]}
            onPress={() => router.push(action.route)}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${action.tint}22` }]}>
              <Ionicons name={action.icon} size={22} color={action.tint} />
            </View>
            <ThemedText type="bodyMed" style={styles.cardTitle}>
              {action.title}
            </ThemedText>
            <ThemedText type="caption" style={{ color: colors.textMuted }}>
              {action.subtitle}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </DashboardSection>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  card: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.xs,
    minHeight: 108,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  cardTitle: {
    fontSize: Typography.sizes.sm,
  },
});
