import type { BottomSheetHandleProps } from '@gorhom/bottom-sheet';
import { StyleSheet, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Attached wide-pill drag handle for @gorhom/bottom-sheet tab sheets. */
export const BOTTOM_SHEET_GRABBER_HEIGHT = 28;

export function BottomSheetGrabber({ style }: BottomSheetHandleProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const pillColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.22)';

  return (
    <View
      style={[
        style,
        styles.container,
        {
          backgroundColor: colors.background,
          borderTopLeftRadius: Radius.lg,
          borderTopRightRadius: Radius.lg,
        },
      ]}
    >
      <View style={[styles.pill, { backgroundColor: pillColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    width: 48,
    height: 5,
    borderRadius: 2.5,
  },
});
