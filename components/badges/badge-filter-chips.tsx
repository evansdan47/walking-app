import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  accentColor?: string;
};

function FilterChip({ label, selected, onPress, accentColor }: FilterChipProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const selectedBg = accentColor ?? colors.text;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? selectedBg : colors.border,
          backgroundColor: selected ? selectedBg : colors.backgroundMuted,
        },
      ]}
    >
      <ThemedText
        type="caption"
        style={{
          color: selected ? colors.textInverse : colors.textMuted,
          fontFamily: Typography.fontMedium,
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

type BadgeFilterChipsProps = {
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  categoryFilter: string | null;
  onCategoryFilterChange: (key: string | null) => void;
  categories: { key: string; name: string; color: string }[];
};

export type StatusFilter = 'all' | 'earned' | 'locked' | 'in_progress';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'earned', label: 'Earned' },
  { id: 'locked', label: 'Locked' },
  { id: 'in_progress', label: 'In progress' },
];

export function matchesStatusFilter(
  status: 'locked' | 'earned' | 'in_progress',
  filter: StatusFilter,
): boolean {
  if (filter === 'all') return true;
  return status === filter;
}

export function BadgeFilterChips({
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
}: BadgeFilterChipsProps) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {STATUS_FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            label={f.label}
            selected={statusFilter === f.id}
            onPress={() => onStatusFilterChange(f.id)}
          />
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <FilterChip
          label="All categories"
          selected={categoryFilter === null}
          onPress={() => onCategoryFilterChange(null)}
        />
        {categories.map((cat) => (
          <FilterChip
            key={cat.key}
            label={cat.name}
            selected={categoryFilter === cat.key}
            onPress={() => onCategoryFilterChange(cat.key)}
            accentColor={cat.color}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
});
