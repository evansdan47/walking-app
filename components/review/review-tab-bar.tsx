import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface TabDef {
  id: string;
  label: string;
  icon: string;
}

interface ReviewTabBarProps {
  tabs: TabDef[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function ReviewTabBar({ tabs, activeTab, onTabChange }: ReviewTabBarProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        const color = active ? colors.primary : colors.textMuted;
        return (
          <Pressable
            key={tab.id}
            style={[
              styles.tab,
              active ? styles.tabActive : styles.tabInactive,
              active && { backgroundColor: colors.primaryMuted },
            ]}
            onPress={() => onTabChange(tab.id)}
            hitSlop={4}
          >
            <Ionicons name={tab.icon as never} size={18} color={color} />
            {active && (
              <Text
                style={[styles.label, { color, fontFamily: Typography.fontMedium }]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
  },
  tabActive: {
    flex: 2,
    gap: 5,
    paddingHorizontal: Spacing.sm + 2,
  },
  tabInactive: {
    flex: 1,
  },
  label: {
    fontSize: Typography.sizes.sm,
  },
});
