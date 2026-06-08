import type { Doc } from './_generated/dataModel';
import type { MobileBuildCheckResult } from './appReleaseCore';
import { evaluateMobileBuild } from './appReleaseCore';

export type ClientPlatform = 'web' | 'mobile';

export type SessionSyncArgs = {
  name?: string;
  email?: string;
  client?: ClientPlatform;
  mobileBuild?: number;
  mobileVersion?: string;
  mobilePlatform?: 'ios' | 'android';
  webAppVersion?: string;
};

export function buildLoginPatch(
  args: SessionSyncArgs,
  now: number,
): Partial<Doc<'users'>> {
  if (args.client === 'web') {
    return {
      lastLoginAtWeb: now,
      ...(args.webAppVersion !== undefined ? { lastWebAppVersion: args.webAppVersion } : {}),
    };
  }

  if (args.client === 'mobile') {
    return {
      lastLoginAtMobile: now,
      ...(args.mobileBuild !== undefined ? { lastMobileBuild: args.mobileBuild } : {}),
      ...(args.mobileVersion !== undefined ? { lastMobileVersion: args.mobileVersion } : {}),
      ...(args.mobilePlatform !== undefined ? { lastMobilePlatform: args.mobilePlatform } : {}),
    };
  }

  return {};
}

export function mobileUpdateFromSync(
  args: SessionSyncArgs,
  policy: Doc<'mobileReleasePolicies'> | null,
): MobileBuildCheckResult | null {
  if (args.client !== 'mobile' || args.mobileBuild === undefined) return null;
  return evaluateMobileBuild(args.mobileBuild, policy);
}
