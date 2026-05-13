import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Size = 'xs' | 'sm' | 'md' | 'lg';

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  size?: Size;
  accent?: boolean;
  align?: 'left' | 'center' | 'right';
  style?: ViewStyle;
}

const valueSize: Record<Size, number> = {
  xs: Typography.sizes.base,
  sm: Typography.sizes.md,
  md: Typography.sizes.xl,
  lg: Typography.sizes.hero,
};

const labelSize: Record<Size, number> = {
  xs: Typography.sizes.xs,
  sm: Typography.sizes.xs,
  md: Typography.sizes.sm,
  lg: Typography.sizes.base,
};

export function StatCard({
  label,
  value,
  unit,
  size = 'md',
  accent = false,
  align,
  style,
}: StatCardProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.backgroundCard, borderColor: colors.border },
        accent && { borderColor: colors.primary, borderWidth: 1.5 },
        align === 'center' && { alignItems: 'center' },
        align === 'right'  && { alignItems: 'flex-end' },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: colors.textMuted, fontSize: labelSize[size] },
          align != null && { textAlign: align },
        ]}
        numberOfLines={1}
      >
        {label.toUpperCase()}
      </Text>
      <View style={styles.valueRow}>
        <Text
          style={[
            styles.value,
            {
              color: accent ? colors.primary : colors.text,
              fontSize: valueSize[size],
            },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
        {unit ? (
          <Text
            style={[
              styles.unit,
              {
                color: colors.textMuted,
                fontSize: labelSize[size],
              },
            ]}
          >
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'flex-start',
  },
  label: {
    fontFamily: Typography.fontMedium,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  value: {
    fontFamily: Typography.fontDisplay,
    includeFontPadding: false,
  },
  unit: {
    fontFamily: Typography.fontMedium,
    paddingBottom: 3,
  },
});
