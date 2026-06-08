import type { AccountNavItem } from '@/components/account/account-nav';

export type AccountMenuView = Exclude<AccountNavItem['icon'], 'account' | 'help'>;

export type AccountMenuViewItem = {
  id: AccountMenuView;
  label: string;
};

/** Sections shown inside the header dropdown (map stays mounted). */
export const ACCOUNT_MENU_VIEWS: AccountMenuViewItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'profile', label: 'Profile' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'goals', label: 'Goals' },
  { id: 'badges', label: 'Badges' },
  { id: 'sharing', label: 'Sharing' },
];

export const ACCOUNT_EXTERNAL_LINKS = [
  { href: '/account/settings', label: 'Account', icon: 'account' as const },
  { href: '/account/help', label: 'Help & support', icon: 'help' as const },
] as const;

export const ACCOUNT_MENU_VIEW_COPY: Record<
  AccountMenuView,
  { title: string; description: string }
> = {
  overview: { title: 'Overview', description: '' },
  profile: {
    title: 'Profile',
    description: 'Display name, email, and avatar — coming in the next update.',
  },
  subscription: {
    title: 'Subscription',
    description: 'Your plan and billing settings.',
  },
  preferences: {
    title: 'Preferences',
    description: 'Units, weight, and display settings.',
  },
  goals: {
    title: 'Goals',
    description: 'Set and track walking goals from your completed walks.',
  },
  badges: {
    title: 'Badges',
    description: 'Your achievement badges and progress — coming soon.',
  },
  sharing: {
    title: 'Sharing',
    description: 'Share walks and routes with others — coming soon.',
  },
};
