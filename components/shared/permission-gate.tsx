import * as Location from 'expo-location';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type PermissionType = 'foreground' | 'background';

interface PermissionGateProps {
  type: PermissionType;
  onGranted: () => void;
}

const COPY: Record<
  PermissionType,
  { icon: string; title: string; body: string; cta: string }
> = {
  foreground: {
    icon: '📍',
    title: 'Location access needed',
    body: 'Rambleio needs access to your location to record your walk route.',
    cta: 'Allow location access',
  },
  background: {
    icon: '🔒',
    title: 'Background location needed',
    body: 'To keep recording while your screen is off or you switch apps, Rambleio needs "Always" location permission.',
    cta: 'Allow background access',
  },
};

export function PermissionGate({ type, onGranted }: PermissionGateProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const copy = COPY[type];

  async function handlePress() {
    let granted = false;
    if (type === 'foreground') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      granted = status === Location.PermissionStatus.GRANTED;
    } else {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      granted = status === Location.PermissionStatus.GRANTED;
    }
    if (granted) onGranted();
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.backgroundCard, borderColor: colors.border },
      ]}
    >
      <Text style={styles.icon}>{copy.icon}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{copy.body}</Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={() => { void handlePress(); }}
        activeOpacity={0.8}
      >
        <Text style={[styles.buttonText, { color: '#fff' }]}>{copy.cta}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    margin: Spacing.base,
    alignItems: 'center',
    gap: Spacing.md,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontFamily: Typography.fontHeadline,
    fontSize: Typography.sizes.lg,
    textAlign: 'center',
  },
  body: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.base,
    textAlign: 'center',
    lineHeight: Typography.sizes.base * Typography.lineHeights.normal,
  },
  button: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  buttonText: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
  },
});
