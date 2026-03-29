import type { ReactNode } from 'react';
import { Children } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';

interface StatGridProps {
  children: ReactNode;
  columns?: 2 | 3;
  style?: ViewStyle;
}

export function StatGrid({ children, columns = 2, style }: StatGridProps) {
  return (
    <View style={[styles.grid, style]}>
      {Children.map(children, (child) => (
        <View style={columns === 3 ? styles.threeColItem : styles.twoColItem}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  twoColItem: {
    // 2 per row: each takes just under half so they wrap correctly with gap
    flexBasis: '48%',
    flex: 1,
  },
  threeColItem: {
    flexBasis: '30%',
    flex: 1,
  },
});
