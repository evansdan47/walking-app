import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AccountScreen } from '@/components/account/account-screen';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const SUPPORT_EMAIL = 'support@rambleio.app';
const WEB_APP_URL = 'https://rambleio.app';

type HelpLink = {
  id: string;
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function openUrl(url: string) {
  void Linking.openURL(url);
}

export default function HelpScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const buildNumber =
    Platform.OS === 'ios'
      ? (Constants.expoConfig?.ios?.buildNumber ?? '1')
      : String(Constants.expoConfig?.android?.versionCode ?? 1);

  const links: HelpLink[] = [
    {
      id: 'email',
      label: 'Email support',
      subtitle: SUPPORT_EMAIL,
      icon: 'mail-outline',
      onPress: () => openUrl(`mailto:${SUPPORT_EMAIL}`),
    },
    {
      id: 'web',
      label: 'Open Rambleio web',
      subtitle: 'Plan routes and review walks on desktop',
      icon: 'globe-outline',
      onPress: () => openUrl(WEB_APP_URL),
    },
  ];

  return (
    <AccountScreen title="Help & Support">
      <ThemedText type="body" style={{ color: colors.textMuted }}>
        Get help with Rambleio and find useful links.
      </ThemedText>

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.backgroundCard }]}>
        <ThemedText
          style={[
            styles.sectionLabel,
            { color: colors.textMuted, fontFamily: Typography.fontMedium },
          ]}
        >
          App version
        </ThemedText>
        <ThemedText type="body">Rambleio v{appVersion}</ThemedText>
        <ThemedText type="caption" style={{ color: colors.textMuted }}>
          Build {buildNumber} ({Platform.OS})
        </ThemedText>
      </View>

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.backgroundCard }]}>
        <ThemedText
          style={[
            styles.sectionLabel,
            { color: colors.textMuted, fontFamily: Typography.fontMedium },
          ]}
        >
          Need help?
        </ThemedText>
        {links.map((link, index) => (
          <Pressable
            key={link.id}
            style={[
              styles.linkRow,
              index < links.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              },
            ]}
            onPress={link.onPress}
          >
            <View style={[styles.linkIcon, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons name={link.icon} size={18} color={colors.primary} />
            </View>
            <View style={styles.linkText}>
              <ThemedText type="bodyMed">{link.label}</ThemedText>
              <ThemedText type="caption" style={{ color: colors.textMuted }}>
                {link.subtitle}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </AccountScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.xs,
  },
  sectionLabel: {
    fontSize: Typography.sizes.sm,
    marginBottom: Spacing.xs,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    flex: 1,
    gap: 2,
  },
});
