import { api } from '@/convex/_generated/api';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserSessionSync } from '@/hooks/use-user-session-sync';
import { getMobileClientInfo, openMobileStore } from '@/lib/mobile-client-info';
import { useAppQuery } from '@/hooks/use-app-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type MobileBuildGateProps = {
  children: React.ReactNode;
};

function UserSessionSyncMount() {
  useUserSessionSync();
  return null;
}

/**
 * Blocks the app when the native build is below the Convex minimum.
 * Shows an optional update modal when below latest but above minimum.
 */
export function MobileBuildGate({ children }: MobileBuildGateProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const clientInfo = useMemo(() => getMobileClientInfo(), []);
  const buildCheck = useAppQuery(api.appRelease.checkMobileBuild, {
    platform: clientInfo.platform,
    build: clientInfo.build,
  });

  const [optionalDismissed, setOptionalDismissed] = useState(false);

  if (buildCheck === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (buildCheck.status === 'required') {
    return (
      <View style={[styles.centered, styles.pad, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Update required</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          {buildCheck.message ??
            'This version of Rambleio is no longer supported. Please install the latest version to continue.'}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          Your build: {clientInfo.build}
          {buildCheck.minimumBuild != null ? ` · Required: ${buildCheck.minimumBuild}` : ''}
        </Text>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => void openMobileStore(buildCheck.storeUrl)}
        >
          <Text style={styles.primaryBtnText}>Open app store</Text>
        </Pressable>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Updates are installed manually from the store. Rambleio cannot install updates in the background without your action.
        </Text>
      </View>
    );
  }

  const showOptional =
    buildCheck.status === 'optional' && !optionalDismissed;

  return (
    <>
      <UserSessionSyncMount />
      {children}
      <Modal visible={showOptional} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.title, { color: colors.text }]}>Update available</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              {buildCheck.message ??
                'A newer version of Rambleio is available with improvements and fixes.'}
            </Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              Your build: {clientInfo.build}
              {buildCheck.latestBuild != null ? ` · Latest: ${buildCheck.latestBuild}` : ''}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
                onPress={() => setOptionalDismissed(true)}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Not now</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={() => void openMobileStore(buildCheck.storeUrl)}
              >
                <Text style={styles.primaryBtnText}>Update</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pad: {
    paddingHorizontal: Spacing.xl,
  },
  title: {
    fontFamily: Typography.fontHeadline,
    fontSize: Typography.sizes.lg,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  body: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.base,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  meta: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  hint: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 18,
  },
  primaryBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  secondaryBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
});
