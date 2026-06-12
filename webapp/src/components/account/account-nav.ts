export type AccountNavItem = {
  href: string;
  label: string;
  icon: 'overview' | 'profile' | 'subscription' | 'preferences' | 'goals' | 'badges' | 'sharing' | 'account' | 'help' | 'admin';
  section?: 'main' | 'footer';
};

/** Full-page routes only (opened in a new tab from the header menu). */
export const ACCOUNT_FULL_PAGE_ROUTES = [
  { href: '/account/settings', label: 'Account', icon: 'account' as const },
  { href: '/account/help', label: 'Help & support', icon: 'help' as const },
];
