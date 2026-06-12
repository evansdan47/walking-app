/**
 * Normalises cold-start deep links (e.g. rambleio://account/goals).
 * Expo Router passes paths without a guaranteed leading slash.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  if (!path || path === '/') return '/';

  const normalised = path.startsWith('/') ? path : `/${path}`;

  const accountDeepLinks = ['/account/goals', '/account/badges'] as const;
  if (accountDeepLinks.includes(normalised as (typeof accountDeepLinks)[number])) {
    return normalised;
  }

  return normalised;
}
