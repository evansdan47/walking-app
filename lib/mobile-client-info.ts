import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type MobileClientInfo = {
  platform: 'ios' | 'android';
  build: number;
  version: string;
};

function parseBuild(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Native build number and semver for the running mobile app. */
export function getMobileClientInfo(): MobileClientInfo {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  const nativeBuild = parseBuild(Application.nativeBuildVersion);
  const fallbackBuild =
    platform === 'android'
      ? parseBuild(Constants.expoConfig?.android?.versionCode?.toString())
      : parseBuild(Constants.expoConfig?.ios?.buildNumber);

  const build = nativeBuild > 0 ? nativeBuild : fallbackBuild;
  const version =
    Application.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    '0.0.0';

  return { platform, build, version };
}

/** Opens the platform store listing (Play Store / App Store). */
export async function openMobileStore(storeUrl: string | null | undefined): Promise<void> {
  const { Linking } = await import('react-native');
  const androidPackage = Constants.expoConfig?.android?.package ?? 'com.rambleio.app';
  const url =
    storeUrl ??
    (Platform.OS === 'android'
      ? `market://details?id=${androidPackage}`
      : 'https://apps.apple.com/search?term=Rambleio');

  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
    return;
  }

  if (Platform.OS === 'android') {
    await Linking.openURL(
      `https://play.google.com/store/apps/details?id=${androidPackage}`,
    );
  }
}
