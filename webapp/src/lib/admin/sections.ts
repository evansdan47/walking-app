export type AdminSectionId =
  | 'overview'
  | 'badges'
  | 'badge-categories'
  | 'releases'
  | 'experiments'
  | 'tags';

export type AdminNavItem = {
  id: AdminSectionId;
  href: string;
  label: string;
  description: string;
  parentId?: AdminSectionId;
};

export const ADMIN_NAV: AdminNavItem[] = [
  {
    id: 'overview',
    href: '/admin',
    label: 'Overview',
    description: 'Summary of all admin areas and quick links.',
  },
  {
    id: 'badges',
    href: '/admin/badges',
    label: 'Badges',
    description: 'Manage badge catalogue, rules, and unlock stats.',
  },
  {
    id: 'badge-categories',
    href: '/admin/badges/categories',
    label: 'Badge categories',
    description: 'Category colours, icons, and display order.',
    parentId: 'badges',
  },
  {
    id: 'releases',
    href: '/admin/releases',
    label: 'Mobile releases',
    description: 'Minimum and latest native build policies per platform.',
  },
  {
    id: 'experiments',
    href: '/admin/experiments',
    label: 'Experiments',
    description: 'A/B test configs, weights, and funnel summaries.',
  },
  {
    id: 'tags',
    href: '/admin/tags',
    label: 'Tags',
    description: 'Controlled vocabulary for route and walk tagging.',
  },
];

export function getAdminSection(pathname: string): AdminNavItem | undefined {
  const sorted = [...ADMIN_NAV].sort((a, b) => b.href.length - a.href.length);
  return sorted.find((item) =>
    item.href === '/admin'
      ? pathname === '/admin' || pathname === '/admin/'
      : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
