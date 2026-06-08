import type { Doc } from './_generated/dataModel';

export type MobilePlatform = 'ios' | 'android';

export type MobileUpdateStatus = 'ok' | 'optional' | 'required';

export type MobileBuildCheckResult = {
  status: MobileUpdateStatus;
  currentBuild: number;
  minimumBuild: number | null;
  latestBuild: number | null;
  storeUrl: string | null;
  message: string | null;
};

export const MOBILE_RELEASE_POLICY_SEEDS: Array<
  Omit<Doc<'mobileReleasePolicies'>, '_id' | '_creationTime'>
> = [
  {
    platform: 'android',
    minimumBuild: 0,
    latestBuild: 0,
    storeUrl: 'https://play.google.com/store/apps/details?id=com.rambleio.app',
    optionalUpdateMessage:
      'A new version of Rambleio is available on Google Play.',
    requiredUpdateMessage:
      'This version of Rambleio is no longer supported. Please update from Google Play to continue.',
    updatedAt: 0,
  },
  {
    platform: 'ios',
    minimumBuild: 0,
    latestBuild: 0,
    storeUrl: 'https://apps.apple.com/search?term=Rambleio',
    optionalUpdateMessage:
      'A new version of Rambleio is available on the App Store.',
    requiredUpdateMessage:
      'This version of Rambleio is no longer supported. Please update from the App Store to continue.',
    updatedAt: 0,
  },
];

export function evaluateMobileBuild(
  build: number,
  policy: Doc<'mobileReleasePolicies'> | null,
): MobileBuildCheckResult {
  const base: MobileBuildCheckResult = {
    status: 'ok',
    currentBuild: build,
    minimumBuild: policy?.minimumBuild ?? null,
    latestBuild: policy?.latestBuild ?? null,
    storeUrl: policy?.storeUrl ?? null,
    message: null,
  };

  if (!policy) return base;

  if (policy.minimumBuild > 0 && build < policy.minimumBuild) {
    return {
      ...base,
      status: 'required',
      message: policy.requiredUpdateMessage ?? 'Please update the app to continue.',
    };
  }

  if (policy.latestBuild > 0 && build < policy.latestBuild) {
    return {
      ...base,
      status: 'optional',
      message: policy.optionalUpdateMessage ?? 'A new version is available.',
    };
  }

  return base;
}
