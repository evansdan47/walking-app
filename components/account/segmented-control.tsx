import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  label?: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: SegmentedControlProps<T>) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={styles.wrap}>
      {label ? (
        <ThemedText type="bodyMed" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
      <View style={[styles.control, { borderColor: colors.border, opacity: disabled ? 0.5 : 1 }]}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              disabled={disabled}
              onPress={() => onChange(opt.value)}
              style={[styles.segment, selected && { backgroundColor: colors.primary }]}
            >
              <ThemedText
                type="caption"
                style={{
                  color: selected ? colors.textInverse : colors.textMuted,
                  fontFamily: Typography.fontMedium,
                }}
              >
                {opt.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  label: { marginBottom: 2 },
  control: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  segment: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
