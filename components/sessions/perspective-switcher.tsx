import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type SessionPerspective = 'recent' | 'routes' | 'nearby';

const PERSPECTIVES: { key: SessionPerspective; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'routes', label: 'Routes' },
  { key: 'nearby', label: 'Nearby' },
];

interface PerspectiveSwitcherProps {
  value: SessionPerspective;
  onChange: (value: SessionPerspective) => void;
}

export function PerspectiveSwitcher({ value, onChange }: PerspectiveSwitcherProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundMuted, borderColor: colors.border }]}>
      {PERSPECTIVES.map((p) => {
        const isActive = p.key === value;
        return (
          <Pressable
            key={p.key}
            style={[
              styles.pill,
              isActive && { backgroundColor: colors.backgroundCard, borderColor: colors.border },
            ]}
            onPress={() => onChange(p.key)}
            android_ripple={{ color: colors.primaryMuted }}
          >
            <Text
              style={[
                styles.label,
                { color: isActive ? colors.text : colors.textMuted },
                isActive && styles.labelActive,
              ]}
            >
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 2,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  label: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
  labelActive: {
    fontFamily: Typography.fontBold,
  },
});
