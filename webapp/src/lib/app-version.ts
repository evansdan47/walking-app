/** Web app version reported on session sync (set in env at deploy time if needed). */
export const WEB_APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0';
