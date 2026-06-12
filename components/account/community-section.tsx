import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { DashboardSection } from '@/components/account/dashboard-section';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type CommunityRow = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: Href;
};

const ROWS: CommunityRow[] = [
  {
    id: 'friends',
    title: 'Friends',
    subtitle: 'Connect with friends',
    icon: 'people-outline',
  },
  {
    id: 'sharing',
    title: 'Sharing',
    subtitle: 'Share walks & routes',
    icon: 'share-social-outline',
    route: '/account/sharing' as Href,
  },
];

export function CommunitySection() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <DashboardSection title="Community">
      <View style={styles.list}>
        {ROWS.map((row, index) => (
          <Pressable
            key={row.id}
            style={[
              styles.row,
              index < ROWS.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              },
            ]}
            onPress={() => {
              if (row.route) router.push(row.route);
            }}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.backgroundMuted }]}>
              <Ionicons name={row.icon} size={18} color={colors.icon} />
            </View>
            <View style={styles.rowText}>
              <ThemedText type="bodyMed">{row.title}</ThemedText>
              <ThemedText type="caption" style={{ color: colors.textMuted }}>
                {row.subtitle}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </DashboardSection>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});
